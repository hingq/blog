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
    Start {
        /// 前台运行调度器，用于调试或交给 systemd/supervisor 管理
        #[arg(long)]
        foreground: bool,
    },

    /// 执行一次任务
    Run {
        /// 允许手动执行已关闭任务
        #[arg(long)]
        include_disabled: bool,

        /// 任务名称
        name: String,
    },

    /// 查看任务列表
    List {
        /// 显示已关闭任务
        #[arg(long)]
        all: bool,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_list_all_flag() {
        let cli = Cli::parse_from(["worker", "list", "--all"]);

        assert!(matches!(cli.command, Commands::List { all: true }));
    }

    #[test]
    fn parses_run_include_disabled_flag() {
        let cli = Cli::parse_from(["worker", "run", "--include-disabled", "paused"]);

        assert!(matches!(
            cli.command,
            Commands::Run {
                include_disabled: true,
                name
            } if name == "paused"
        ));
    }

    #[test]
    fn start_defaults_to_background_mode() {
        let cli = Cli::parse_from(["worker", "start"]);

        assert!(matches!(cli.command, Commands::Start { foreground: false }));
    }

    #[test]
    fn parses_start_foreground_flag() {
        let cli = Cli::parse_from(["worker", "start", "--foreground"]);

        assert!(matches!(cli.command, Commands::Start { foreground: true }));
    }
}
