#!/usr/bin/env node
const path = require('node:path')
const fs = require('node:fs')

const root = path.resolve(__dirname, '../../..')
const workerBundle = path.join(root, 'tasks/dist/worker.cjs')

if (!fs.existsSync(workerBundle)) {
  console.error('Worker bundle not found. Run `yarn tasks:build` first.')
  process.exit(1)
}

require(workerBundle)
  .createProgram()
  .parseAsync(process.argv)
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
