import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export function packageRoot(): string {
  const bundledRoot = path.resolve(__dirname)
  if (fs.existsSync(path.join(bundledRoot, 'worker.mjs'))) return bundledRoot
  if (
    (path.basename(bundledRoot) === 'dist' || path.basename(bundledRoot) === 'src') &&
    path.basename(path.dirname(bundledRoot)) === 'worker'
  ) {
    return path.dirname(bundledRoot)
  }
  return path.resolve(__dirname, '../../..')
}

export function repoRoot(): string {
  if (process.env.TASKS_PROJECT_ROOT) return path.resolve(process.env.TASKS_PROJECT_ROOT)
  const root = packageRoot()
  if (
    (path.basename(root) === 'dist' || path.basename(root) === 'target') &&
    path.basename(path.dirname(root)) === 'tasks'
  ) {
    return path.resolve(root, '../..')
  }
  if (
    path.basename(root) === 'worker' &&
    (path.basename(path.dirname(root)) === 'dist' || path.basename(path.dirname(root)) === 'target')
  ) {
    return path.resolve(root, '../../..')
  }
  if (path.basename(root) === 'worker' && path.basename(path.dirname(root)) === 'tasks') {
    return path.resolve(root, '../..')
  }
  return path.resolve(__dirname, '../../..')
}

export function resolveFromRoot(value: string | undefined): string | undefined {
  if (!value) return undefined
  return path.isAbsolute(value) ? value : path.join(repoRoot(), value)
}

export function resolveFromPackage(value: string | undefined): string | undefined {
  if (!value) return undefined
  return path.isAbsolute(value) ? value : path.join(packageRoot(), value)
}

export function defaultConfigPath(): string {
  return path.join(packageRoot(), 'config.json')
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
