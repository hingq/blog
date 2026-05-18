import esbuild from 'esbuild'
import fs from 'node:fs/promises'
import path from 'node:path'

const shared = {
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: false,
}

const distRoot = 'tasks/dist'
const taskBundleRoot = path.join(distRoot, 'tasks')
const legacyTargetRoot = 'tasks/target'

const packagedTaskArgs = new Map([
  ['leetcode-daily.cjs', 'tasks/leetcode-daily.cjs'],
  ['fetch-daily-info.cjs', 'tasks/fetch-daily-info.cjs'],
])

async function sourceEntryPoints(packageRoot) {
  const srcRoot = path.join(packageRoot, 'src')
  const files = await fs.readdir(srcRoot)
  return files
    .filter((file) => file.endsWith('.ts') && file !== 'types.ts')
    .sort()
    .map((file) => path.join(srcRoot, file))
}

async function writePackagedConfig(sourcePath, outputName) {
  const config = JSON.parse(await fs.readFile(sourcePath, 'utf8'))
  config.jobs = config.jobs.map((job) => ({
    ...job,
    args: Array.isArray(job.args)
      ? job.args.map((arg) => packagedTaskArgs.get(arg) ?? arg)
      : job.args,
  }))
  await fs.writeFile(path.join(distRoot, outputName), `${JSON.stringify(config, null, 2)}\n`)
}

async function copyConfig() {
  await fs.mkdir(distRoot, { recursive: true })
  await writePackagedConfig('tasks/worker/config.json', 'config.json')
  await writePackagedConfig('tasks/worker/config.example.json', 'config.example.json')
}

async function buildModule(entryPoint, outputName, outputRoot = distRoot) {
  return esbuild.build({
    ...shared,
    bundle: true,
    entryPoints: [entryPoint],
    outfile: path.join(outputRoot, outputName),
  })
}

await fs.rm(distRoot, { recursive: true, force: true })
await fs.rm(legacyTargetRoot, { recursive: true, force: true })
await fs.mkdir(taskBundleRoot, { recursive: true })

await Promise.all([
  ...(await sourceEntryPoints('tasks/worker')).map((entryPoint) =>
    buildModule(entryPoint, `worker-${path.basename(entryPoint, '.ts')}.cjs`)
  ),
  ...(await sourceEntryPoints('tasks/leetcode-daily')).map((entryPoint) =>
    buildModule(entryPoint, `leetcode-daily-${path.basename(entryPoint, '.ts')}.cjs`, taskBundleRoot)
  ),
  ...(await sourceEntryPoints('tasks/fetch-daily-info')).map((entryPoint) =>
    buildModule(
      entryPoint,
      `fetch-daily-info-${path.basename(entryPoint, '.ts')}.cjs`,
      taskBundleRoot
    )
  ),
  buildModule('tasks/worker/src/cli.ts', 'worker.cjs'),
  buildModule('tasks/leetcode-daily/src/index.ts', 'leetcode-daily.cjs', taskBundleRoot),
  buildModule('tasks/fetch-daily-info/src/index.ts', 'fetch-daily-info.cjs', taskBundleRoot),
  copyConfig(),
])
