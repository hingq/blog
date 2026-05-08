#!/usr/bin/env node
const { spawnSync } = require('node:child_process')
const path = require('node:path')

const root = path.resolve(__dirname, '../../..')
const build = spawnSync(process.execPath, [path.join(root, 'tasks/build.mjs')], {
  cwd: root,
  stdio: 'inherit',
})

if (build.status !== 0) {
  process.exit(build.status ?? 1)
}

require(path.join(root, 'tasks/worker/dist/cli.js'))
  .createProgram()
  .parseAsync(process.argv)
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
