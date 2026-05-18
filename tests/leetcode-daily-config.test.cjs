const assert = require('node:assert/strict')
const test = require('node:test')

const { parseEnvLine } = require('../tasks/dist/tasks/leetcode-daily-config.cjs')

test('parseEnvLine reads key value pairs and ignores comments', () => {
  assert.deepEqual(parseEnvLine(' SEND_EMAIL = "false" '), ['SEND_EMAIL', 'false'])
  assert.equal(parseEnvLine('# comment'), undefined)
  assert.equal(parseEnvLine(''), undefined)
})
