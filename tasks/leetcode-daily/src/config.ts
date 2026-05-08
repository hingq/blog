import fs from 'node:fs'
import path from 'node:path'

export function projectRoot(): string {
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

export function parseGeminiModels(value: string): string[] {
  const models: string[] = []
  for (const model of value.split(',')) {
    const trimmed = model.trim()
    if (trimmed && !models.includes(trimmed)) models.push(trimmed)
  }
  return models
}

export function readGeminiModels(env = process.env): string[] {
  return parseGeminiModels(env.GEMINI_MODEL || 'gemini-3.1-pro-preview')
}

export function readRequiredEnvTrimmed(keys: string[], env = process.env): string {
  for (const key of keys) {
    const value = env[key]?.trim()
    if (value) return value
  }
  throw new Error(`环境变量未设置或为空: ${keys.join(' / ')}`)
}
