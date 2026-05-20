import tls from 'node:tls'
import net from 'node:net'
import fs from 'node:fs'
import path from 'node:path'
import { resolveFromRoot } from './paths'
import type { JobConfig, RunResult } from './types'

const LEETCODE_DAILY_ENV_PATH = 'LEETCODE_DAILY_ENV_PATH'
const DEFAULT_SMTP_TIMEOUT_MS = 15_000

type MailEnv = NodeJS.ProcessEnv
type SmtpSocket = net.Socket | tls.TLSSocket

export type SmtpConnectionMode = 'tls' | 'starttls' | 'plain'

export type SmtpConfig = {
  host: string
  port: number
  timeoutMs: number
  secure: boolean
  starttls: boolean
  mode: SmtpConnectionMode
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

export function resolveMailDotenvPath(env: MailEnv = process.env): string {
  const configuredPath = env[LEETCODE_DAILY_ENV_PATH]?.trim()
  if (configuredPath) {
    return path.isAbsolute(configuredPath)
      ? configuredPath
      : (resolveFromRoot(configuredPath) ?? configuredPath)
  }
  return resolveFromRoot('.env') ?? path.resolve('.env')
}

export function loadDotenv(filePath: string, env: MailEnv = process.env) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const parsed = parseEnvLine(line)
    if (parsed && env[parsed[0]] == null) env[parsed[0]] = parsed[1]
  }
}

export function loadMailEnv(jobEnv: Record<string, string> = {}, env: MailEnv = process.env) {
  const lookupEnv = { ...env, ...jobEnv }
  loadDotenv(resolveMailDotenvPath(lookupEnv), env)
  for (const [key, value] of Object.entries(jobEnv)) {
    if (env[key] == null) env[key] = value
  }
}

function smtpError(stage: string, message: string): Error {
  return new Error(`SMTP ${stage} failed: ${message}`)
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value == null) return undefined
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return undefined
}

export function resolveSmtpConfig(env: MailEnv = process.env): SmtpConfig {
  const host = env.SMTP_HOST || 'smtp.gmail.com'
  const port = Number(env.SMTP_PORT || 465)
  const timeoutMs = Number(env.SMTP_TIMEOUT_MS || DEFAULT_SMTP_TIMEOUT_MS)
  const secure = parseBoolean(env.SMTP_SECURE) ?? port === 465
  const starttls = !secure && (parseBoolean(env.SMTP_STARTTLS) ?? port === 587)
  return {
    host,
    port,
    timeoutMs,
    secure,
    starttls,
    mode: secure ? 'tls' : starttls ? 'starttls' : 'plain',
  }
}

export function smtpHandshakeCommands(config: Pick<SmtpConfig, 'host' | 'starttls'>) {
  const commands = [{ command: `EHLO ${config.host}`, stage: 'EHLO' }]
  if (config.starttls) {
    commands.push(
      { command: 'STARTTLS', stage: 'STARTTLS' },
      { command: `EHLO ${config.host}`, stage: 'EHLO after STARTTLS' }
    )
  }
  return commands
}

export function formatSocketError(
  error: Error & {
    code?: string
    errno?: string | number
    syscall?: string
    address?: string
    port?: string | number
    cause?: unknown
  },
  context?: string
): string {
  const details = [
    error.message,
    error.name && error.name !== 'Error' ? `name=${error.name}` : undefined,
    error.code ? `code=${error.code}` : undefined,
    error.errno != null ? `errno=${error.errno}` : undefined,
    error.syscall ? `syscall=${error.syscall}` : undefined,
    error.address ? `address=${error.address}` : undefined,
    error.port != null ? `port=${error.port}` : undefined,
    error.cause instanceof Error
      ? `cause=${error.cause.message || error.cause.name}`
      : error.cause
        ? `cause=${String(error.cause)}`
        : undefined,
  ].filter(Boolean)

  const message = details.join(', ') || 'socket error'
  return context ? `${message} (${context})` : message
}

export function dotStuffBody(body: string): string {
  return body
    .replace(/\r?\n/g, '\r\n')
    .split('\r\n')
    .map((line) => (line.startsWith('.') ? `.${line}` : line))
    .join('\r\n')
}

