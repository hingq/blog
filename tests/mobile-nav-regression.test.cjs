const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const source = readFileSync(path.join(__dirname, '..', 'components/MobileNav.tsx'), 'utf8')

test('MobileNav uses a subtle frosted-glass backdrop and panel', () => {
  assert.match(source, /fixed inset-0 z-60 bg-white\/12 backdrop-blur-sm dark:bg-black\/20/)
  assert.match(
    source,
    /DialogPanel className="fixed top-0 left-0 z-70 h-full w-full border-l border-white\/30 bg-white\/78 shadow-2xl shadow-black\/20 backdrop-blur-xl duration-300 dark:border-white\/10 dark:bg-gray-950\/78"/
  )
})
