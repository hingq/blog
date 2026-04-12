const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { pathToFileURL } = require('node:url')

test('getRobotsHost strips protocol, path, and port from site URLs', async () => {
  const { getRobotsHost } = await loadRobotsHost()

  assert.equal(getRobotsHost('https://www.fortunately.top'), 'www.fortunately.top')
  assert.equal(getRobotsHost('https://www.fortunately.top/'), 'www.fortunately.top')
  assert.equal(getRobotsHost('http://blog.example.com:8080/path?q=1'), 'blog.example.com')
})

test('robots route derives host through the shared helper', () => {
  const robotsSource = readFileSync(path.join(__dirname, '..', 'app', 'robots.ts'), 'utf8')

  assert.match(robotsSource, /getRobotsHost/)
})

function loadRobotsHost() {
  const moduleUrl = pathToFileURL(path.join(__dirname, '..', 'lib', 'robots-host.mjs')).href
  return import(moduleUrl)
}
