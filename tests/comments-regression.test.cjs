const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const read = (relativePath) =>
  readFileSync(path.join(__dirname, '..', relativePath), 'utf8')

test('Comments wires Twikoo without any and with slug-based remounting', () => {
  const commentsSource = read('components/Comments.tsx')

  assert.doesNotMatch(commentsSource, /\sas any[\s).]/)
  assert.match(commentsSource, /<TwikooComments[^>]*key=\{slug\}/)
  assert.match(commentsSource, /<TwikooComments[^>]*slug=\{slug\}/)
})

test('TwikooComments reinitializes from slug changes instead of a one-time flag', () => {
  const twikooSource = read('components/TwikooComments.tsx')

  assert.doesNotMatch(twikooSource, /initialized/)
  assert.match(twikooSource, /slug/)
})
