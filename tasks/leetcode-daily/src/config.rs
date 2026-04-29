use anyhow::Result;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

/// 推断项目根目录。
///
/// 当程序从 `leetcode-daily` 子目录运行时，需要回到 workspace 根目录，
/// 这样后续写入 `data/blog`、读取 `.env` 时路径才一致。
pub fn project_root() -> Result<PathBuf> {
    let mut base_dir = env::current_dir()?;
    if base_dir.ends_with("leetcode-daily") {
        base_dir.pop();
        base_dir.pop();
    }

    Ok(base_dir)
}

/// LeetCode 每日任务的缓存根目录。
pub fn cache_root(project_root: &Path) -> PathBuf {
    project_root.join("data").join("leetcode-daily")
}

/// 解析 `.env` 文件中的一行。
///
/// 支持 `KEY=value`、空行和注释；返回 `None` 表示这一行不需要设置环境变量。
pub fn parse_env_line(line: &str) -> Option<(&str, &str)> {
    let line = line.trim();
    if line.is_empty() || line.starts_with('#') {
        return None;
    }

    let (key, value) = line.split_once('=')?;
    Some((
        key.trim(),
        value.trim().trim_matches('"').trim_matches('\''),
    ))
}

/// 加载本地 `.env` 文件。
///
/// 如果同名环境变量已经存在，就保留已有值，避免覆盖 CI 或命令行传入的配置。
pub fn load_dotenv(path: &Path) -> Result<()> {
    if !path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(path)?;
    for line in content.lines() {
        if let Some((key, value)) = parse_env_line(line) {
            if env::var_os(key).is_none() {
                env::set_var(key, value);
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_env_line() {
        assert_eq!(
            parse_env_line("GEMINI_API_KEY=abc123"),
            Some(("GEMINI_API_KEY", "abc123"))
        );
        assert_eq!(
            parse_env_line(" EMAIL_USER = \"me@example.com\" "),
            Some(("EMAIL_USER", "me@example.com"))
        );
        assert_eq!(parse_env_line("# comment"), None);
        assert_eq!(parse_env_line(""), None);
    }

    #[test]
    fn builds_cache_root() {
        assert_eq!(
            cache_root(Path::new("/repo")),
            Path::new("/repo").join("data").join("leetcode-daily")
        );
    }
}
