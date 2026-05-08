import { spawn } from 'node:child_process'
import { resolveFromRoot } from './paths'
import type { JobConfig, RunResult } from './types'

function resolveCommand(command: string): string {
  return command.includes('/') || command.startsWith('.')
    ? (resolveFromRoot(command) ?? command)
    : command
}

export function runTask(job: JobConfig): Promise<RunResult> {
  return new Promise((resolve) => {
    const startedAt = new Date().toISOString()
    if (!job.command) {
      resolve({
        ok: false,
        error: `任务 ${job.name} 的 command 不能为空`,
        startedAt,
        finishedAt: new Date().toISOString(),
      })
      return
    }

    let settled = false
    let timedOut = false
    const child = spawn(resolveCommand(job.command), job.args, {
      cwd: resolveFromRoot(job.cwd),
      env: { ...process.env, ...job.env },
      stdio: 'inherit',
    })

    const timer =
      job.timeoutMs == null
        ? undefined
        : setTimeout(() => {
            timedOut = true
            child.kill('SIGTERM')
            setTimeout(() => {
              if (!settled) child.kill('SIGKILL')
            }, 1000).unref()
          }, job.timeoutMs)

    timer?.unref()

    child.on('error', (error) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      resolve({
        ok: false,
        error: error.message,
        timedOut,
        startedAt,
        finishedAt: new Date().toISOString(),
      })
    })

    child.on('exit', (exitCode, signal) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      resolve({
        ok: !timedOut && exitCode === 0,
        exitCode,
        signal,
        timedOut,
        error: timedOut
          ? `任务 ${job.name} 执行超时`
          : exitCode === 0
            ? undefined
            : `任务 ${job.name} 退出失败: ${exitCode}`,
        startedAt,
        finishedAt: new Date().toISOString(),
      })
    })
  })
}
