use anyhow::{Context, Result};
use croner::Cron;
use serde::Deserialize;
use std::collections::{BTreeMap, HashSet};
use std::path::{Path, PathBuf};

/// worker 的整体配置，对应 `worker/config.toml`。
#[derive(Debug, Deserialize)]
pub struct AppConfig {
    pub jobs: Vec<JobConfig>,
}

/// 单个定时任务的配置。
#[derive(Debug, Clone, Deserialize)]
pub struct JobConfig {
    /// 任务名称
    pub name: String,

    /// cron 表达式
    pub cron: String,

    /// workspace 中的 Cargo package 名
    pub package: String,

    /// 传给任务二进制的参数
    #[serde(default)]
    pub args: Vec<String>,

    /// 任务进程的环境变量
    #[serde(default)]
    pub env: BTreeMap<String, String>,

    /// 相对 package 目录的工作目录，默认 package 目录
    #[serde(default)]
    pub working_dir: Option<PathBuf>,
}

/// 从 TOML 文件读取并反序列化配置。
pub fn load_file(path: &Path) -> Result<AppConfig> {
    let content = std::fs::read_to_string(path)
        .with_context(|| format!("无法读取配置文件: {}", path.display()))?;
    let config: AppConfig = toml::from_str(&content)
        .with_context(|| format!("无法解析配置文件: {}", path.display()))?;
    Ok(config)
}

/// 校验配置是否满足运行条件。
///
/// 这里提前检查任务名、cron、package 等字段，避免调度器启动后才失败。
pub fn validate_config(config: &AppConfig) -> Result<()> {
    if config.jobs.is_empty() {
        anyhow::bail!("至少配置一个任务");
    }

    let mut names = HashSet::new();
    for job in &config.jobs {
        if job.name.trim().is_empty() {
            anyhow::bail!("任务名称不能为空");
        }
        if job.cron.trim().is_empty() {
            anyhow::bail!("任务 {} 的 cron 不能为空", job.name);
        }
        if job.package.trim().is_empty() {
            anyhow::bail!("任务 {} 的 package 不能为空", job.name);
        }
        if !names.insert(job.name.clone()) {
            anyhow::bail!("重复任务名: {}", job.name);
        }
        // 只解析 cron，不计算时间；能解析成功就说明表达式基本合法。
        Cron::new(&job.cron)
            .parse()
            .with_context(|| format!("非法 cron: {} ({})", job.name, job.cron))?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

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
    fn rejects_empty_jobs() {
        let err = validate_config(&AppConfig { jobs: Vec::new() }).unwrap_err();

        assert!(err.to_string().contains("至少配置一个任务"));
    }

    #[test]
    fn rejects_duplicate_job_names() {
        let config = AppConfig {
            jobs: vec![
                job("leetcode_daily", "0 8 * * *", "leetcode-daily"),
                job("leetcode_daily", "0 9 * * *", "fetch-daily-info"),
            ],
        };

        let err = validate_config(&config).unwrap_err();

        assert!(err.to_string().contains("重复任务名"));
    }

    #[test]
    fn rejects_invalid_cron() {
        let err = validate_config(&config_with(job(
            "leetcode_daily",
            "not a cron",
            "leetcode-daily",
        )))
        .unwrap_err();

        assert!(err.to_string().contains("非法 cron"));
    }
}
