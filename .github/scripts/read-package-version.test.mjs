import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const scriptPath = resolve('.github/scripts/read-package-version.mjs')
const tempDirs = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

async function createPackageJson(version) {
  const tempDir = await mkdtemp(join(tmpdir(), 'read-package-version-'))
  const packagePath = join(tempDir, 'package.json')

  tempDirs.push(tempDir)

  await writeFile(
    packagePath,
    `${JSON.stringify({ name: 'blog', version, private: true }, null, 2)}\n`,
    'utf8'
  )

  return { tempDir, packagePath }
}

test('reads a valid package version and writes it to GitHub outputs', async () => {
  const { tempDir, packagePath } = await createPackageJson('2.5.1')
  const githubOutputPath = join(tempDir, 'github-output.txt')

  const { stdout } = await execFileAsync(process.execPath, [scriptPath, packagePath], {
    cwd: resolve('.'),
    env: { ...process.env, GITHUB_OUTPUT: githubOutputPath },
  })

  const githubOutput = await readFile(githubOutputPath, 'utf8')

  assert.match(stdout, /Resolved package version: 2\.5\.1/)
  assert.match(githubOutput, /^package_version=2\.5\.1$/m)
})

test('fails on an invalid package version', async () => {
  const { packagePath } = await createPackageJson('2.5')

  await assert.rejects(
    execFileAsync(process.execPath, [scriptPath, packagePath], {
      cwd: resolve('.'),
    }),
    /Invalid package\.json version/
  )
})
