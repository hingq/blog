const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const path = require('node:path')
const test = require('node:test')

const publishModule = import('../tasks/dist/tasks/leetcode-daily-publish.mjs')

test('shouldPublishContent is enabled by default and disabled by false or 0', async () => {
  const { shouldPublishContent } = await publishModule
  assert.equal(shouldPublishContent({}), true)
  assert.equal(shouldPublishContent({ PUBLISH_CONTENT: 'true' }), true)
  assert.equal(shouldPublishContent({ PUBLISH_CONTENT: 'false' }), false)
  assert.equal(shouldPublishContent({ PUBLISH_CONTENT: '0' }), false)
})

test('resolvePublishScriptPath uses packaged script when it exists', async () => {
  const { resolvePublishScriptPath } = await publishModule
  const taskDir = path.join('/repo', 'tasks', 'dist', 'tasks')
  const script = resolvePublishScriptPath('/repo', {
    taskDir,
    existsSync: (filePath) =>
      filePath === path.join('/repo', 'tasks', 'dist', 'scripts', 'publish-content.mjs'),
  })

  assert.equal(script, path.join('/repo', 'tasks', 'dist', 'scripts', 'publish-content.mjs'))
})

test('resolvePublishScriptPath falls back to source script', async () => {
  const { resolvePublishScriptPath } = await publishModule
  const script = resolvePublishScriptPath('/repo', {
    taskDir: path.join('/repo', 'tasks', 'dist', 'tasks'),
    existsSync: () => false,
  })

  assert.equal(script, path.join('/repo', 'scripts', 'publish-content.mjs'))
})

test('publishContent skips when publishing is disabled', async () => {
  const { publishContent } = await publishModule
  let spawned = false

  await publishContent('/repo', '/repo/data/blog/test-post.mdx', {
    env: { PUBLISH_CONTENT: 'false' },
    spawnCommand: () => {
      spawned = true
      throw new Error('should not spawn')
    },
  })

  assert.equal(spawned, false)
})

test('publishContent runs publish script with --single flag and file path', async () => {
  const { publishContent } = await publishModule
  const calls = []
  const blogFile = '/repo/data/blog/test-post.mdx'

  await publishContent('/repo', blogFile, {
    taskDir: path.join('/repo', 'tasks', 'dist', 'tasks'),
    existsSync: () => false,
    env: { PUBLISH_CONTENT: 'true', MINIO_BUCKET: 'bucket' },
    spawnCommand: (command, args, options) => {
      calls.push({ command, args, options })
      const child = new EventEmitter()
      process.nextTick(() => child.emit('exit', 0, null))
      return child
    },
  })

  assert.equal(calls.length, 1)
  assert.equal(calls[0].command, process.execPath)
  assert.deepEqual(calls[0].args, [
    path.join('/repo', 'scripts', 'publish-content.mjs'),
    '--single',
    blogFile,
  ])
  assert.equal(calls[0].options.cwd, '/repo')
  assert.equal(calls[0].options.env.TASKS_PROJECT_ROOT, '/repo')
  assert.equal(calls[0].options.env.CONTENT_PROJECT_ROOT, '/repo')
  assert.equal(calls[0].options.env.MINIO_BUCKET, 'bucket')
  assert.equal(calls[0].options.env.LEETCODE_DAILY_ONLY, undefined)
})

test('publishContent rejects when publish script exits unsuccessfully', async () => {
  const { publishContent } = await publishModule
  await assert.rejects(
    () =>
      publishContent('/repo', '/repo/data/blog/test-post.mdx', {
        env: {},
        spawnCommand: () => {
          const child = new EventEmitter()
          process.nextTick(() => child.emit('exit', 1, null))
          return child
        },
      }),
    /内容发布失败: exit code 1/
  )
})
