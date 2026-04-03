#!/usr/bin/env node

import { appendFile } from 'node:fs/promises'
import { readPackageVersion } from './package-version-utils.mjs'

async function main() {
  const packageJsonPath = process.argv[2] ?? 'package.json'
  const { version } = await readPackageVersion(packageJsonPath)

  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `package_version=${version}\n`, 'utf8')
  }

  console.log(`Resolved package version: ${version}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
