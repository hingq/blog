const assert = require('node:assert/strict')
const test = require('node:test')

const {
  buildGenerateContentRequest,
  extractGeminiText,
  parseMaxOutputTokens,
  parseModelRequestTimeoutMs,
} = require('../tasks/leetcode-daily/dist/gemini.js')

test('Gemini option parsers fall back for invalid values', () => {
  assert.equal(parseModelRequestTimeoutMs('10'), 10_000)
  assert.equal(parseModelRequestTimeoutMs('0'), 90_000)
  assert.equal(parseMaxOutputTokens('2048'), 2048)
  assert.equal(parseMaxOutputTokens('invalid'), 4096)
})

test('buildGenerateContentRequest uses Gemini generateContent shape', () => {
  const body = buildGenerateContentRequest('写一段题解', 1234)

  assert.equal(body.contents[0].parts[0].text, '写一段题解')
  assert.equal(body.generationConfig.maxOutputTokens, 1234)
  assert.equal(body.model, undefined)
})

test('extractGeminiText returns the first non-empty text part', () => {
  const text = extractGeminiText({
    candidates: [{ content: { parts: [{ text: '' }, { text: '题解内容' }] } }],
  })

  assert.equal(text, '题解内容')
})
