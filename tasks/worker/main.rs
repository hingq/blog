mod cli;
mod config;
mod daemon;
mod job;
mod log;
mod scheduler;
mod workspace;

use anyhow::{Context, Result};
use clap::Parser;
use cli::{Cli, Commands};
use config::{load_file, AppConfig};
use daemon::{lock_path_for_config, spawn_background, SchedulerLock};
use job::{list_config_jobs, list_jobs, resolve_jobs, run_job_once};
use scheduler::start_scheduler;
use std::path::Path;
use workspace::Workspace;

fn main() -> Result<()> {
    // worker 的主流程：
    // 1. 解析命令行参数
    // 2. 读取任务配置
    // 3. 找到 workspace 中每个任务对应的二进制
    // 4. 根据子命令启动调度、立即运行或列出任务
    let cli = Cli::parse();
    let config = load_file(&cli.config)?;
    let workspace = Workspace::load_from_current_dir()?;

    match cli.command {
        Commands::Start { foreground } => {
            if !foreground {
                return spawn_background(&cli.config, cli.log_level);
            }
            let lock_path = lock_path_for_config(&cli.config);
            let _lock = SchedulerLock::acquire(&lock_path)?;
            let jobs = resolve_jobs(&config, &workspace, Path::exists)?;
            start_scheduler(jobs, cli.log_level)
        }
        Commands::Run {
            include_disabled,
            name,
        } => {
            let jobs = if include_disabled {
                let job = config
                    .jobs
                    .iter()
                    .find(|job| job.name == name)
                    .with_context(|| format!("找不到任务: {}", name))?;
                let mut job = job.clone();
                job.enabled = true;
                let config = AppConfig {
                    binary_dir: config.binary_dir.clone(),
                    jobs: vec![job],
                };
                resolve_jobs(&config, &workspace, Path::exists)?
            } else {
                resolve_jobs(&config, &workspace, Path::exists)?
            };
            let job = jobs
                .iter()
                .find(|job| job.name == name)
                .with_context(|| format!("找不到任务: {}", name))?;
            run_job_once(job, cli.log_level)
        }
        Commands::List { all } => {
            if all {
                list_config_jobs(&config.jobs);
            } else {
                let jobs = resolve_jobs(&config, &workspace, Path::exists)?;
                list_jobs(&jobs);
            }
            Ok(())
        }
    }
}
