const assert = require('node:assert/strict')
const test = require('node:test')

const { runTask } = require('../tasks/worker/dist/runner.js')

test('runTask returns failure for non-zero exit without throwing', async () => {
  const result = await runTask({
    name: 'fail',
    command: process.execPath,
    args: ['-e', 'process.exit(7)'],
  })

  assert.equal(result.ok, false)
  assert.equal(result.exitCode, 7)
})

test('runTask times out and marks only that run as failed', async () => {
  const result = await runTask({
    name: 'timeout',
    command: process.execPath,
    args: ['-e', 'setTimeout(() => {}, 5000)'],
    timeoutMs: 50,
  })

  assert.equal(result.ok, false)
  assert.equal(result.timedOut, true)
})

test('runTask passes args and env to the child process', async () => {
  const result = await runTask({
    name: 'env',
    command: 'node',
    args: ['-e', 'process.exit(process.env.WORKER_TEST_VALUE === "ok" ? 0 : 3)'],
    env: { WORKER_TEST_VALUE: 'ok' },
  })

  assert.equal(result.ok, true)
  assert.equal(result.exitCode, 0)
})

test('runTask returns failure when the command is missing', async () => {
  const result = await runTask({
    name: 'missing',
    command: 'definitely-not-a-worker-command',
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /ENOENT/)
})
