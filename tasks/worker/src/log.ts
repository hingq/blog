import type { LogLevel } from './types'

const weights: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
}

const supportsColor =
  !process.env.NO_COLOR &&
  process.env.FORCE_COLOR !== '0' &&
  (process.env.FORCE_COLOR === '1' || (process.stderr.isTTY ?? false))

function wrap(code: string, text: string): string {
  return supportsColor ? `${code}${text}\x1b[0m` : text
}

const levelStyle: Record<LogLevel, { color: string; icon: string }> = {
  error: { color: '\x1b[31m', icon: '❌' },
  warn: { color: '\x1b[33m', icon: '⚠️ ' },
  info: { color: '\x1b[34m', icon: 'ℹ️ ' },
  debug: { color: '\x1b[90m', icon: '🔍' },
}

function timestamp(): string {
  const now = new Date()
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')
  return wrap('\x1b[90m', `[${h}:${m}:${s}]`)
}

export function normalizeLogLevel(value: string | undefined): LogLevel {
  if (value === 'error' || value === 'warn' || value === 'info' || value === 'debug') {
    return value
  }
  throw new Error('日志级别必须是 error, warn, info, debug')
}

export function createLogger(configured: LogLevel) {
  return (level: LogLevel, message: string) => {
    if (weights[level] <= weights[configured]) {
      const style = levelStyle[level]
      const tag = wrap(style.color, level.toUpperCase().padEnd(5))
      console.error(`${timestamp()} ${style.icon} ${tag} ${message}`)
    }
  }
}

