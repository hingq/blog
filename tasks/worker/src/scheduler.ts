import { nextCronDate } from './cron'
import { notifyFailure as defaultNotifyFailure } from './mailer'
import { runTask as defaultRunTask } from './runner'
import { writeState } from './state'
import type { JobConfig, LogLevel, RunResult, RuntimeState } from './types'

export function createRuntimeState(jobs: JobConfig[], now = new Date()): RuntimeState {
  const state: RuntimeState = {
    schedulerPid: process.pid,
    updatedAt: now.toISOString(),
    jobs: {},
  }
  for (const job of jobs) {
    state.jobs[job.name] = {
      enabled: job.enabled,
      running: false,
      nextRun: job.enabled && job.cron ? nextCronDate(job.cron, now).toISOString() : undefined,
    }
  }
  return state
}

type TriggerOptions = {
  jobs: JobConfig[]
  state: RuntimeState
  now: Date
  runTask?: (job: JobConfig) => Promise<RunResult>
  notifyFailure?: (job: JobConfig, result: RunResult) => Promise<void>
  log?: (level: LogLevel, message: string) => void
  persist?: () => void
}

export async function triggerDueJobs(options: TriggerOptions) {
  const runTask = options.runTask ?? defaultRunTask
  const notifyFailure = options.notifyFailure ?? defaultNotifyFailure
  const log = options.log ?? (() => {})

  for (const job of options.jobs) {
    if (!job.enabled || !job.cron) continue
    const jobState = options.state.jobs[job.name] ?? {
      enabled: job.enabled,
      running: false,
    }
    options.state.jobs[job.name] = jobState
    if (!jobState.nextRun) jobState.nextRun = nextCronDate(job.cron, options.now).toISOString()
    if (new Date(jobState.nextRun).getTime() > options.now.getTime()) continue

    if (jobState.running) {
      log('warn', `任务 ${job.name} 仍在运行，跳过本次触发`)
      jobState.nextRun = nextCronDate(job.cron, options.now).toISOString()
      options.persist?.()
      continue
    }

    jobState.running = true
    jobState.lastRun = options.now.toISOString()
    jobState.lastError = undefined
    options.persist?.()

    const result = await runTask(job)
    jobState.running = false
    jobState.lastExit = result
    jobState.lastError = result.ok ? undefined : result.error
    jobState.nextRun = nextCronDate(job.cron, options.now).toISOString()
    options.persist?.()

    if (!result.ok) {
      log('error', `任务 ${job.name} 执行失败: ${result.error ?? result.exitCode ?? result.signal}`)
      try {
        await notifyFailure(job, result)
      } catch (error) {
        log(
          'error',
          `任务 ${job.name} 失败邮件发送失败: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }
  }
}

export async function startScheduler(
  jobs: JobConfig[],
  statePath: string,
  log: (level: LogLevel, message: string) => void
) {
  const state = createRuntimeState(jobs)
  const persist = () => writeState(statePath, state)
  persist()

  for (const job of Object.entries(state.jobs)) {
    log('info', `任务 ${job[0]} 下次运行: ${job[1].nextRun ?? 'disabled'}`)
  }

  while (true) {
    await triggerDueJobs({ jobs, state, now: new Date(), log, persist })
    const nextTimes = Object.values(state.jobs)
      .map((job) => (job.nextRun ? new Date(job.nextRun).getTime() : undefined))
      .filter((value): value is number => typeof value === 'number')
    const next = Math.min(...nextTimes)
    const sleepMs = Number.isFinite(next)
      ? Math.max(200, Math.min(60_000, next - Date.now()))
      : 60_000
    await new Promise((resolve) => setTimeout(resolve, sleepMs))
  }
}
