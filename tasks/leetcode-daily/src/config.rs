use anyhow::Result;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

pub fn project_root() -> Result<PathBuf> {
    let mut base_dir = env::current_dir()?;
    if base_dir.ends_with("leetcode-daily") {
        base_dir.pop();
        base_dir.pop();
    }

    Ok(base_dir)
}

pub fn cache_root(project_root: &Path) -> PathBuf {
    project_root.join("data").join("leetcode-daily")
}

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
