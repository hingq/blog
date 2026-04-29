use crate::config::{validate_config, AppConfig};
use crate::log::{log, LogLevel};
use crate::workspace::Workspace;
use anyhow::{Context, Result};
use std::collections::BTreeMap;
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
    validate_config(config)?;

    let mut resolved = Vec::with_capacity(config.jobs.len());
    for job in &config.jobs {
        let package = workspace
            .package(&job.package)
            .with_context(|| format!("任务 {} 引用了未知 package: {}", job.name, job.package))?;
        let binary_path = workspace.binary_path(package);
        if !binary_exists(&binary_path) {
            anyhow::bail!(
                "任务 {} 的二进制不存在: {}。请先运行: cargo build --release -p {}",
                job.name,
                binary_path.display(),
                job.package
            );
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::{AppConfig, JobConfig};
    use crate::workspace::WorkspacePackage;

    fn config_with(job: JobConfig) -> AppConfig {
        AppConfig { jobs: vec![job] }
    }

    fn job(name: &str, cron: &str, package: &str) -> JobConfig {
        JobConfig {
            name: name.to_string(),
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

        let err = resolve_jobs(&config, &workspace, |_| false).unwrap_err();

        assert!(err
            .to_string()
            .contains("cargo build --release -p leetcode-daily"));
    }
}
