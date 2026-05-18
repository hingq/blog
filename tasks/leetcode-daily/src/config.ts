import fs from 'node:fs'
import path from 'node:path'

export function projectRoot(): string {
  if (process.env.TASKS_PROJECT_ROOT) return path.resolve(process.env.TASKS_PROJECT_ROOT)
  if (path.basename(__dirname) === 'jobs') return path.resolve(__dirname, '../../../..')
  return path.resolve(__dirname, '../../..')
}

export function cacheRoot(root = projectRoot()): string {
  return path.join(root, 'data', 'leetcode-daily')
}

export function parseEnvLine(line: string): [string, string] | undefined {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return undefined
  const index = trimmed.indexOf('=')
  if (index < 0) return undefined
  const key = trimmed.slice(0, index).trim()
  const value = trimmed
    .slice(index + 1)
    .trim()
    .replace(/^["']|["']$/g, '')
  return key ? [key, value] : undefined
}

export function loadDotenv(filePath: string) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const parsed = parseEnvLine(line)
    if (parsed && process.env[parsed[0]] == null) process.env[parsed[0]] = parsed[1]
  }
}
