use crate::log::LogLevel;
use anyhow::{Context, Result};
use std::fs::{File, OpenOptions};
use std::io::Write;
#[cfg(unix)]
use std::os::unix::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

pub fn lock_path_for_config(config_path: &Path) -> PathBuf {
    let _ = config_path;
    std::env::temp_dir().join("worker-scheduler.lock")
}

pub fn log_path_for_config(config_path: &Path) -> PathBuf {
    let _ = config_path;
    std::env::temp_dir().join("worker-scheduler.log")
}

pub struct SchedulerLock {
    _file: File,
}

impl SchedulerLock {
    pub fn acquire(lock_path: &Path) -> Result<Self> {
        let mut file = OpenOptions::new()
            .create(true)
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

pub fn spawn_background(config_path: &Path, log_level: LogLevel) -> Result<()> {
    let exe = std::env::current_exe().context("无法定位当前 worker 可执行文件")?;
    let log_path = log_path_for_config(config_path);
    let stdout = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .with_context(|| format!("无法打开 worker 日志文件: {}", log_path.display()))?;
    let stderr = stdout
        .try_clone()
        .with_context(|| format!("无法复用 worker 日志文件: {}", log_path.display()))?;

    let mut command = Command::new(exe);
    command
        .arg("--config")
        .arg(config_path)
        .arg("--log-level")
        .arg(log_level.as_str())
        .arg("start")
        .arg("--foreground")
        .stdin(Stdio::null())
        .stdout(Stdio::from(stdout))
        .stderr(Stdio::from(stderr));

    #[cfg(unix)]
    unsafe {
        command.pre_exec(|| {
            if libc::setsid() == -1 {
                return Err(std::io::Error::last_os_error());
            }
            Ok(())
        });
    }

    let child = command.spawn().context("无法后台启动 worker 调度器")?;
    println!(
        "worker 调度器已后台启动，pid: {}，日志: {}，锁: {}",
        child.id(),
        log_path.display(),
        lock_path_for_config(config_path).display()
    );

    Ok(())
}

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

    #[test]
    fn log_path_matches_lock_path_stem() {
        let config = Path::new("/repo/worker/config.toml");
        let lock = lock_path_for_config(config);
        let log = log_path_for_config(config);

        assert_eq!(
            lock.file_stem().unwrap().to_string_lossy(),
            log.file_stem().unwrap().to_string_lossy()
        );
        assert_eq!(log.extension().unwrap(), "log");
    }
}
