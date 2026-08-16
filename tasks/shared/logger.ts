// ---------------------------------------------------------------------------
// 统一日志工具 — ANSI 颜色 + 图标 + 耗时统计
// ---------------------------------------------------------------------------

const supportsColor =
  !process.env.NO_COLOR &&
  process.env.FORCE_COLOR !== '0' &&
  (process.env.FORCE_COLOR === '1' || (process.stdout.isTTY ?? false))

function wrap(code: string, text: string): string {
  return supportsColor ? `${code}${text}\x1b[0m` : text
}

export const c = {
  bold: (s: string) => wrap('\x1b[1m', s),
  dim: (s: string) => wrap('\x1b[2m', s),
  green: (s: string) => wrap('\x1b[32m', s),
  yellow: (s: string) => wrap('\x1b[33m', s),
  blue: (s: string) => wrap('\x1b[34m', s),
  cyan: (s: string) => wrap('\x1b[36m', s),
  red: (s: string) => wrap('\x1b[31m', s),
  magenta: (s: string) => wrap('\x1b[35m', s),
  gray: (s: string) => wrap('\x1b[90m', s),
  bgGreen: (s: string) => wrap('\x1b[42m\x1b[30m', s),
  bgRed: (s: string) => wrap('\x1b[41m\x1b[37m', s),
} as const

export const icon = {
  start: '🚀',
  success: '✅',
  skip: '⏭️ ',
  error: '❌',
  warning: '⚠️ ',
  network: '🌐',
  file: '📄',
  mail: '📧',
  publish: '📤',
  done: '🎉',
  time: '⏱️ ',
  search: '🔍',
} as const

function todayDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60_000)
  const seconds = ((ms % 60_000) / 1000).toFixed(0)
  return `${minutes}m${seconds}s`
}

const DIVIDER_WIDTH = 42

export function createTaskLogger(taskName: string) {
  const taskStart = Date.now()

  function divider() {
    console.log(c.dim('━'.repeat(DIVIDER_WIDTH)))
  }

  function header() {
    console.log('')
    console.log(`${icon.start} ${c.bold(taskName)}  ${c.dim(todayDate())}`)
    divider()
  }

  function step(current: number, total: number, emoji: string, message: string) {
    console.log('')
    console.log(`${c.cyan(`[${current}/${total}]`)} ${emoji} ${c.bold(message)}`)
  }

  function info(message: string) {
    console.log(`   ${message}`)
  }

  function detail(message: string) {
    console.log(`     ${c.dim(message)}`)
  }

  function success(message: string) {
    console.log(`  ${icon.success} ${c.green(message)}`)
  }

  function warn(message: string) {
    console.log(`  ${icon.warning}${c.yellow(message)}`)
  }

  function error(message: string) {
    console.log(`  ${icon.error} ${c.red(message)}`)
  }

  function skip(message: string) {
    console.log(`  ${icon.skip}${c.gray(message)}`)
  }

  function cacheHit(message: string) {
    console.log(`   ${c.dim(message)}`)
  }

  function timing(ms: number) {
    console.log(`  ${icon.time}${c.gray(`耗时: ${formatDuration(ms)}`)}`)
  }

  async function timed<T>(fn: () => T | Promise<T>): Promise<T> {
    const start = Date.now()
    const result = await fn()
    timing(Date.now() - start)
    return result
  }

  function summary() {
    const elapsed = Date.now() - taskStart
    console.log('')
    divider()
    console.log(
      `${icon.done} ${c.bold(c.green('任务全部完成'))}${' '.repeat(14)}${icon.time}${c.dim(`总耗时: ${formatDuration(elapsed)}`)}`
    )
    console.log('')
  }

  return {
    header,
    step,
    info,
    detail,
    success,
    warn,
    error,
    skip,
    cacheHit,
    timing,
    timed,
    summary,
    divider,
  }
}

// ---------------------------------------------------------------------------
// publish-content.mjs 风格的简易日志（用于 mjs 文件内联复制或 import）
// ---------------------------------------------------------------------------

export function createPublishLogger(prefix: string) {
  function logStep(message: string) {
    console.log(`\n${icon.publish} ${c.bold(`[${prefix}]`)} ${message}`)
  }

  function logInfo(message: string) {
    console.log(`   ${message}`)
  }

  function logDetail(message: string) {
    console.log(`     ${c.dim(message)}`)
  }

  function logSuccess(message: string) {
    console.log(`  ${icon.success} ${c.green(message)}`)
  }

  function logSkip(message: string) {
    console.log(`  ${icon.skip}${c.gray(message)}`)
  }

  function logUpload(message: string) {
    console.log(`  ${icon.publish} ${message}`)
  }

  function logError(message: string) {
    console.log(`  ${icon.error} ${c.red(message)}`)
  }

  function logStat(message: string) {
    console.log(`  📊 ${message}`)
  }

  return { logStep, logInfo, logDetail, logSuccess, logSkip, logUpload, logError, logStat }
}
