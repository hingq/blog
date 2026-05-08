import fs from 'node:fs'
import type { RuntimeState } from './types'

export function readState(statePath: string): RuntimeState | undefined {
  if (!fs.existsSync(statePath)) return undefined
  return JSON.parse(fs.readFileSync(statePath, 'utf8')) as RuntimeState
}

export function writeState(statePath: string, state: RuntimeState) {
  state.updatedAt = new Date().toISOString()
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`)
}
