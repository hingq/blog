const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { pathToFileURL } = require('node:url')

const configModule = import('../tasks/dist/worker-config.mjs')

const repoRoot = path.join(__dirname, '..')
const distRoot = path.join(repoRoot, 'tasks', 'dist')

test('validateConfig rejects duplicate job names', async () => {
  const { validateConfig } = await configModule
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

test('validateConfig allows disabled jobs without runtime fields', async () => {
  const { validateConfig } = await configModule
  const config = validateConfig({
    jobs: [{ name: 'paused', enabled: false }],
  })

  assert.equal(config.jobs[0].enabled, false)
})

test('validateConfig rejects enabled jobs without a command', async () => {
  const { validateConfig } = await configModule
  assert.throws(
    () =>
      validateConfig({
        jobs: [{ name: 'daily', enabled: true, cron: '0 8 * * *' }],
      }),
    /任务 daily 的 command 不能为空/
  )
})

test('loadConfig resolves packaged task paths from the config directory', async () => {
  const { loadConfig } = await configModule
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

test('packaged config points task args at dist tasks directory', async () => {
  const { loadConfig } = await configModule
  const config = loadConfig(path.join(distRoot, 'config.json'))
  const scriptsRoot = path.join(distRoot, 'scripts')
  const chunksRoot = path.join(scriptsRoot, 'chunks')
  const publishScript = fs.readFileSync(path.join(scriptsRoot, 'publish-content.mjs'), 'utf8')
  const scriptsPackage = JSON.parse(fs.readFileSync(path.join(scriptsRoot, 'package.json'), 'utf8'))
  const chunkFiles = fs.readdirSync(chunksRoot).filter((file) => file.endsWith('.mjs'))
  const scriptBundleText = [
    publishScript,
    fs.readFileSync(path.join(scriptsRoot, 'blog-utils.mjs'), 'utf8'),
    ...chunkFiles.map((file) => fs.readFileSync(path.join(chunksRoot, file), 'utf8')),
  ].join('\n')

  assert.equal(fs.existsSync(path.join(distRoot, 'package.json')), true)
  assert.equal(fs.existsSync(path.join(distRoot, 'worker.mjs')), true)
  assert.equal(fs.existsSync(path.join(scriptsRoot, 'publish-content.mjs')), true)
  assert.equal(fs.existsSync(path.join(scriptsRoot, 'blog-utils.mjs')), true)
  assert.equal(scriptsPackage.type, 'module')
  assert.ok(chunkFiles.length > 0)
  assert.match(publishScript, /_safeCreateRequire\(import\.meta\.url\)/)
  assert.match(publishScript, /const __dirname = _safeDirname\(__filename\)/)
  assert.doesNotMatch(publishScript, /from ['"]@aws-sdk\/client-s3['"]/)
  assert.match(publishScript, /from "\.\/chunks\/[^"]+\.mjs"/)
  assert.doesNotMatch(scriptBundleText, /uglify-js\/tools\/node\.js/)
  assert.doesNotMatch(scriptBundleText, /require\.resolve\(["']\.\.\/lib\/utils\.js["']\)/)

  const requireChunk = chunkFiles.find((file) => {
    const text = fs.readFileSync(path.join(chunksRoot, file), 'utf8')
    return (
      text.includes('_safeCreateRequire(import.meta.url)') &&
      /export\s*\{[\s\S]*__require[\s\S]*\}/.test(text)
    )
  })
  assert.ok(requireChunk)
  const { __require } = await import(pathToFileURL(path.join(chunksRoot, requireChunk)).href)
  assert.equal(__require('buffer').Buffer, Buffer)

  assert.equal(fs.existsSync(path.join(distRoot, 'worker.cjs')), false)
  assert.equal(fs.existsSync(path.join(distRoot, 'leetcode-daily.mjs')), false)
  assert.equal(fs.existsSync(path.join(distRoot, 'fetch-daily-info.mjs')), false)

  for (const job of config.jobs) {
    const taskArg = job.args.find((arg) => arg.endsWith('.mjs'))
    assert.ok(taskArg)
    assert.equal(path.dirname(taskArg), path.join(distRoot, 'tasks'))
    assert.equal(fs.existsSync(taskArg), true)
    assert.equal(job.cwd, '/blog/tasks')
  }
})

test('packaged example config points task args at dist tasks directory', async () => {
  const { loadConfig } = await configModule
  const config = loadConfig(path.join(distRoot, 'config.example.json'))

  for (const job of config.jobs) {
    const taskArg = job.args.find((arg) => arg.endsWith('.mjs'))
    assert.ok(taskArg)
    assert.equal(path.dirname(taskArg), path.join(distRoot, 'tasks'))
  }
})
