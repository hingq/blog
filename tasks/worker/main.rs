mod cli;
mod config;
mod job;
mod log;
mod scheduler;
mod workspace;

use anyhow::{Context, Result};
use clap::Parser;
use cli::{Cli, Commands};
use config::load_file;
use job::{list_jobs, resolve_jobs, run_job_once};
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
    let jobs = resolve_jobs(&config, &workspace, Path::exists)?;

    match cli.command {
        Commands::Start => start_scheduler(jobs, cli.log_level),
        Commands::Run { name } => {
            let job = jobs
                .iter()
                .find(|job| job.name == name)
                .with_context(|| format!("找不到任务: {}", name))?;
            run_job_once(job, cli.log_level)
        }
        Commands::List => {
            list_jobs(&jobs);
            Ok(())
        }
    }
}
