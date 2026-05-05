use crate::job::{run_job_once, ResolvedJob};
use crate::log::{log, LogLevel};
use anyhow::{Context, Result};
use chrono::{DateTime, Local};
use croner::Cron;
use std::thread;
use std::time::Duration;

/// 调度器内部使用的任务状态。
#[derive(Debug)]
struct ScheduledJob {
    job: ResolvedJob,
    cron: Cron,
    next_run: DateTime<Local>,
}

/// 在新线程中运行任务。
fn spawn_job(job: ResolvedJob, level: LogLevel) {
    thread::spawn(move || {
        if let Err(err) = run_job_once(&job, level) {
            log(level, LogLevel::Error, &format!("{:?}", err));
        }
    });
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
                spawn_job(scheduled.job.clone(), level);
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
    use std::path::PathBuf;

    #[test]
    fn schedule_does_not_track_running_state() {
        let jobs = vec![ResolvedJob {
            name: "test".to_string(),
            cron: "0 8 * * *".to_string(),
            binary_path: PathBuf::from("/bin/test"),
            working_dir: PathBuf::from("/tmp"),
            args: Vec::new(),
            env: Default::default(),
        }];

        let schedule = build_schedule(jobs).unwrap();

        assert_eq!(schedule.len(), 1);
    }
}
