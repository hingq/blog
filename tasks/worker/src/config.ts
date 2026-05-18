import fs from 'node:fs'
import path from 'node:path'
import { parseCron } from './cron'
import { packageRoot, repoRoot } from './paths'
import type { JobConfig, WorkerConfig } from './types'

function asObject(value: unknown): Record<string, unknown> {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('配置必须是 JSON object')
  }
  return value as Record<string, unknown>
}

function normalizeJob(raw: unknown): JobConfig {
  const job = asObject(raw)
  const name = String(job.name ?? '').trim()
  if (!name) throw new Error('任务名称不能为空')
  const enabled = job.enabled == null ? true : Boolean(job.enabled)
  const cron = job.cron == null ? undefined : String(job.cron)
  const command = job.command == null ? undefined : String(job.command)
  const args = Array.isArray(job.args) ? job.args.map(String) : []
  const cwd = job.cwd == null ? undefined : String(job.cwd)
  const env =
    job.env != null
      ? Object.fromEntries(
          Object.entries(asObject(job.env)).map(([key, value]) => [key, String(value)])
        )
      : {}
  const timeoutMs = job.timeoutMs == null ? undefined : Number(job.timeoutMs)

  return { name, enabled, cron, command, args, cwd, env, timeoutMs }
}

function normalizePath(value: string | undefined, base: string): string | undefined {
  if (!value || path.isAbsolute(value)) return value
  return path.join(base, value)
}

function normalizeExecutable(value: string | undefined, base: string): string | undefined {
  if (!value || path.isAbsolute(value)) return value
  return value.includes('/') || value.startsWith('.') ? path.join(base, value) : value
}

function runtimeBaseForConfig(configPath?: string): string {
  if (configPath) return path.dirname(path.resolve(configPath))
  return packageRoot()
}

export function validateConfig(input: unknown, configPath?: string): WorkerConfig {
  const raw = asObject(input)
  if (!Array.isArray(raw.jobs) || raw.jobs.length === 0) {
    throw new Error('至少配置一个任务')
  }

  const names = new Set<string>()
  const packageBase = runtimeBaseForConfig(configPath)
  const projectBase = repoRoot()
  const jobs = raw.jobs.map((rawJob) => {
    const job = normalizeJob(rawJob)
    return {
      ...job,
      command: normalizeExecutable(job.command, packageBase),
      args: job.args.map((arg) => normalizePath(arg, packageBase) ?? arg),
      cwd: normalizePath(job.cwd, projectBase),
    }
  })
  for (const job of jobs) {
    if (names.has(job.name)) throw new Error(`重复任务名: ${job.name}`)
    names.add(job.name)
    if (!job.enabled) continue
    if (!job.cron?.trim()) throw new Error(`任务 ${job.name} 的 cron 不能为空`)
    if (!job.command?.trim()) throw new Error(`任务 ${job.name} 的 command 不能为空`)
    if (job.timeoutMs != null && (!Number.isFinite(job.timeoutMs) || job.timeoutMs <= 0)) {
      throw new Error(`任务 ${job.name} 的 timeoutMs 必须大于 0`)
    }
    parseCron(job.cron)
  }

  return { jobs }
}

export function loadConfig(configPath: string): WorkerConfig {
  const fullPath = path.resolve(configPath)
  const text = fs.readFileSync(fullPath, 'utf8')
  return validateConfig(JSON.parse(text), fullPath)
}