export function readResponse(
  socket: SmtpSocket,
  stage = 'response',
  timeoutMs = DEFAULT_SMTP_TIMEOUT_MS,
  context?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = ''
    let settled = false
    const cleanup = () => {
      socket.off('data', onData)
      socket.off('error', onError)
      socket.off('end', onEnd)
      socket.off('close', onClose)
      clearTimeout(timer)
    }
    const settle = (callback: () => void) => {
      if (settled) return
      settled = true
      cleanup()
      callback()
    }
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8')
      const lines = buffer.split(/\r?\n/).filter(Boolean)
      const last = lines.at(-1)
      if (last && /^\d{3} /.test(last)) {
        settle(() => resolve(buffer))
      }
    }
    const onError = (error: Error) => {
      settle(() => reject(smtpError(stage, formatSocketError(error, context))))
    }
    const onEnd = () => {
      settle(() =>
        reject(
          smtpError(
            stage,
            buffer.trim()
              ? `connection ended before complete response: ${buffer.trim()}`
              : 'connection ended before response'
          )
        )
      )
    }
    const onClose = () => {
      settle(() =>
        reject(
          smtpError(
            stage,
            buffer.trim()
              ? `connection closed before complete response: ${buffer.trim()}`
              : 'connection closed before response'
          )
        )
      )
    }
    const timer = setTimeout(() => {
      settle(() => reject(smtpError(stage, `timed out after ${timeoutMs}ms`)))
    }, timeoutMs)
    timer.unref()

    socket.on('data', onData)
    socket.once('error', onError)
    socket.once('end', onEnd)
    socket.once('close', onClose)
  })
}

export function assertSmtpResponse(response: string, stage: string, pattern = /^[23]\d{2}/) {
  if (!pattern.test(response)) {
    throw smtpError(stage, response.trim() || 'empty response')
  }
}

async function sendCommand(
  socket: SmtpSocket,
  command: string,
  stage: string,
  timeoutMs: number,
  context?: string
) {
  socket.write(`${command}\r\n`)
  const response = await readResponse(socket, stage, timeoutMs, context)
  assertSmtpResponse(response, stage)
  return response
}

export async function sendMail(subject: string, body: string) {
  const user = process.env.EMAIL_USER
  const pass = process.env.EMAIL_PASS
  const to = process.env.EMAIL_RECEIVER
  const config = resolveSmtpConfig()
  const context = `${config.host}:${config.port} mode=${config.mode}`
  if (!user || !pass || !to) {
    throw new Error('环境变量 EMAIL_USER, EMAIL_PASS, EMAIL_RECEIVER 必须设置')
  }

  let socket: SmtpSocket = config.secure
    ? tls.connect({ host: config.host, port: config.port, servername: config.host })
    : net.connect({ host: config.host, port: config.port })
  try {
    await readResponse(socket, 'greeting', config.timeoutMs, context)
    await sendCommand(socket, `EHLO ${config.host}`, 'EHLO', config.timeoutMs, context)

    if (config.starttls) {
      await sendCommand(socket, 'STARTTLS', 'STARTTLS', config.timeoutMs, context)
      socket = tls.connect({ socket, servername: config.host })
      await sendCommand(
        socket,
        `EHLO ${config.host}`,
        'EHLO after STARTTLS',
        config.timeoutMs,
        context
      )
    }

    await sendCommand(socket, 'AUTH LOGIN', 'AUTH LOGIN', config.timeoutMs, context)
    await sendCommand(
      socket,
      Buffer.from(user).toString('base64'),
      'AUTH username',
      config.timeoutMs,
      context
    )
    await sendCommand(
      socket,
      Buffer.from(pass).toString('base64'),
      'AUTH password',
      config.timeoutMs,
      context
    )
    await sendCommand(socket, `MAIL FROM:<${user}>`, 'MAIL FROM', config.timeoutMs, context)
    await sendCommand(socket, `RCPT TO:<${to}>`, 'RCPT TO', config.timeoutMs, context)
    await sendCommand(socket, 'DATA', 'DATA', config.timeoutMs, context)
    socket.write(
      [
        `From: ${user}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        dotStuffBody(body),
        '.',
        '',
      ].join('\r\n')
    )
    const response = await readResponse(socket, 'message body', config.timeoutMs, context)
    assertSmtpResponse(response, 'message body', /^2\d{2}/)
    await sendCommand(socket, 'QUIT', 'QUIT', config.timeoutMs, context)
  } finally {
    socket.end()
  }
}

export async function notifyFailure(job: JobConfig, result: RunResult) {
  loadMailEnv(job.env)
  const reason = result.timedOut ? 'timeout' : result.error || `exitCode=${result.exitCode}`
  await sendMail(
    `[worker] task failed: ${job.name}`,
    [
      `Task: ${job.name}`,
      `Reason: ${reason}`,
      `Started: ${result.startedAt ?? ''}`,
      `Finished: ${result.finishedAt ?? ''}`,
    ].join('\n')
  )
}
