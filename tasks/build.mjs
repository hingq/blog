import esbuild from 'esbuild'
import fs from 'node:fs/promises'
import path from 'node:path'

const shared = {
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: false,
  banner: {
    js: [
      "import { createRequire as __taskCreateRequire } from 'node:module';",
      "import { fileURLToPath as __taskFileURLToPath } from 'node:url';",
      "import { dirname as __taskDirname } from 'node:path';",
      'const require = __taskCreateRequire(import.meta.url);',
      'const __filename = __taskFileURLToPath(import.meta.url);',
      'const __dirname = __taskDirname(__filename);',
    ].join('\n'),
  },
}

const distRoot = 'tasks/dist'
const taskBundleRoot = path.join(distRoot, 'tasks')
const scriptBundleRoot = path.join(distRoot, 'scripts')
const legacyTargetRoot = 'tasks/target'

const packagedTaskArgs = new Map([
  ['leetcode-daily.cjs', 'tasks/leetcode-daily.mjs'],
  ['leetcode-daily.mjs', 'tasks/leetcode-daily.mjs'],
  ['fetch-daily-info.cjs', 'tasks/fetch-daily-info.mjs'],
  ['fetch-daily-info.mjs', 'tasks/fetch-daily-info.mjs'],
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
  await fs.writeFile(path.join(distRoot, 'package.json'), '{\n  "type": "module"\n}\n')
  await writePackagedConfig('tasks/worker/config.json', 'config.json')
  await writePackagedConfig('tasks/worker/config.example.json', 'config.example.json')
}

async function buildPublishScripts() {
  await fs.mkdir(scriptBundleRoot, { recursive: true })
  await fs.writeFile(path.join(scriptBundleRoot, 'package.json'), '{\n  "type": "module"\n}\n')
  return esbuild.build({
    ...shared,
    format: 'esm',
    bundle: true,
    splitting: true,
    logLevel: 'info',
    entryPoints: ['scripts/publish-content.mjs', 'scripts/blog-utils.mjs'],
    outdir: scriptBundleRoot,
    entryNames: '[name]',
    chunkNames: 'chunks/[name]-[hash]',
    outExtension: { '.js': '.mjs' },
  })
}

async function buildModule(entryPoint, outputName, outputRoot = distRoot) {
  return esbuild.build({
    ...shared,
    bundle: true,
    logLevel: 'info',
    entryPoints: [entryPoint],
    outfile: path.join(outputRoot, outputName),
  })
}

await fs.rm(distRoot, { recursive: true, force: true })
await fs.rm(legacyTargetRoot, { recursive: true, force: true })
await fs.mkdir(taskBundleRoot, { recursive: true })

await Promise.all([
  ...(await sourceEntryPoints('tasks/worker')).map((entryPoint) =>
    buildModule(entryPoint, `worker-${path.basename(entryPoint, '.ts')}.mjs`)
  ),
  ...(await sourceEntryPoints('tasks/leetcode-daily')).map((entryPoint) =>
    buildModule(
      entryPoint,
      `leetcode-daily-${path.basename(entryPoint, '.ts')}.mjs`,
      taskBundleRoot
    )
  ),
  ...(await sourceEntryPoints('tasks/fetch-daily-info')).map((entryPoint) =>
    buildModule(
      entryPoint,
      `fetch-daily-info-${path.basename(entryPoint, '.ts')}.mjs`,
      taskBundleRoot
    )
  ),
  buildModule('tasks/worker/src/cli.ts', 'worker.mjs'),
  buildModule('tasks/leetcode-daily/src/index.ts', 'leetcode-daily.mjs', taskBundleRoot),
  buildModule('tasks/fetch-daily-info/src/index.ts', 'fetch-daily-info.mjs', taskBundleRoot),
  copyConfig(),
  buildPublishScripts(),
])
