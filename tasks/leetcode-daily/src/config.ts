import fs from 'node:fs'
import path from 'node:path'

export const LEETCODE_DAILY_ENV_PATH = 'LEETCODE_DAILY_ENV_PATH'

export function inferProjectRoot(
  startDir = __dirname,
  existsSync: (filePath: string) => boolean = fs.existsSync
): string {
  let current = path.resolve(startDir)
  for (let depth = 0; depth < 8; depth++) {
    if (
      existsSync(path.join(current, 'data', 'blog')) ||
      existsSync(path.join(current, 'data', 'siteMetadata.js'))
    ) {
      return current
    }
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  if (path.basename(startDir) === 'jobs') return path.resolve(startDir, '../../../..')
  return path.resolve(startDir, '../../..')
}

export function projectRoot(): string {
  return process.cwd()
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

export function resolveDotenvPath(root = projectRoot()): string {
  const configuredPath = process.env[LEETCODE_DAILY_ENV_PATH]?.trim()
  if (!configuredPath) return path.join(root, '.env')
  return path.isAbsolute(configuredPath) ? configuredPath : path.join(root, configuredPath)
}

export function loadConfiguredDotenv(root = projectRoot()): string {
  const dotenvPath = resolveDotenvPath(root)
  loadDotenv(dotenvPath)
  return dotenvPath
}
