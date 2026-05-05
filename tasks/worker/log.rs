/// 日志级别从严重到详细排列。
///
/// 派生 `PartialOrd` 后，可以用 `level <= configured` 判断某条日志是否应该输出。
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum LogLevel {
    Error,
    Warn,
    Info,
    Debug,
}

impl std::str::FromStr for LogLevel {
    type Err = String;

    fn from_str(value: &str) -> std::result::Result<Self, Self::Err> {
        match value {
            "error" => Ok(Self::Error),
            "warn" => Ok(Self::Warn),
            "info" => Ok(Self::Info),
            "debug" => Ok(Self::Debug),
            _ => Err("日志级别必须是 error, warn, info, debug".to_string()),
        }
    }
}

/// 简单日志函数。
///
/// `configured` 是用户选择的日志级别，`level` 是当前消息的级别。
pub fn log(configured: LogLevel, level: LogLevel, message: &str) {
    if level <= configured {
        eprintln!("[{:?}] {}", level, message);
    }
}
