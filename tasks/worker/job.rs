use crate::config::{validate_config, AppConfig, JobConfig};
use crate::log::{log, LogLevel};
use crate::workspace::Workspace;
use anyhow::{Context, Result};
use std::collections::{BTreeMap, BTreeSet};
use std::env;
use std::path::{Path, PathBuf};
use std::process::Command;

/// 已解析完成、可以直接运行的任务。
///
/// 相比配置文件中的 `JobConfig`，这里已经补全了二进制路径和工作目录。
#[derive(Debug, Clone)]
pub struct ResolvedJob {
    pub name: String,
    pub cron: String,
    pub package: String,
    pub binary_path: PathBuf,
    pub working_dir: PathBuf,
    pub args: Vec<String>,
    pub env: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuntimeMode {
    Development,
    Production,
}

impl RuntimeMode {
    pub fn from_env() -> Self {
        if env::var("TASK_ENV")
            .map(|value| value == "production")
            .unwrap_or(false)
        {
            Self::Production
        } else {
            Self::Development
        }
    }
}

/// 把配置文件里的任务转换成可执行任务。
///
/// `binary_exists` 作为参数传入，是为了单元测试可以替换真实文件系统检查。
pub fn resolve_jobs<F>(
    config: &AppConfig,
    workspace: &Workspace,
    binary_exists: F,
) -> Result<Vec<ResolvedJob>>
where
    F: Fn(&Path) -> bool,
{
    let mode = RuntimeMode::from_env();
    resolve_jobs_for_mode(config, workspace, mode, binary_exists, |package| {
        build_package(workspace, package)
    })
}

pub fn resolve_jobs_for_mode<F, B>(
    config: &AppConfig,
    workspace: &Workspace,
    mode: RuntimeMode,
    binary_exists: F,
    mut build_package: B,
) -> Result<Vec<ResolvedJob>>
where
    F: Fn(&Path) -> bool,
    B: FnMut(&str) -> Result<()>,
{
    validate_config(config)?;

    let enabled_jobs = config
        .jobs
        .iter()
        .filter(|job| job.enabled)
        .collect::<Vec<_>>();

    if mode == RuntimeMode::Development {
        let mut packages = BTreeSet::new();
        for job in &enabled_jobs {
            packages.insert(job.package.as_str());
        }
        for package in packages {
            build_package(package)?;
        }
    }

    let binary_dir = if mode == RuntimeMode::Production {
        Some(
            config
                .binary_dir
                .as_ref()
                .context("生产模式需要在配置中设置 binary_dir")?,
        )
    } else {
        None
    };

    let mut resolved = Vec::with_capacity(enabled_jobs.len());
    for job in enabled_jobs {
        let package = workspace
            .package(&job.package)
            .with_context(|| format!("任务 {} 引用了未知 package: {}", job.name, job.package))?;
        let binary_path = match binary_dir {
            Some(binary_dir) => {
                let binary_name = format!("{}{}", package.bin_name, std::env::consts::EXE_SUFFIX);
                binary_dir.join(binary_name)
            }
            None => workspace.binary_path(package),
        };
        if !binary_exists(&binary_path) {
            match mode {
                RuntimeMode::Development => {
                    anyhow::bail!(
                        "任务 {} 的二进制不存在: {}。请先运行: cargo build --release -p {}",
                        job.name,
                        binary_path.display(),
                        job.package
                    );
                }
                RuntimeMode::Production => {
                    anyhow::bail!(
                        "任务 {} 的生产二进制不存在: {}。请上传对应二进制到 binary_dir",
                        job.name,
                        binary_path.display()
                    );
                }
            }
        }
        // working_dir 支持绝对路径和相对路径；相对路径以 package 目录为基准。
        let working_dir = match &job.working_dir {
            Some(path) if path.is_absolute() => path.clone(),
            Some(path) => package.package_dir.join(path),
            None => package.package_dir.clone(),
        };

        resolved.push(ResolvedJob {
            name: job.name.clone(),
            cron: job.cron.clone(),
            package: job.package.clone(),
            binary_path,
            working_dir,
            args: job.args.clone(),
            env: job.env.clone(),
        });
    }

    Ok(resolved)
}

fn build_package(workspace: &Workspace, package: &str) -> Result<()> {
    let status = Command::new("cargo")
        .args(["build", "--release", "-p", package])
        .current_dir(workspace.root())
        .status()
        .with_context(|| format!("无法构建任务 package: {}", package))?;

    if status.success() {
        Ok(())
    } else {
        anyhow::bail!("构建任务 package 失败: {} ({})", package, status)
    }
}

/// 立即执行一次任务，并等待子进程退出。
pub fn run_job_once(job: &ResolvedJob, level: LogLevel) -> Result<()> {
    log(
        level,
        LogLevel::Info,
        &format!("开始执行任务: {}", job.name),
    );
    let status = Command::new(&job.binary_path)
        .args(&job.args)
        .envs(&job.env)
        .current_dir(&job.working_dir)
        .status()
        .with_context(|| format!("无法启动任务: {}", job.name))?;

    if status.success() {
        log(
            level,
            LogLevel::Info,
            &format!("任务执行成功: {}", job.name),
        );
        Ok(())
    } else {
        anyhow::bail!("任务 {} 退出失败: {}", job.name, status)
    }
}

/// 以制表符分隔输出任务列表，便于终端查看或脚本处理。
pub fn list_jobs(jobs: &[ResolvedJob]) {
    for job in jobs {
        println!(
            "{}\t{}\t{}\t{}",
            job.name,
            job.cron,
            job.package,
            job.binary_path.display()
        );
    }
}

pub fn list_config_jobs(jobs: &[JobConfig]) {
    for job in jobs {
        let status = if job.enabled { "enabled" } else { "disabled" };
        println!("{}\t{}\t{}\t{}", status, job.name, job.cron, job.package);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::{AppConfig, JobConfig};
    use crate::workspace::WorkspacePackage;

    fn config_with(job: JobConfig) -> AppConfig {
        AppConfig {
            binary_dir: None,
            jobs: vec![job],
        }
    }

    fn job(name: &str, cron: &str, package: &str) -> JobConfig {
        JobConfig {
            name: name.to_string(),
            enabled: true,
            cron: cron.to_string(),
            package: package.to_string(),
            args: Vec::new(),
            env: Default::default(),
            working_dir: None,
        }
    }

    #[test]
    fn missing_binary_error_mentions_release_build_command() {
        let config = config_with(job("leetcode_daily", "0 8 * * *", "leetcode-daily"));
        let workspace = Workspace::new_for_test(
            PathBuf::from("/repo"),
            vec![WorkspacePackage {
                name: "leetcode-daily".to_string(),
                bin_name: "leetcode-daily".to_string(),
                package_dir: PathBuf::from("/repo/leetcode-daily"),
            }],
        );

        let err = resolve_jobs_for_mode(
            &config,
            &workspace,
            RuntimeMode::Development,
            |_| false,
            |_| Ok(()),
        )
        .unwrap_err();

        assert!(err
            .to_string()
            .contains("cargo build --release -p leetcode-daily"));
    }

    #[test]
    fn production_mode_uses_configured_binary_dir() {
        let mut config = config_with(job("fetch_daily_info", "30 8 * * *", "fetch-daily-info"));
        config.binary_dir = Some(PathBuf::from("/blog/tasks/packages"));
        let workspace = Workspace::new_for_test(
            PathBuf::from("/repo"),
            vec![WorkspacePackage {
                name: "fetch-daily-info".to_string(),
                bin_name: "fetcher".to_string(),
                package_dir: PathBuf::from("/repo/fetch-daily-info"),
            }],
        );

        let jobs = resolve_jobs_for_mode(
            &config,
            &workspace,
            RuntimeMode::Production,
            |_| true,
            |_| Ok(()),
        )
        .unwrap();

        assert_eq!(
            jobs[0].binary_path,
            PathBuf::from("/blog/tasks/packages/fetcher")
        );
    }

    #[test]
    fn production_mode_requires_binary_dir() {
        let config = config_with(job("leetcode_daily", "0 8 * * *", "leetcode-daily"));
        let workspace = Workspace::new_for_test(
            PathBuf::from("/repo"),
            vec![WorkspacePackage {
                name: "leetcode-daily".to_string(),
                bin_name: "leetcode-daily".to_string(),
                package_dir: PathBuf::from("/repo/leetcode-daily"),
            }],
        );

        let err = resolve_jobs_for_mode(
            &config,
            &workspace,
            RuntimeMode::Production,
            |_| true,
            |_| Ok(()),
        )
        .unwrap_err();

        assert!(err.to_string().contains("binary_dir"));
    }

    #[test]
    fn production_mode_does_not_build_packages() {
        let mut config = config_with(job("leetcode_daily", "0 8 * * *", "leetcode-daily"));
        config.binary_dir = Some(PathBuf::from("/blog/tasks/packages"));
        let workspace = Workspace::new_for_test(
            PathBuf::from("/repo"),
            vec![WorkspacePackage {
                name: "leetcode-daily".to_string(),
                bin_name: "leetcode-daily".to_string(),
                package_dir: PathBuf::from("/repo/leetcode-daily"),
            }],
        );
        let mut build_called = false;

        resolve_jobs_for_mode(
            &config,
            &workspace,
            RuntimeMode::Production,
            |_| true,
            |_| {
                build_called = true;
                Ok(())
            },
        )
        .unwrap();

        assert!(!build_called);
    }

    #[test]
    fn production_missing_binary_mentions_upload() {
        let mut config = config_with(job("leetcode_daily", "0 8 * * *", "leetcode-daily"));
        config.binary_dir = Some(PathBuf::from("/blog/tasks/packages"));
        let workspace = Workspace::new_for_test(
            PathBuf::from("/repo"),
            vec![WorkspacePackage {
                name: "leetcode-daily".to_string(),
                bin_name: "leetcode-daily".to_string(),
                package_dir: PathBuf::from("/repo/leetcode-daily"),
            }],
        );

        let err = resolve_jobs_for_mode(
            &config,
            &workspace,
            RuntimeMode::Production,
            |_| false,
            |_| Ok(()),
        )
        .unwrap_err();

        assert!(err.to_string().contains("上传对应二进制"));
    }

    #[test]
    fn development_mode_builds_enabled_packages_once() {
        let config = AppConfig {
            binary_dir: Some(PathBuf::from("/ignored/in/dev")),
            jobs: vec![
                job("leetcode_morning", "0 8 * * *", "leetcode-daily"),
                job("leetcode_manual", "0 9 * * *", "leetcode-daily"),
            ],
        };
        let workspace = Workspace::new_for_test(
            PathBuf::from("/repo"),
            vec![WorkspacePackage {
                name: "leetcode-daily".to_string(),
                bin_name: "leetcode-daily".to_string(),
                package_dir: PathBuf::from("/repo/leetcode-daily"),
            }],
        );
        let mut built = Vec::new();

        let jobs = resolve_jobs_for_mode(
            &config,
            &workspace,
            RuntimeMode::Development,
            |_| true,
            |package| {
                built.push(package.to_string());
                Ok(())
            },
        )
        .unwrap();

        assert_eq!(built, vec!["leetcode-daily".to_string()]);
        assert_eq!(jobs.len(), 2);
        assert_eq!(
            jobs[0].binary_path,
            PathBuf::from("/repo/target/release/leetcode-daily")
        );
    }

    #[test]
    fn disabled_jobs_are_not_resolved_or_built() {
        let mut disabled = job("paused", "", "");
        disabled.enabled = false;
        let config = config_with(disabled);
        let workspace = Workspace::new_for_test(PathBuf::from("/repo"), Vec::new());
        let mut build_called = false;

        let jobs = resolve_jobs_for_mode(
            &config,
            &workspace,
            RuntimeMode::Development,
            |_| false,
            |_| {
                build_called = true;
                Ok(())
            },
        )
        .unwrap();

        assert!(jobs.is_empty());
        assert!(!build_called);
    }
}
