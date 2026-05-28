import esbuild from 'esbuild'
import fs from 'node:fs/promises'
import path from 'node:path'

const shared = {
  platform: 'node',
  target: 'node20',
  format: 'esm',
  splitting: true,
  sourcemap: false,
  metafile: true, // 已经开启
  bundle: true,
  logLevel: 'info',
  chunkNames: 'chunks/[name]-[hash]',
  outExtension: { '.js': '.mjs' },
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

// 修改此函数：接收并返回 esbuild 的 build 结果
async function buildPublishScripts() {
  await fs.mkdir(scriptBundleRoot, { recursive: true })
  await fs.writeFile(path.join(scriptBundleRoot, 'package.json'), '{\n  "type": "module"\n}\n')
  return esbuild.build({
    ...shared,
    entryPoints: ['scripts/publish-content.mjs', 'scripts/blog-utils.mjs'],
    outdir: scriptBundleRoot,
  })
}

await fs.rm(distRoot, { recursive: true, force: true })
await fs.rm(legacyTargetRoot, { recursive: true, force: true })
await fs.mkdir(taskBundleRoot, { recursive: true })

const entryPoints = {}

// 1. worker files
const workerFiles = await sourceEntryPoints('tasks/worker')
for (const file of workerFiles) {
  const base = path.basename(file, '.ts')
  entryPoints[`worker-${base}`] = file
}
entryPoints['worker'] = 'tasks/worker/src/cli.ts'

// 2. leetcode-daily files
const leetcodeFiles = await sourceEntryPoints('tasks/leetcode-daily')
for (const file of leetcodeFiles) {
  const base = path.basename(file, '.ts')
  entryPoints[`tasks/leetcode-daily-${base}`] = file
}
entryPoints['tasks/leetcode-daily'] = 'tasks/leetcode-daily/src/index.ts'

// 3. fetch-daily-info files
const fetchFiles = await sourceEntryPoints('tasks/fetch-daily-info')
for (const file of fetchFiles) {
  const base = path.basename(file, '.ts')
  entryPoints[`tasks/fetch-daily-info-${base}`] = file
}
entryPoints['tasks/fetch-daily-info'] = 'tasks/fetch-daily-info/src/index.ts'

// --- 核心修改部分 ---
// 1. 接收 Promise.all 返回的各个任务结果
const [mainResult, _, scriptsResult] = await Promise.all([
  esbuild.build({
    ...shared,
    entryPoints,
    outdir: distRoot,
  }),
  copyConfig(),
  buildPublishScripts(),
])

// 2. 将主打包的元数据写入 tasks/dist/meta-main.json
if (mainResult.metafile) {
  await fs.writeFile(
    path.join(distRoot, 'meta-main.json'),
    JSON.stringify(mainResult.metafile, null, 2)
  )
}

// 3. 将发布脚本的元数据写入 tasks/dist/meta-scripts.json
if (scriptsResult.metafile) {
  await fs.writeFile(
    path.join(distRoot, 'meta-scripts.json'),
    JSON.stringify(scriptsResult.metafile, null, 2)
  )
}
// --------------------
