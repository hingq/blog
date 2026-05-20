const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')

const configModule = import('../tasks/dist/tasks/leetcode-daily-config.mjs')

test('parseEnvLine reads key value pairs and ignores comments', async () => {
  const { parseEnvLine } = await configModule
  assert.deepEqual(parseEnvLine(' SEND_EMAIL = "false" '), ['SEND_EMAIL', 'false'])
  assert.equal(parseEnvLine('# comment'), undefined)
  assert.equal(parseEnvLine(''), undefined)
})

test('resolveDotenvPath defaults to project .env', async () => {
  const { LEETCODE_DAILY_ENV_PATH, resolveDotenvPath } = await configModule
  const previous = process.env[LEETCODE_DAILY_ENV_PATH]
  delete process.env[LEETCODE_DAILY_ENV_PATH]

  assert.equal(resolveDotenvPath('/repo'), path.join('/repo', '.env'))

  if (previous == null) {
    delete process.env[LEETCODE_DAILY_ENV_PATH]
  } else {
    process.env[LEETCODE_DAILY_ENV_PATH] = previous
  }
})

test('inferProjectRoot finds project data directory across packaged layouts', async () => {
  const { inferProjectRoot } = await configModule
  const existing = new Set([
    path.join('/repo', 'data', 'blog'),
    path.join('/blog', 'data', 'blog'),
  ])
  const existsSync = (filePath) => existing.has(filePath)

  assert.equal(inferProjectRoot('/repo/tasks/dist/tasks', existsSync), '/repo')
  assert.equal(inferProjectRoot('/blog/tasks/tasks', existsSync), '/blog')
})

test('inferProjectRoot supports production content rooted at /data', async () => {
  const { inferProjectRoot } = await configModule
  const existing = new Set([path.join('/data', 'blog'), path.join('/blog', '.env')])
  const existsSync = (filePath) => existing.has(filePath)

  assert.equal(inferProjectRoot('/blog/tasks/tasks', existsSync), '/')
})

test('resolveDotenvPath reads configured relative and absolute env paths', async () => {
  const { LEETCODE_DAILY_ENV_PATH, resolveDotenvPath } = await configModule
  const previous = process.env[LEETCODE_DAILY_ENV_PATH]

  process.env[LEETCODE_DAILY_ENV_PATH] = 'config/prod.env'
  assert.equal(resolveDotenvPath('/repo'), path.join('/repo', 'config', 'prod.env'))

  process.env[LEETCODE_DAILY_ENV_PATH] = '/etc/app.env'
  assert.equal(resolveDotenvPath('/repo'), '/etc/app.env')

  if (previous == null) {
    delete process.env[LEETCODE_DAILY_ENV_PATH]
  } else {
    process.env[LEETCODE_DAILY_ENV_PATH] = previous
  }
})
