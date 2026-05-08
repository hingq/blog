import fs from 'node:fs'
import path from 'node:path'

export function questionCachePath(cacheRoot: string, date: string): string {
  return path.join(cacheRoot, 'questions', `${date}.json`)
}

export function solutionCachePath(cacheRoot: string, date: string): string {
  return path.join(cacheRoot, 'solutions', `${date}.json`)
}

export function readJson<T>(filePath: string): T | undefined {
  if (!fs.existsSync(filePath)) return undefined
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
}

export function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}
