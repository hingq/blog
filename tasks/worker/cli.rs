use crate::log::LogLevel;
use clap::{Parser, Subcommand};
use std::path::PathBuf;

#[derive(Debug, Parser)]
#[command(name = "worker")]
#[command(version = "0.1.0")]
#[command(about = "低开销 Rust 定时任务调度器")]
pub struct Cli {
    /// 配置文件路径
    #[arg(short, long, default_value = "worker/config.toml")]
    pub config: PathBuf,

    /// 日志级别: error, warn, info, debug
    #[arg(short, long, default_value = "info")]
    pub log_level: LogLevel,

    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Debug, Subcommand)]
pub enum Commands {
    /// 启动调度器
    Start,

    /// 执行一次任务
    Run {
        /// 任务名称
        name: String,
    },

    /// 查看任务列表
    List,
}
