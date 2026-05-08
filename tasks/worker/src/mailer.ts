import tls from 'node:tls'
import type { JobConfig, RunResult } from './types'

function readResponse(socket: tls.TLSSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = ''
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8')
      const lines = buffer.split(/\r?\n/).filter(Boolean)
      const last = lines.at(-1)
      if (last && /^\d{3} /.test(last)) {
        socket.off('data', onData)
        resolve(buffer)
      }
    }
    socket.on('data', onData)
    socket.once('error', reject)
  })
}

async function sendCommand(socket: tls.TLSSocket, command: string) {
  socket.write(`${command}\r\n`)
  const response = await readResponse(socket)
  if (!/^[23]\d{2}/.test(response)) {
    throw new Error(response.trim())
  }
}

export async function sendMail(subject: string, body: string) {
  const user = process.env.EMAIL_USER
  const pass = process.env.EMAIL_PASS
  const to = process.env.EMAIL_RECEIVER
  const host = process.env.SMTP_HOST || 'smtp.gmail.com'
  const port = Number(process.env.SMTP_PORT || 465)
  if (!user || !pass || !to) {
    throw new Error('环境变量 EMAIL_USER, EMAIL_PASS, EMAIL_RECEIVER 必须设置')
  }

  const socket = tls.connect({ host, port, servername: host })
  await readResponse(socket)
  await sendCommand(socket, `EHLO ${host}`)
  await sendCommand(socket, 'AUTH LOGIN')
  await sendCommand(socket, Buffer.from(user).toString('base64'))
  await sendCommand(socket, Buffer.from(pass).toString('base64'))
  await sendCommand(socket, `MAIL FROM:<${user}>`)
  await sendCommand(socket, `RCPT TO:<${to}>`)
  await sendCommand(socket, 'DATA')
  socket.write(
    [
      `From: ${user}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
      '.',
      '',
    ].join('\r\n')
  )
  await readResponse(socket)
  await sendCommand(socket, 'QUIT')
  socket.end()
}

export async function notifyFailure(job: JobConfig, result: RunResult) {
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
