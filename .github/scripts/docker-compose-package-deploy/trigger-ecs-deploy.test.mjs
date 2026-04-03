import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const scriptPath = resolve('.github/scripts/docker-compose-package-deploy/trigger-ecs-deploy.sh')
const tempDirs = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

async function writeExecutable(filePath, contents) {
  await writeFile(filePath, contents, 'utf8')
  await chmod(filePath, 0o755)
}

test('passes the ECS instance id as a JSON array for the CLI array parameter', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'trigger-ecs-deploy-'))
  const mockBinDir = join(tempDir, 'bin')
  const githubEnvPath = join(tempDir, 'github-env.txt')
  const aliyunArgsPath = join(tempDir, 'aliyun-args.txt')

  tempDirs.push(tempDir)

  await writeFile(githubEnvPath, '', 'utf8')
  await writeFile(aliyunArgsPath, '', 'utf8')
  await writeFile(join(tempDir, '.keep'), '', 'utf8')

  await execFileAsync('mkdir', ['-p', mockBinDir], { cwd: resolve('.') })

  await writeExecutable(
    join(mockBinDir, 'aliyun'),
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$@" > "$ALIYUN_ARGS_PATH"
printf '%s\n' '{"CommandId":"cmd-123"}'
`
  )

  await writeExecutable(
    join(mockBinDir, 'base64'),
    `#!/usr/bin/env bash
set -euo pipefail
cat >/dev/null
printf '%s' 'encoded-command'
`
  )

  await execFileAsync('bash', [scriptPath], {
    cwd: resolve('.'),
    env: {
      ...process.env,
      ALIYUN_ARGS_PATH: aliyunArgsPath,
      DEPLOY_CMD: 'bash /blog/install.sh latest',
      GITHUB_ENV: githubEnvPath,
      INSTANCE_ID: 'i-2ze123example',
      PATH: `${mockBinDir}:${process.env.PATH}`,
      REGION_ID: 'cn-beijing',
    },
  })

  const aliyunArgs = await readFile(aliyunArgsPath, 'utf8')
  const githubEnv = await readFile(githubEnvPath, 'utf8')

  assert.match(aliyunArgs, /--InstanceId\n\["i-2ze123example"\]\n/)
  assert.doesNotMatch(aliyunArgs, /--InstanceId\.1\ni-2ze123example\n/)
  assert.match(githubEnv, /^COMMAND_ID=cmd-123$/m)
})
