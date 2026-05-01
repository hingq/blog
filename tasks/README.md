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

## 启动调度器

开发环境直接从 workspace 根目录运行：

```bash
cargo run -p worker -- start --foreground
```

`--foreground` 会以前台模式运行，适合本地调试，也适合交给 systemd、supervisor、pm2 等进程管理工具托管。开发模式下，调度器会自动执行 `cargo build --release -p <package>` 构建已启用任务。

后台启动：

```bash
cargo run -p worker -- start
```

后台模式会重新拉起当前 `worker` 可执行文件，并输出 pid、日志文件和锁文件位置。日志文件在系统临时目录，文件名为：

```bash
worker-scheduler.log
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
TASK_ENV=production target/release/worker --config worker/config.toml start --foreground
```

后台启动：

```bash
TASK_ENV=production target/release/worker --config worker/config.toml start
```

## 常用命令

查看已启用任务：

```bash
cargo run -p worker -- list
```

查看全部任务，包括已关闭任务：

```bash
cargo run -p worker -- list --all
```

手动执行一次任务：

```bash
cargo run -p worker -- run fetch_daily_info
```

手动执行已关闭任务：

```bash
cargo run -p worker -- run --include-disabled leetcode_daily
```

指定配置文件：

```bash
cargo run -p worker -- --config worker/config.toml list
```

指定日志级别：

```bash
cargo run -p worker -- --log-level debug start --foreground
```

可用日志级别：

- `error`
- `warn`
- `info`
- `debug`

## 停止调度器

前台模式用 `Ctrl+C` 停止。

后台模式启动后会打印 pid，可以用该 pid 停止：

```bash
kill <pid>
```

也可以通过锁文件查看当前 pid：

```bash
cat "$(dirname "$(mktemp -u)")/worker-scheduler.lock"
```

## 排查

查看后台日志：

```bash
tail -f "$(dirname "$(mktemp -u)")/worker-scheduler.log"
```

如果提示生产二进制不存在，检查：

- 是否设置了 `TASK_ENV=production`。
- `worker/config.toml` 的 `binary_dir` 是否正确。
- `binary_dir` 中是否存在对应 package 的二进制文件。

如果提示未知 package，检查 `package` 是否和 workspace 中的 Cargo package 名一致。

如果 cron 解析失败，检查 `cron` 字段是否为合法表达式。
