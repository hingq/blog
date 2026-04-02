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

test('TwikooComments resolves init from either default or named exports', () => {
  const twikooSource = read('components/TwikooComments.tsx')

  assert.doesNotMatch(
    twikooSource,
    /const twikoo = m\.default \?\? m[\s\S]{0,120}twikoo\.init\(/
  )
  assert.match(twikooSource, /m\.default[\s\S]{0,200}m\.init|m\.init[\s\S]{0,200}m\.default/)
})

test('Comments renders a structured Chinese comment section before loading providers', () => {
  const commentsSource = read('components/Comments.tsx')

  assert.match(commentsSource, />评论</)
  assert.match(commentsSource, /欢迎交流、补充或指出问题。/)
  assert.match(commentsSource, /加载评论/)
  assert.match(commentsSource, /comment-section/)
})

test('TwikooComments exposes a scoped root class for comment styling', () => {
  const twikooSource = read('components/TwikooComments.tsx')

  assert.match(twikooSource, /className="comment-thread comment-thread-twikoo"/)
  assert.match(twikooSource, /id=\{commentElementId\}/)
})

test('Post layouts do not center comment content at the layout level', () => {
  const layoutSources = [
    read('layouts/PostLayout.tsx'),
    read('layouts/PostBanner.tsx'),
    read('layouts/PostSimple.tsx'),
  ]

  for (const source of layoutSources) {
    assert.doesNotMatch(source, /id="comment"[\s\S]{0,120}text-center/)
    assert.doesNotMatch(source, /text-center[\s\S]{0,120}id="comment"/)
  }
})
