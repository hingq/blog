#!/usr/bin/env node

import { appendFile, readFile, writeFile } from 'node:fs/promises'
import { readPackageVersion, getNextMinorVersion } from './package-version-utils.mjs'

export async function bumpPackageVersion(packageJsonPath) {
  const {
    packageJson,
    packageJsonPath: resolvedPath,
    version: previousVersion,
  } = await readPackageVersion(packageJsonPath)
  const nextVersion = getNextMinorVersion(previousVersion)

  packageJson.version = nextVersion

  await writeFile(resolvedPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8')

  return {
    previousVersion,
    nextVersion,
  }
}

async function main() {
  const packageJsonPath = process.argv[2] ?? 'package.json'
  const { previousVersion, nextVersion } = await bumpPackageVersion(packageJsonPath)

  if (process.env.GITHUB_OUTPUT) {
    await appendFile(
      process.env.GITHUB_OUTPUT,
      [
        `previous_version=${previousVersion}`,
        `new_version=${nextVersion}`,
        'changed=true',
        '',
      ].join('\n'),
      'utf8'
    )
  }

  console.log(`Bumped package version from ${previousVersion} to ${nextVersion}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
