const assert = require('node:assert/strict')
const test = require('node:test')

test('toSearchDocument normalizes date to YYYY-MM-DD without mutating the source post', async () => {
  const { toSearchDocument } = await import('../scripts/blog-utils.mjs')

  const post = {
    title: 'Example',
    date: '2026-04-02T00:00:00.000Z',
    path: 'blog/example',
    slug: 'example',
    summary: 'Summary',
    body: {
      code: 'return null',
    },
  }

  const searchDocument = toSearchDocument(post)

  assert.equal(searchDocument.date, '2026-04-02')
  assert.equal(post.date, '2026-04-02T00:00:00.000Z')
})
