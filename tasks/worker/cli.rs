use crate::log::LogLevel;
use anyhow::{Context, Result};
use std::env;
use std::path::PathBuf;
use std::str::FromStr;

const DEFAULT_CONFIG_PATH: &str = "worker/config.toml";
const DEFAULT_LOG_LEVEL: &str = "info";
const CONFIG_ENV: &str = "WORKER_CONFIG";
const LOG_LEVEL_ENV: &str = "WORKER_LOG_LEVEL";

#[derive(Debug)]
pub struct Cli {
    pub config: PathBuf,
    pub log_level: LogLevel,
    pub command: Commands,
}

#[derive(Debug)]
pub enum Commands {
    Start,
    Run { name: String },
    List,
}

impl Cli {
    pub fn parse() -> Result<Self> {
        Self::parse_from(
            env::args(),
            env::var(CONFIG_ENV).ok(),
            env::var(LOG_LEVEL_ENV).ok(),
        )
    }

    fn parse_from<I, S>(
        args: I,
        config_env: Option<String>,
        log_level_env: Option<String>,
    ) -> Result<Self>
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        let mut args = args.into_iter().map(Into::into);
        let _program = args.next();

        let command = match args.next().as_deref() {
            Some("start") => Commands::Start,
            Some("list") => Commands::List,
            Some("run") => {
                let name = args.next().context("用法: worker run <name>")?;
                Commands::Run { name }
            }
            Some(command) => {
                anyhow::bail!("未知命令: {}\n{}", command, usage());
            }
            None => {
                anyhow::bail!("{}", usage());
            }
        };

        if let Some(extra) = args.next() {
            anyhow::bail!("多余参数: {}\n{}", extra, usage());
        }

        let config = PathBuf::from(config_env.unwrap_or_else(|| DEFAULT_CONFIG_PATH.to_string()));
        let log_level = LogLevel::from_str(
            log_level_env
                .unwrap_or_else(|| DEFAULT_LOG_LEVEL.to_string())
                .as_str(),
        )
        .map_err(anyhow::Error::msg)?;

        Ok(Self {
            config,
            log_level,
            command,
        })
    }
}

fn usage() -> &'static str {
    "用法:\n  worker start\n  worker list\n  worker run <name>\n\n环境变量:\n  WORKER_CONFIG=worker/config.toml\n  WORKER_LOG_LEVEL=info"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_list_command() {
        let cli = Cli::parse_from(["worker", "list"], None, None).unwrap();

        assert!(matches!(cli.command, Commands::List));
    }

    #[test]
    fn parses_run_command() {
        let cli = Cli::parse_from(["worker", "run", "paused"], None, None).unwrap();

        assert!(matches!(cli.command, Commands::Run { name } if name == "paused"));
    }

    #[test]
    fn parses_start_command() {
        let cli = Cli::parse_from(["worker", "start"], None, None).unwrap();

        assert!(matches!(cli.command, Commands::Start));
    }

    #[test]
    fn rejects_missing_command() {
        let err = Cli::parse_from(["worker"], None, None).unwrap_err();

        assert!(err.to_string().contains("worker start"));
    }

    #[test]
    fn rejects_unknown_command() {
        let err = Cli::parse_from(["worker", "status"], None, None).unwrap_err();

        assert!(err.to_string().contains("未知命令: status"));
    }

    #[test]
    fn rejects_run_without_name() {
        let err = Cli::parse_from(["worker", "run"], None, None).unwrap_err();

        assert!(err.to_string().contains("worker run <name>"));
    }

    #[test]
    fn reads_env_defaults() {
        let cli = Cli::parse_from(
            ["worker", "list"],
            Some("custom/config.toml".to_string()),
            Some("debug".to_string()),
        )
        .unwrap();

        assert_eq!(cli.config, PathBuf::from("custom/config.toml"));
        assert_eq!(cli.log_level, LogLevel::Debug);
    }
}
