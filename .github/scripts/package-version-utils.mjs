import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/

export function assertValidPackageVersion(version) {
  const match = VERSION_PATTERN.exec(version)

  if (!match) {
    throw new Error(`Invalid package.json version: ${version}`)
  }

  return match
}

export function getNextMinorVersion(version) {
  const [, major, minor] = assertValidPackageVersion(version)
  return `${major}.${Number(minor) + 1}.0`
}

export async function readPackageVersion(packageJsonPath) {
  const resolvedPath = resolve(packageJsonPath)
  const packageJson = JSON.parse(await readFile(resolvedPath, 'utf8'))
  const version = packageJson.version

  assertValidPackageVersion(version)

  return {
    packageJson,
    packageJsonPath: resolvedPath,
    version,
  }
}
