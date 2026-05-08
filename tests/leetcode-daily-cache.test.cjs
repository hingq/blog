const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const {
  questionCachePath,
  readJson,
  solutionCachePath,
  writeJson,
} = require('../tasks/leetcode-daily/dist/cache.js')

test('cache path helpers build separate question and solution paths', () => {
  const root = path.join('/repo', 'data', 'leetcode-daily')

  assert.equal(
    questionCachePath(root, '2026-04-28'),
    path.join(root, 'questions', '2026-04-28.json')
  )
  assert.equal(
    solutionCachePath(root, '2026-04-28'),
    path.join(root, 'solutions', '2026-04-28.json')
  )
})

test('readJson and writeJson round trip cache files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'leetcode-daily-cache-'))
  const file = path.join(dir, 'nested', 'cache.json')

  writeJson(file, { value: 'cached' })

  assert.deepEqual(readJson(file), { value: 'cached' })
  fs.rmSync(dir, { recursive: true, force: true })
})
