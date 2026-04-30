use anyhow::{Context, Result};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// workspace 中一个 Cargo package 的关键信息。
#[derive(Debug, Clone)]
pub struct WorkspacePackage {
    pub name: String,
    pub bin_name: String,
    pub package_dir: PathBuf,
}

/// Cargo workspace 的索引。
///
/// `packages` 用 package 名作为 key，方便任务配置通过名称找到对应 package。
#[derive(Debug)]
pub struct Workspace {
    root: PathBuf,
    packages: HashMap<String, WorkspacePackage>,
}

impl Workspace {
    /// 从当前目录向上寻找 Cargo workspace，并读取所有成员 package。
    pub fn load_from_current_dir() -> Result<Self> {
        let current_dir = std::env::current_dir().context("无法读取当前目录")?;
        let root = find_workspace_root(&current_dir)?;
        let manifest_path = root.join("Cargo.toml");
        let manifest_text = std::fs::read_to_string(&manifest_path)
            .with_context(|| format!("无法读取 workspace manifest: {}", manifest_path.display()))?;

        Self::from_manifest_text(root, &manifest_text, |member_manifest| {
            std::fs::read_to_string(member_manifest).ok()
        })
    }

    /// 从 workspace manifest 文本构建索引。
    ///
    /// `read_member` 由调用方提供，测试时可以直接返回字符串，生产环境则读取文件。
    pub fn from_manifest_text<F>(root: PathBuf, manifest_text: &str, read_member: F) -> Result<Self>
    where
        F: Fn(&str) -> Option<String>,
    {
        let manifest: toml::Value =
            toml::from_str(manifest_text).context("无法解析 workspace Cargo.toml")?;
        let members = manifest
            .get("workspace")
            .and_then(|workspace| workspace.get("members"))
            .and_then(toml::Value::as_array)
            .context("Cargo.toml 缺少 [workspace].members")?;

        let mut packages = HashMap::new();
        for member in members {
            let member = member
                .as_str()
                .context("workspace member 必须是字符串路径")?;
            if member.contains('*') {
                anyhow::bail!("暂不支持通配符 workspace member: {}", member);
            }

            let manifest_path = format!("{}/Cargo.toml", member.trim_end_matches('/'));
            let member_text = read_member(&manifest_path)
                .with_context(|| format!("无法读取 package manifest: {}", manifest_path))?;
            let package = parse_package_manifest(&root, member, &member_text)
                .with_context(|| format!("无法解析 package manifest: {}", manifest_path))?;

            packages.insert(package.name.clone(), package);
        }

        Ok(Self { root, packages })
    }

    #[cfg(test)]
    pub fn new_for_test(root: PathBuf, packages: Vec<WorkspacePackage>) -> Self {
        Self {
            root,
            packages: packages
                .into_iter()
                .map(|package| (package.name.clone(), package))
                .collect(),
        }
    }

    pub fn package(&self, package: &str) -> Option<&WorkspacePackage> {
        self.packages.get(package)
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    /// release 构建后的二进制路径。
    pub fn binary_path(&self, package: &WorkspacePackage) -> PathBuf {
        let binary_name = format!("{}{}", package.bin_name, std::env::consts::EXE_SUFFIX);
        self.root.join("target").join("release").join(binary_name)
    }
}

/// 从起始目录逐级向上寻找带 `[workspace]` 的 `Cargo.toml`。
fn find_workspace_root(start: &Path) -> Result<PathBuf> {
    for dir in start.ancestors() {
        let manifest = dir.join("Cargo.toml");
        if !manifest.exists() {
            continue;
        }

        let text = std::fs::read_to_string(&manifest)
            .with_context(|| format!("无法读取 manifest: {}", manifest.display()))?;
        let value: toml::Value = toml::from_str(&text)
            .with_context(|| format!("无法解析 manifest: {}", manifest.display()))?;
        if value.get("workspace").is_some() {
            return Ok(dir.to_path_buf());
        }
    }

    anyhow::bail!("从 {} 向上未找到 Cargo workspace", start.display())
}

/// 解析单个 package 的 `Cargo.toml`。
fn parse_package_manifest(
    root: &Path,
    member: &str,
    manifest_text: &str,
) -> Result<WorkspacePackage> {
    let manifest: toml::Value = toml::from_str(manifest_text)?;
    let name = manifest
        .get("package")
        .and_then(|package| package.get("name"))
        .and_then(toml::Value::as_str)
        .context("package.name 不能为空")?
        .to_string();
    let bin_name = manifest
        .get("bin")
        .and_then(toml::Value::as_array)
        .and_then(|bins| bins.first())
        .and_then(|bin| bin.get("name"))
        .and_then(toml::Value::as_str)
        .unwrap_or(&name)
        .to_string();
    let package_dir = root.join(member);

    Ok(WorkspacePackage {
        name,
        bin_name,
        package_dir,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_workspace_members_from_manifest_text() {
        let workspace = Workspace::from_manifest_text(
            PathBuf::from("/repo"),
            r#"
            [workspace]
            members = ["leetcode-daily", "fetch-daily-info"]
            "#,
            |member| match member {
                "leetcode-daily/Cargo.toml" => Some(
                    r#"
                    [package]
                    name = "leetcode-daily"
                    version = "0.1.0"
                    edition = "2021"
                    "#
                    .to_string(),
                ),
                "fetch-daily-info/Cargo.toml" => Some(
                    r#"
                    [package]
                    name = "fetch-daily-info"
                    version = "0.1.0"
                    edition = "2021"

                    [[bin]]
                    name = "fetcher"
                    path = "src/main.rs"
                    "#
                    .to_string(),
                ),
                _ => None,
            },
        )
        .unwrap();

        let leetcode = workspace.package("leetcode-daily").unwrap();
        assert_eq!(leetcode.bin_name, "leetcode-daily");
        assert_eq!(
            workspace.binary_path(leetcode),
            PathBuf::from("/repo/target/release/leetcode-daily")
        );

        let fetcher = workspace.package("fetch-daily-info").unwrap();
        assert_eq!(fetcher.bin_name, "fetcher");
    }
}
