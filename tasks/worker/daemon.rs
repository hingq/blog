use anyhow::{Context, Result};
use std::fs::{File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

pub fn lock_path_for_config(config_path: &Path) -> PathBuf {
    let _ = config_path;
    std::env::temp_dir().join("worker-scheduler.lock")
}

pub struct SchedulerLock {
    _file: File,
}

impl SchedulerLock {
    pub fn acquire(lock_path: &Path) -> Result<Self> {
        let mut file = OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(lock_path)
            .with_context(|| format!("无法打开调度器锁文件: {}", lock_path.display()))?;

        #[cfg(unix)]
        {
            let result = unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) };
            if result != 0 {
                anyhow::bail!("调度器已在运行，锁文件: {}", lock_path.display());
            }
        }

        file.set_len(0)
            .with_context(|| format!("无法清空调度器锁文件: {}", lock_path.display()))?;
        writeln!(file, "{}", std::process::id())
            .with_context(|| format!("无法写入调度器锁文件: {}", lock_path.display()))?;

        Ok(Self { _file: file })
    }
}

#[cfg(unix)]
use std::os::fd::AsRawFd;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lock_path_is_global_for_all_configs() {
        let first = lock_path_for_config(Path::new("/repo/worker/config.toml"));
        let second = lock_path_for_config(Path::new("/repo/worker/config.toml"));
        let other = lock_path_for_config(Path::new("/repo/other/config.toml"));

        assert_eq!(first, second);
        assert_eq!(first, other);
        assert!(first.starts_with(std::env::temp_dir()));
    }
}
