#!/usr/bin/env node
import { Command } from 'commander'
import { loadConfig } from './config'
import { acquireLock } from './lock'
import { createLogger, normalizeLogLevel } from './log'
import { defaultConfigPath, lockPathForConfig, statePathForConfig } from './paths'
import { runTask } from './runner'
import { startScheduler } from './scheduler'
import { readState } from './state'
import type { LogLevel } from './types'

export type ParsedCli = {
  config: string
  logLevel: LogLevel
  command: 'start' | 'run' | 'list' | 'status'
  name?: string
  all?: boolean
  outputJson?: boolean
}

export function parseCli(argv: string[]): ParsedCli {
  let parsed: ParsedCli | undefined
  const program = createProgram((cli) => {
    parsed = cli
  })
  program.exitOverride()
  program.parse(argv)
  if (!parsed) throw new Error('命令必须是 start, run, list, status')
  return parsed
}

function baseOptions(
  root: { opts: () => Record<string, unknown> },
  command?: { opts: () => Record<string, unknown> }
) {
  const rootOptions = root.opts()
  const commandOptions = command?.opts() ?? {}
  return {
    config: (commandOptions.config as string | undefined) ?? (rootOptions.config as string),
    logLevel: normalizeLogLevel(
      ((commandOptions.logLevel as string | undefined) ?? rootOptions.logLevel) as string
    ),
  }
}

export function createProgram(onCommand: (cli: ParsedCli) => void | Promise<void> = runCli) {
  const program = new Command()
  program
    .name('worker')
    .description('Language-agnostic task scheduler')
    .version('0.1.0')
    .option('-c, --config <path>', '配置文件路径', defaultConfigPath())
    .option('-l, --log-level <level>', '日志级别: error, warn, info, debug', 'info')

  const startCommand = program
    .command('start')
    .description('启动调度器')
    .option('-c, --config <path>', '配置文件路径')
    .option('-l, --log-level <level>', '日志级别: error, warn, info, debug')
  startCommand.action(() => onCommand({ ...baseOptions(program, startCommand), command: 'start' }))

  const runCommand = program
    .command('run <name>')
    .description('立即执行一次任务')
    .option('-c, --config <path>', '配置文件路径')
    .option('-l, --log-level <level>', '日志级别: error, warn, info, debug')
  runCommand.action((name: string) =>
    onCommand({ ...baseOptions(program, runCommand), command: 'run', name })
  )

  const listCommand = program
    .command('list')
    .alias('ls')
    .description('查看任务列表')
    .option('-a, --all', '显示已关闭任务')
    .option('--json', '以 JSON 输出')
    .option('-c, --config <path>', '配置文件路径')
    .option('-l, --log-level <level>', '日志级别: error, warn, info, debug')
  listCommand.action((options) =>
    onCommand({
      ...baseOptions(program, listCommand),
      command: 'list',
      all: Boolean(options.all),
      outputJson: Boolean(options.json),
    })
  )

  const statusCommand = program
    .command('status')
    .description('查看任务运行状态')
    .option('-a, --all', '显示已关闭任务')
    .option('--json', '以 JSON 输出')
    .option('-c, --config <path>', '配置文件路径')
    .option('-l, --log-level <level>', '日志级别: error, warn, info, debug')
  statusCommand.action((options) =>
    onCommand({
      ...baseOptions(program, statusCommand),
      command: 'status',
      all: Boolean(options.all),
      outputJson: Boolean(options.json),
    })
  )

  return program
}

export async function runCli(cli: ParsedCli) {
  const log = createLogger(cli.logLevel)
  const config = loadConfig(cli.config)
  const jobs = cli.all ? config.jobs : config.jobs.filter((job) => job.enabled)

  if (cli.command === 'list') {
    if (cli.outputJson) {
      console.log(JSON.stringify(jobs, null, 2))
      return
    }
    for (const job of jobs) {
      console.log(
        [job.enabled ? 'enabled' : 'disabled', job.name, job.cron ?? '', job.command ?? ''].join(
          '\t'
        )
      )
    }
    return
  }

  if (cli.command === 'status') {
    const state = readState(statePathForConfig(cli.config))
    const status = jobs.map((job) => ({ ...job, state: state?.jobs[job.name] }))
    if (cli.outputJson) {
      console.log(JSON.stringify(status, null, 2))
      return
    }
    for (const job of status) {
      const running = job.state?.running ? 'running' : 'idle'
      console.log(
        [job.enabled ? 'enabled' : 'disabled', running, job.name, job.state?.nextRun ?? ''].join(
          '\t'
        )
      )
    }
    return
  }

  if (cli.command === 'run') {
    const job = config.jobs.find((candidate) => candidate.name === cli.name)
    if (!job) throw new Error(`找不到任务: ${cli.name}`)
    if (!job.enabled) throw new Error(`任务已关闭: ${job.name}`)
    const result = await runTask(job)
    if (!result.ok) process.exitCode = 1
    return
  }

  const release = acquireLock(lockPathForConfig(cli.config))
  process.once('SIGINT', () => {
    release()
    process.exit(130)
  })
  process.once('SIGTERM', () => {
    release()
    process.exit(143)
  })
  await startScheduler(jobs, statePathForConfig(cli.config), log)
}

if (require.main === module) {
  createProgram()
    .parseAsync(process.argv)
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error)
      process.exit(1)
    })
}
