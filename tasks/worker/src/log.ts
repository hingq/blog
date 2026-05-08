import type { LogLevel } from './types'

const weights: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
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
      console.error(`[${level.toUpperCase()}] ${message}`)
    }
  }
}
