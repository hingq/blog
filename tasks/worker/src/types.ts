export type LogLevel = 'error' | 'warn' | 'info' | 'debug'

export type JobConfig = {
  name: string
  enabled: boolean
  cron?: string
  command?: string
  args: string[]
  cwd?: string
  env: Record<string, string>
  timeoutMs?: number
}

export type WorkerConfig = {
  jobs: JobConfig[]
}

export type RunResult = {
  ok: boolean
  exitCode?: number | null
  signal?: NodeJS.Signals | null
  timedOut?: boolean
  error?: string
  startedAt?: string
  finishedAt?: string
}

export type JobRuntimeState = {
  enabled: boolean
  running: boolean
  nextRun?: string
  lastRun?: string
  lastExit?: RunResult
  lastError?: string
}

export type RuntimeState = {
  schedulerPid?: number
  updatedAt: string
  jobs: Record<string, JobRuntimeState>
}
