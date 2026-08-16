const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const test = require('node:test')

test('robots route publishes the sitemap without the deprecated host directive', () => {
  const robotsSource = readFileSync(path.join(__dirname, '..', 'app', 'robots.ts'), 'utf8')

  assert.match(robotsSource, /sitemap:/)
  assert.doesNotMatch(robotsSource, /\bhost:/)
})
