const assert = require('node:assert/strict')
const test = require('node:test')

const { validateConfig } = require('../tasks/worker/dist/config.js')

test('validateConfig rejects duplicate job names', () => {
  assert.throws(
    () =>
      validateConfig({
        jobs: [
          { name: 'daily', enabled: true, cron: '0 8 * * *', command: 'echo' },
          { name: 'daily', enabled: true, cron: '30 8 * * *', command: 'echo' },
        ],
      }),
    /重复任务名: daily/
  )
})

test('validateConfig allows disabled jobs without runtime fields', () => {
  const config = validateConfig({
    jobs: [{ name: 'paused', enabled: false }],
  })

  assert.equal(config.jobs[0].enabled, false)
})

test('validateConfig rejects enabled jobs without a command', () => {
  assert.throws(
    () =>
      validateConfig({
        jobs: [{ name: 'daily', enabled: true, cron: '0 8 * * *' }],
      }),
    /任务 daily 的 command 不能为空/
  )
})
