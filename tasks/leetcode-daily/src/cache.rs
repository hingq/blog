use anyhow::{Context, Result};
use serde::de::DeserializeOwned;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

/// 当天题目缓存路径，例如 `data/leetcode-daily/questions/2026-04-29.json`。
pub fn question_cache_path(cache_root: &Path, date: &str) -> PathBuf {
    cache_root.join("questions").join(format!("{date}.json"))
}

/// 当天题解缓存路径，例如 `data/leetcode-daily/solutions/2026-04-29.json`。
pub fn solution_cache_path(cache_root: &Path, date: &str) -> PathBuf {
    cache_root.join("solutions").join(format!("{date}.json"))
}

/// 读取 JSON 缓存。
///
/// 返回 `Ok(None)` 表示文件不存在；返回 `Ok(Some(value))` 表示读取并解析成功。
pub fn read_json<T: DeserializeOwned>(path: &Path) -> Result<Option<T>> {
    if !path.exists() {
        return Ok(None);
    }

    let content =
        fs::read_to_string(path).with_context(|| format!("读取缓存失败: {}", path.display()))?;
    let value = serde_json::from_str(&content)
        .with_context(|| format!("解析缓存 JSON 失败: {}", path.display()))?;

    Ok(Some(value))
}

/// 将任意可序列化的值写入 JSON 缓存。
///
/// 泛型约束 `T: Serialize` 表示 `value` 必须能被 `serde_json` 转成 JSON。
pub fn write_json<T: Serialize>(path: &Path, value: &T) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("创建缓存目录失败: {}", parent.display()))?;
    }

    let content = serde_json::to_string_pretty(value)?;
    fs::write(path, content).with_context(|| format!("写入缓存失败: {}", path.display()))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Deserialize, PartialEq, Serialize)]
    struct Example {
        value: String,
    }

    #[test]
    fn builds_separate_cache_paths() {
        let root = Path::new("/repo/data/leetcode-daily");

        assert_eq!(
            question_cache_path(root, "2026-04-28"),
            Path::new("/repo/data/leetcode-daily/questions/2026-04-28.json")
        );
        assert_eq!(
            solution_cache_path(root, "2026-04-28"),
            Path::new("/repo/data/leetcode-daily/solutions/2026-04-28.json")
        );
    }

    #[test]
    fn round_trips_json_cache() {
        let dir =
            std::env::temp_dir().join(format!("leetcode-daily-cache-test-{}", std::process::id()));
        let path = dir.join("nested").join("cache.json");
        let expected = Example {
            value: "cached".to_string(),
        };

        write_json(&path, &expected).unwrap();
        let actual: Option<Example> = read_json(&path).unwrap();

        assert_eq!(actual, Some(expected));
        let _ = fs::remove_dir_all(dir);
    }
}
