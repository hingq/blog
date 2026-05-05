# Tasks 调度器

本目录是一个 Rust workspace，包含定时任务包和 `worker` 调度器。调度器根据 `worker/config.toml` 中的任务配置启动任务，也支持手动执行单个任务和查看任务列表。

## 目录结构

- `worker/`: 调度器 CLI。
- `fetch-daily-info/`: 每日信息抓取任务。
- `leetcode-daily/`: LeetCode 每日题任务。
- `worker/config.toml`: 当前调度配置。
- `worker/config.example.toml`: 配置示例。

## 配置

默认配置文件路径是 `worker/config.toml`。可以复制示例后修改：

```bash
cp worker/config.example.toml worker/config.toml
```

配置示例：

```toml
binary_dir = "/blog/tasks/packages"

[[jobs]]
name = "fetch_daily_info"
enabled = true
cron = "30 8 * * *"
package = "fetch-daily-info"
args = []
```

字段说明：

- `binary_dir`: 生产模式使用的任务二进制目录；开发模式会忽略。
- `name`: 任务名称，用于 `run` 命令手动执行。
- `enabled`: 是否启用任务；未设置时默认启用。
- `cron`: cron 表达式，按本机时区计算下一次执行时间。
- `package`: workspace 中的 Cargo package 名称。
- `args`: 传给任务二进制的命令行参数。
- `env`: 可选，任务进程环境变量。
- `working_dir`: 可选，任务运行目录；相对路径以 package 目录为基准。

## Worker 命令

`worker` 的命令都使用位置参数，不需要加 `--` 分隔 Cargo 参数：

```bash
cargo run -p worker start
cargo run -p worker list
cargo run -p worker run fetch_daily_info
```

可用命令：

- `start`: 启动调度器。
- `list`: 列出全部配置任务，并显示 `enabled` 或 `disabled` 状态。
- `run <name>`: 立即执行一次已启用任务。

低频设置使用环境变量：

- `WORKER_CONFIG`: 配置文件路径，默认 `worker/config.toml`。
- `WORKER_LOG_LEVEL`: 日志级别，默认 `info`，可选 `error`、`warn`、`info`、`debug`。
- `TASK_ENV`: 运行环境；设置为 `production` 时从 `binary_dir` 查找任务二进制，否则开发模式会自动构建已启用任务。

## 启动调度器

开发环境从 `tasks/` workspace 根目录运行：

```bash
cargo run -p worker start
```

`start` 会以前台模式运行，适合本地调试，也适合交给 systemd、supervisor、pm2 等进程管理工具托管。开发模式下，调度器会自动执行 `cargo build --release -p <package>` 构建已启用任务。

如果当前目录是仓库根目录，需要显式指定 `tasks/Cargo.toml`：

```bash
cargo run --manifest-path tasks/Cargo.toml -p worker start
```

锁文件也在系统临时目录，文件名为：

```bash
worker-scheduler.lock
```

同一时间只允许一个调度器实例运行；如果锁已被占用，启动会失败并提示调度器已在运行。

## 生产环境启动

生产环境需要先构建并部署任务二进制到 `binary_dir`：

```bash
cargo build --release -p worker
cargo build --release -p fetch-daily-info
cargo build --release -p leetcode-daily
```

将任务二进制复制到 `worker/config.toml` 中的 `binary_dir`，例如：

```bash
mkdir -p /blog/tasks/packages
cp target/release/fetch-daily-info /blog/tasks/packages/
cp target/release/leetcode-daily /blog/tasks/packages/
```

然后以生产模式启动：

```bash
TASK_ENV=production target/release/worker start
```

## 常用命令

本节命令默认在 `tasks/` 目录执行。如果在仓库根目录执行，给 Cargo 命令加上 `--manifest-path tasks/Cargo.toml`，例如：

```bash
cargo test --manifest-path tasks/Cargo.toml -p leetcode-daily
cargo clippy --manifest-path tasks/Cargo.toml -p leetcode-daily --all-targets -- -D warnings
cargo run --manifest-path tasks/Cargo.toml -p leetcode-daily --release
```

查看全部任务：

```bash
cargo run -p worker list
```

输出会带上 `enabled` 或 `disabled` 状态。`list` 只读取配置，不会触发构建任务二进制。

手动执行一次已启用任务：

```bash
cargo run -p worker run fetch_daily_info
```

指定配置文件：

```bash
WORKER_CONFIG=worker/config.toml cargo run -p worker list
```

指定日志级别：

```bash
WORKER_LOG_LEVEL=debug cargo run -p worker start
```

生产环境指定配置文件：

```bash
WORKER_CONFIG=worker/config.toml TASK_ENV=production target/release/worker start
```

## 停止调度器

前台运行时用 `Ctrl+C` 停止。交给 systemd、supervisor、pm2 等进程管理工具托管时，由对应工具停止进程。

也可以通过锁文件查看当前 pid：

```bash
cat "$(dirname "$(mktemp -u)")/worker-scheduler.lock"
```

## 排查

如果提示生产二进制不存在，检查：

- 是否设置了 `TASK_ENV=production`。
- `worker/config.toml` 的 `binary_dir` 是否正确。
- `binary_dir` 中是否存在对应 package 的二进制文件。

如果提示未知 package，检查 `package` 是否和 workspace 中的 Cargo package 名一致。

如果 cron 解析失败，检查 `cron` 字段是否为合法表达式。
