const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const nextConfigSource = readFileSync(path.join(__dirname, '..', 'next.config.js'), 'utf8')

test('comment CSP allowlists Twikoo avatar and emoji hosts', () => {
  assert.match(nextConfigSource, /weavatar\.com/)
  assert.match(nextConfigSource, /owo\.imaegoo\.com/)
})
