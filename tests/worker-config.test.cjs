const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const { loadConfig, validateConfig } = require('../tasks/dist/worker-config.cjs')

const repoRoot = path.join(__dirname, '..')
const distRoot = path.join(repoRoot, 'tasks', 'dist')

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

test('loadConfig resolves packaged task paths from the config directory', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-config-'))
  const configPath = path.join(dir, 'config.json')
  fs.mkdirSync(path.join(dir, 'jobs'))
  fs.writeFileSync(
    configPath,
    JSON.stringify({
      jobs: [
        {
          name: 'daily',
          enabled: true,
          cron: '0 8 * * *',
          command: 'node',
          args: ['jobs/daily.cjs'],
          cwd: '.',
        },
      ],
    })
  )

  const config = loadConfig(configPath)

  assert.equal(config.jobs[0].command, 'node')
  assert.equal(config.jobs[0].args[0], path.join(dir, 'jobs', 'daily.cjs'))
  assert.equal(config.jobs[0].cwd, path.join(__dirname, '..'))
  fs.rmSync(dir, { recursive: true, force: true })
})

test('packaged config points task args at dist tasks directory', () => {
  const config = loadConfig(path.join(distRoot, 'config.json'))

  assert.equal(fs.existsSync(path.join(distRoot, 'worker.cjs')), true)
  assert.equal(fs.existsSync(path.join(distRoot, 'leetcode-daily.cjs')), false)
  assert.equal(fs.existsSync(path.join(distRoot, 'fetch-daily-info.cjs')), false)

  for (const job of config.jobs) {
    const taskArg = job.args.find((arg) => arg.endsWith('.cjs'))
    assert.ok(taskArg)
    assert.equal(path.dirname(taskArg), path.join(distRoot, 'tasks'))
    assert.equal(fs.existsSync(taskArg), true)
    assert.equal(job.cwd, repoRoot)
  }
})

test('packaged example config points task args at dist tasks directory', () => {
  const config = loadConfig(path.join(distRoot, 'config.example.json'))

  for (const job of config.jobs) {
    const taskArg = job.args.find((arg) => arg.endsWith('.cjs'))
    assert.ok(taskArg)
    assert.equal(path.dirname(taskArg), path.join(distRoot, 'tasks'))
  }
})
