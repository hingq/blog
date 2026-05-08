const assert = require('node:assert/strict')
const test = require('node:test')

const {
  parseEnvLine,
  parseGeminiModels,
  readRequiredEnvTrimmed,
} = require('../tasks/leetcode-daily/dist/config.js')

test('parseEnvLine reads key value pairs and ignores comments', () => {
  assert.deepEqual(parseEnvLine(' GEMINI_API_KEY = "abc123" '), ['GEMINI_API_KEY', 'abc123'])
  assert.equal(parseEnvLine('# comment'), undefined)
  assert.equal(parseEnvLine(''), undefined)
})

test('parseGeminiModels removes empty and duplicate entries', () => {
  assert.deepEqual(parseGeminiModels(' gemini-a, ,gemini-a,gemini-b '), ['gemini-a', 'gemini-b'])
})

test('readRequiredEnvTrimmed returns the first non-empty environment value', () => {
  assert.equal(
    readRequiredEnvTrimmed(['MISSING_KEY', 'SECOND_KEY'], { SECOND_KEY: '  value  ' }),
    'value'
  )
})
