import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const scriptPath = resolve('.github/scripts/bump-package-version.mjs')
const tempDirs = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

async function createPackageJson(version) {
  const tempDir = await mkdtemp(join(tmpdir(), 'bump-package-version-'))
  const packagePath = join(tempDir, 'package.json')

  tempDirs.push(tempDir)

  await writeFile(
    packagePath,
    `${JSON.stringify({ name: 'blog', version, private: true }, null, 2)}\n`,
    'utf8'
  )

  return { tempDir, packagePath }
}

test('bumps a 2.4.0 package version to the next minor and writes GitHub outputs', async () => {
  const { tempDir, packagePath } = await createPackageJson('2.4.0')
  const githubOutputPath = join(tempDir, 'github-output.txt')

  await execFileAsync(process.execPath, [scriptPath, packagePath], {
    cwd: resolve('.'),
    env: { ...process.env, GITHUB_OUTPUT: githubOutputPath },
  })

  const packageJson = JSON.parse(await readFile(packagePath, 'utf8'))
  const githubOutput = await readFile(githubOutputPath, 'utf8')

  assert.equal(packageJson.version, '2.5.0')
  assert.match(githubOutput, /^previous_version=2\.4\.0$/m)
  assert.match(githubOutput, /^new_version=2\.5\.0$/m)
})

test('bumps a 2.5.1 package version to 2.6.0', async () => {
  const { packagePath } = await createPackageJson('2.5.1')

  await execFileAsync(process.execPath, [scriptPath, packagePath], {
    cwd: resolve('.'),
  })

  const packageJson = JSON.parse(await readFile(packagePath, 'utf8'))
  assert.equal(packageJson.version, '2.6.0')
})

test('fails on an invalid semver version without changing package.json', async () => {
  const { packagePath } = await createPackageJson('2.5')

  await assert.rejects(
    execFileAsync(process.execPath, [scriptPath, packagePath], {
      cwd: resolve('.'),
    }),
    /Invalid package\.json version/
  )

  const packageJson = JSON.parse(await readFile(packagePath, 'utf8'))
  assert.equal(packageJson.version, '2.5')
})
