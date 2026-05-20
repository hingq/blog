const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const mailerModule = import('../tasks/dist/worker-mailer.mjs')

test('resolveMailDotenvPath defaults to project .env', async () => {
  const { resolveMailDotenvPath } = await mailerModule
  const previousRoot = process.env.TASKS_PROJECT_ROOT
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-mailer-root-'))

  process.env.TASKS_PROJECT_ROOT = root
  assert.equal(resolveMailDotenvPath({}), path.join(root, '.env'))

  if (previousRoot == null) {
    delete process.env.TASKS_PROJECT_ROOT
  } else {
    process.env.TASKS_PROJECT_ROOT = previousRoot
  }
})

test('loadMailEnv reads configured dotenv path and preserves existing env', async () => {
  const { loadMailEnv } = await mailerModule
  const previousRoot = process.env.TASKS_PROJECT_ROOT
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-mailer-env-'))
  const configDir = path.join(root, 'config')
  fs.mkdirSync(configDir)
  fs.writeFileSync(
    path.join(configDir, 'prod.env'),
    ['EMAIL_USER=dotenv@example.com', 'EMAIL_PASS=dotenv-pass', 'EMAIL_RECEIVER=dotenv-to'].join(
      '\n'
    )
  )

  process.env.TASKS_PROJECT_ROOT = root
  const env = {
    EMAIL_USER: 'existing@example.com',
  }
  loadMailEnv({ LEETCODE_DAILY_ENV_PATH: 'config/prod.env', SMTP_HOST: 'smtp.example.com' }, env)

  assert.equal(env.EMAIL_USER, 'existing@example.com')
  assert.equal(env.EMAIL_PASS, 'dotenv-pass')
  assert.equal(env.EMAIL_RECEIVER, 'dotenv-to')
  assert.equal(env.SMTP_HOST, 'smtp.example.com')

  if (previousRoot == null) {
    delete process.env.TASKS_PROJECT_ROOT
  } else {
    process.env.TASKS_PROJECT_ROOT = previousRoot
  }
})

test('resolveMailDotenvPath keeps absolute configured dotenv path', async () => {
  const { resolveMailDotenvPath } = await mailerModule
  assert.equal(
    resolveMailDotenvPath({ LEETCODE_DAILY_ENV_PATH: '/blog/.env' }),
    path.join('/blog', '.env')
  )
})

test('readResponse reports closed connection with a non-empty message', async () => {
  const { readResponse } = await mailerModule
  const socket = new EventEmitter()
  const response = readResponse(socket, 'greeting', 1000)

  socket.emit('close')

  await assert.rejects(response, /SMTP greeting failed: connection closed before response/)
})

test('readResponse reports partial SMTP responses when the connection closes', async () => {
  const { readResponse } = await mailerModule
  const socket = new EventEmitter()
  const response = readResponse(socket, 'EHLO', 1000)

  socket.emit('data', Buffer.from('250-smtp.example.com\r\n'))
  socket.emit('end')

  await assert.rejects(
    response,
    /SMTP EHLO failed: connection ended before complete response: 250-smtp\.example\.com/
  )
})

test('assertSmtpResponse includes stage and SMTP response for failures', async () => {
  const { assertSmtpResponse } = await mailerModule

  assert.throws(
    () => assertSmtpResponse('535 5.7.8 Username and Password not accepted\r\n', 'AUTH password'),
    /SMTP AUTH password failed: 535 5\.7\.8 Username and Password not accepted/
  )
  assert.throws(
    () => assertSmtpResponse('', 'message body', /^2\d{2}/),
    /SMTP message body failed: empty response/
  )
})

test('assertSmtpResponse requires 2xx response after message body', async () => {
  const { assertSmtpResponse } = await mailerModule

  assert.doesNotThrow(() => assertSmtpResponse('250 2.0.0 OK\r\n', 'message body', /^2\d{2}/))
  assert.throws(
    () => assertSmtpResponse('354 End data with <CR><LF>.<CR><LF>\r\n', 'message body', /^2\d{2}/),
    /SMTP message body failed: 354 End data/
  )
})

test('dotStuffBody escapes lines that could terminate SMTP DATA early', async () => {
  const { dotStuffBody } = await mailerModule

  assert.equal(dotStuffBody('first\n.\n..already\nlast'), 'first\r\n..\r\n...already\r\nlast')
})

test('formatSocketError includes diagnostic fields when message is empty', async () => {
  const { formatSocketError } = await mailerModule
  const error = Object.assign(new Error(''), {
    code: 'ECONNRESET',
    syscall: 'read',
    address: 'smtp.example.com',
    port: 465,
  })

  assert.match(
    formatSocketError(error, 'smtp.example.com:465 mode=tls'),
    /code=ECONNRESET, syscall=read, address=smtp\.example\.com, port=465/
  )
  assert.match(formatSocketError(error, 'smtp.example.com:465 mode=tls'), /mode=tls/)
})

test('readResponse includes connection context for socket errors', async () => {
  const { readResponse } = await mailerModule
  const socket = new EventEmitter()
  const response = readResponse(socket, 'greeting', 1000, 'smtp.example.com:465 mode=tls')

  socket.emit('error', Object.assign(new Error(''), { code: 'ECONNRESET' }))

  await assert.rejects(
    response,
    /SMTP greeting failed: code=ECONNRESET \(smtp\.example\.com:465 mode=tls\)/
  )
})

test('resolveSmtpConfig defaults to implicit TLS on port 465', async () => {
  const { resolveSmtpConfig } = await mailerModule

  assert.deepEqual(resolveSmtpConfig({ SMTP_HOST: 'smtp.gmail.com' }), {
    host: 'smtp.gmail.com',
    port: 465,
    timeoutMs: 15000,
    secure: true,
    starttls: false,
    mode: 'tls',
  })
})

test('resolveSmtpConfig enables STARTTLS by default on port 587', async () => {
  const { resolveSmtpConfig } = await mailerModule

  assert.deepEqual(resolveSmtpConfig({ SMTP_HOST: 'smtp.example.com', SMTP_PORT: '587' }), {
    host: 'smtp.example.com',
    port: 587,
    timeoutMs: 15000,
    secure: false,
    starttls: true,
    mode: 'starttls',
  })
})

test('resolveSmtpConfig supports explicit plain SMTP', async () => {
  const { resolveSmtpConfig } = await mailerModule

  assert.deepEqual(
    resolveSmtpConfig({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '25',
      SMTP_SECURE: 'false',
      SMTP_STARTTLS: 'false',
      SMTP_TIMEOUT_MS: '30000',
    }),
    {
      host: 'smtp.example.com',
      port: 25,
      timeoutMs: 30000,
      secure: false,
      starttls: false,
      mode: 'plain',
    }
  )
})

test('smtpHandshakeCommands sends EHLO before and after STARTTLS', async () => {
  const { smtpHandshakeCommands } = await mailerModule

  assert.deepEqual(smtpHandshakeCommands({ host: 'smtp.example.com', starttls: true }), [
    { command: 'EHLO smtp.example.com', stage: 'EHLO' },
    { command: 'STARTTLS', stage: 'STARTTLS' },
    { command: 'EHLO smtp.example.com', stage: 'EHLO after STARTTLS' },
  ])
})
