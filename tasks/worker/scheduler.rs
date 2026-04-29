use crate::job::{run_job_once, ResolvedJob};
use crate::log::{log, LogLevel};
use anyhow::{Context, Result};
use chrono::{DateTime, Local};
use croner::Cron;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

/// 调度器内部使用的任务状态。
///
/// `running` 用来标记任务是否还在执行，避免同一个任务重叠运行。
#[derive(Debug)]
struct ScheduledJob {
    job: ResolvedJob,
    cron: Cron,
    next_run: DateTime<Local>,
    running: Arc<AtomicBool>,
}

/// 尝试启动任务时的结果。
#[derive(Debug, PartialEq, Eq)]
enum StartDecision {
    Started,
    SkippedAlreadyRunning,
}

/// 用原子变量把任务状态从“未运行”改成“运行中”。
///
/// `compare_exchange` 可以避免多个线程同时把同一个任务启动两次。
fn try_mark_job_started(running: &AtomicBool) -> StartDecision {
    match running.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst) {
        Ok(_) => StartDecision::Started,
        Err(_) => StartDecision::SkippedAlreadyRunning,
    }
}

/// 在新线程中运行任务。
///
/// 任务结束后必须把 `running` 改回 `false`，否则之后的触发都会被跳过。
fn spawn_job(job: ResolvedJob, running: Arc<AtomicBool>, level: LogLevel) {
    match try_mark_job_started(&running) {
        StartDecision::Started => {
            thread::spawn(move || {
                if let Err(err) = run_job_once(&job, level) {
                    log(level, LogLevel::Error, &format!("{:?}", err));
                }
                running.store(false, Ordering::SeqCst);
            });
        }
        StartDecision::SkippedAlreadyRunning => {
            log(
                level,
                LogLevel::Warn,
                &format!("任务仍在运行，跳过本次触发: {}", job.name),
            );
        }
    }
}

/// 根据 cron 表达式计算每个任务的下一次运行时间。
fn build_schedule(jobs: Vec<ResolvedJob>) -> Result<Vec<ScheduledJob>> {
    let now = Local::now();
    jobs.into_iter()
        .map(|job| {
            let cron = Cron::new(&job.cron)
                .parse()
                .with_context(|| format!("非法 cron: {} ({})", job.name, job.cron))?;
            let next_run = cron
                .find_next_occurrence(&now, false)
                .with_context(|| format!("无法计算下次运行时间: {}", job.name))?;
            Ok(ScheduledJob {
                job,
                cron,
                next_run,
                running: Arc::new(AtomicBool::new(false)),
            })
        })
        .collect()
}

/// 启动调度循环。
///
/// 这个函数会一直运行：到达某个任务的 `next_run` 后启动任务，再计算下一次时间。
pub fn start_scheduler(jobs: Vec<ResolvedJob>, level: LogLevel) -> Result<()> {
    let mut schedule = build_schedule(jobs)?;
    for job in &schedule {
        log(
            level,
            LogLevel::Info,
            &format!("任务 {} 下次运行: {}", job.job.name, job.next_run),
        );
    }

    loop {
        let now = Local::now();
        for scheduled in &mut schedule {
            if scheduled.next_run <= now {
                spawn_job(scheduled.job.clone(), Arc::clone(&scheduled.running), level);
                scheduled.next_run = scheduled
                    .cron
                    .find_next_occurrence(&now, false)
                    .with_context(|| format!("无法计算下次运行时间: {}", scheduled.job.name))?;
                log(
                    level,
                    LogLevel::Debug,
                    &format!(
                        "任务 {} 下次运行: {}",
                        scheduled.job.name, scheduled.next_run
                    ),
                );
            }
        }

        // 每轮循环睡到最近的任务时间，但最长只睡 60 秒，方便系统时间变化后能较快恢复。
        let next_run = schedule
            .iter()
            .map(|job| job.next_run)
            .min()
            .context("没有可调度任务")?;
        let sleep_for = next_run
            .signed_duration_since(Local::now())
            .to_std()
            .unwrap_or_else(|_| Duration::from_millis(200));
        thread::sleep(sleep_for.min(Duration::from_secs(60)));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn running_job_is_skipped_instead_of_started_again() {
        let running = AtomicBool::new(true);

        assert_eq!(
            try_mark_job_started(&running),
            StartDecision::SkippedAlreadyRunning
        );
        assert!(running.load(Ordering::SeqCst));
    }

    #[test]
    fn idle_job_is_marked_running() {
        let running = AtomicBool::new(false);

        assert_eq!(try_mark_job_started(&running), StartDecision::Started);
        assert!(running.load(Ordering::SeqCst));
    }
}
