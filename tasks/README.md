# Tasks 调度器

`tasks/` 使用 TypeScript/Node.js 实现，包含一个通用 worker 调度器和多个任务。构建后会生成发布包 `tasks/dist/`，调度器入口在包根目录，具体任务入口放在 `tasks/dist/tasks/`。

## 目录结构

- `worker/`: 调度器 CLI，负责读取配置、按 cron 触发任务、手动运行任务和查看状态。
- `leetcode-daily/`: LeetCode 每日题任务。
- `fetch-daily-info/`: 每日信息抓取任务。
- `worker/config.json`: 当前调度配置。
- `worker/config.example.json`: 配置示例。
- `dist/`: 构建产物，包含 `worker.cjs`、打包后的配置文件和 `tasks/` 任务入口目录。

## 配置

源码配置文件路径是 `tasks/worker/config.json`。构建后会复制到 `tasks/dist/config.json`，打包入口默认读取这个包内配置。构建后的配置会把任务入口参数改写为 `tasks/<entry>.cjs`，指向 `tasks/dist/tasks/`。

```bash
cp tasks/worker/config.example.json tasks/worker/config.json
```

配置示例：

```json
{
  "jobs": [
    {
      "name": "leetcode_daily",
      "enabled": true,
      "cron": "0 8 * * *",
      "command": "node",
      "args": ["leetcode-daily.cjs"],
      "cwd": ".",
      "env": {},
      "timeoutMs": 300000
    }
  ]
}
```

字段说明：

- `name`: 任务名称，用于 `run` 命令手动执行。
- `enabled`: 是否启用；未设置时默认启用。
- `cron`: cron 表达式，按本机时区计算下一次执行时间。
- `command`: 要执行的命令。
- `args`: 传给命令的参数；相对路径以配置文件所在目录为基准。源码配置可使用任务入口文件名，构建后的配置会使用 `tasks/<entry>.cjs` 适配 `tasks/dist` 包。
- `cwd`: 任务工作目录；相对路径以仓库根目录为基准。
- `env`: 可选，任务进程环境变量。
- `timeoutMs`: 可选，任务超时时间，单位毫秒。

## 常用命令

命令默认在仓库根目录执行：

```bash
yarn tasks:build
yarn worker list
yarn worker status
yarn worker run leetcode_daily
yarn worker start
```

也可以直接执行 worker：

```bash
node tasks/worker/bin/worker.cjs list
node tasks/worker/bin/worker.cjs run leetcode_daily
node tasks/worker/bin/worker.cjs start
```

构建后也可以直接运行发布包：

```bash
node tasks/dist/worker.cjs list
node tasks/dist/worker.cjs run fetch_daily_info
node tasks/dist/worker.cjs start
```

如果把 `tasks/dist/` 拷贝到仓库外运行，并且任务需要读写博客内容或 `.env`，请设置 `TASKS_PROJECT_ROOT` 指向项目根目录。

指定配置文件：

```bash
yarn worker list --config tasks/worker/config.example.json
```

指定日志级别：

```bash
yarn worker start --log-level debug
```

## Worker 命令

- `start`: 启动调度器。
- `list`: 列出已启用任务；加 `--all` 可显示已关闭任务。
- `status`: 查看任务运行状态；加 `--json` 可输出 JSON。
- `run <name>`: 立即执行一次已启用任务。

同一配置文件同一时间只允许一个调度器实例运行；锁文件位于系统临时目录，名称会基于配置文件路径生成。

## 校验

```bash
yarn tasks:check
yarn tasks:lint
yarn test:tasks
```
