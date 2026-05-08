import crypto from 'node:crypto'
import os from 'node:os'
import path from 'node:path'

export function repoRoot(): string {
  return path.resolve(__dirname, '../../..')
}

export function resolveFromRoot(value: string | undefined): string | undefined {
  if (!value) return undefined
  return path.isAbsolute(value) ? value : path.join(repoRoot(), value)
}

function configHash(configPath: string): string {
  return crypto.createHash('sha1').update(path.resolve(configPath)).digest('hex').slice(0, 12)
}

export function statePathForConfig(configPath: string): string {
  return path.join(os.tmpdir(), `worker-${configHash(configPath)}.state.json`)
}

export function lockPathForConfig(configPath: string): string {
  return path.join(os.tmpdir(), `worker-${configHash(configPath)}.lock`)
}
