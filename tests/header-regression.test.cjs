const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const headerSource = readFileSync(path.join(__dirname, '..', 'components/Header.tsx'), 'utf8')

test('Header includes a bottom border consistent with site separators', () => {
  assert.match(headerSource, /border-b/)
  assert.match(headerSource, /border-gray-100/)
  assert.match(headerSource, /dark:border-gray-800/)
})
