const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')

const { parseCli } = require('../tasks/dist/worker-cli.cjs')

test('parseCli parses list all', () => {
  const cli = parseCli(['node', 'worker', 'list', '--all'])

  assert.equal(cli.command, 'list')
  assert.equal(cli.all, true)
})

test('parseCli uses the packaged worker config by default', () => {
  const cli = parseCli(['node', 'worker', 'list'])

  assert.equal(cli.config, path.join(__dirname, '..', 'tasks', 'dist', 'config.json'))
})

test('parseCli parses list alias', () => {
  const cli = parseCli(['node', 'worker', 'ls'])

  assert.equal(cli.command, 'list')
})

test('parseCli parses run command name', () => {
  const cli = parseCli(['node', 'worker', '--config', 'worker.json', 'run', 'daily'])

  assert.equal(cli.command, 'run')
  assert.equal(cli.config, 'worker.json')
  assert.equal(cli.name, 'daily')
})

test('parseCli parses config and log level after subcommand', () => {
  const cli = parseCli(['node', 'worker', 'list', '-c', 'worker.json', '-l', 'debug'])

  assert.equal(cli.command, 'list')
  assert.equal(cli.config, 'worker.json')
  assert.equal(cli.logLevel, 'debug')
})

test('parseCli parses status', () => {
  const cli = parseCli(['node', 'worker', 'status'])

  assert.equal(cli.command, 'status')
})

test('parseCli parses json output option', () => {
  const cli = parseCli(['node', 'worker', 'list', '--json'])

  assert.equal(cli.command, 'list')
  assert.equal(cli.outputJson, true)
})
