#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const workerBundle = path.join(root, 'tasks/dist/worker.mjs')

if (!fs.existsSync(workerBundle)) {
  console.error('Worker bundle not found. Run `yarn tasks:build` first.')
  process.exit(1)
}

import(workerBundle)
  .then((mod) => mod.createProgram().parseAsync(process.argv))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
