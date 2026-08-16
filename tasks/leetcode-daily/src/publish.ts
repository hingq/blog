import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { c, icon } from '../../shared/logger'

export type PublishScriptOptions = {
  taskDir?: string
  existsSync?: (filePath: string) => boolean
}

export type RunPublishOptions = PublishScriptOptions & {
  env?: NodeJS.ProcessEnv
  spawnCommand?: typeof spawn
}

export function isEnabledEnv(value: string | undefined): boolean {
  return value == null || (value !== 'false' && value !== '0')
}

export function shouldPublishContent(env: NodeJS.ProcessEnv = process.env): boolean {
  return isEnabledEnv(env.PUBLISH_CONTENT)
}

export function resolvePublishScriptPath(
  projectRoot: string,
  options: PublishScriptOptions = {}
): string {
  const taskDir = options.taskDir ?? __dirname
  const existsSync = options.existsSync ?? fs.existsSync
  const packagedScript = path.resolve(taskDir, '..', 'scripts', 'publish-content.mjs')
  if (existsSync(packagedScript)) return packagedScript
  return path.join(projectRoot, 'scripts', 'publish-content.mjs')
}

export async function publishContent(
  projectRoot: string,
  blogFilePath: string,
  options: RunPublishOptions = {}
): Promise<void> {
  const env = options.env ?? process.env
  if (!shouldPublishContent(env)) {
    console.log(`  ${icon.skip}${c.gray('跳过内容发布 (PUBLISH_CONTENT=false)')}`)
    return
  }

  const scriptPath = resolvePublishScriptPath(projectRoot, options)
  const spawnCommand = options.spawnCommand ?? spawn

  console.log(`  ${icon.publish} ${c.dim('单文件模式')}`)
  console.log(`     ${c.dim(`脚本: ${scriptPath}`)}`)
  console.log(`     ${c.dim(`文件: ${blogFilePath}`)}`)

  await new Promise<void>((resolve, reject) => {
    const child = spawnCommand(process.execPath, [scriptPath, '--single', blogFilePath], {
      cwd: projectRoot,
      env: {
        ...env,
        TASKS_PROJECT_ROOT: projectRoot,
        CONTENT_PROJECT_ROOT: projectRoot,
      },
      stdio: 'inherit',
    })

    child.once('error', (error) => {
      reject(new Error(`内容发布失败: ${error.message}`))
    })

    child.once('exit', (code, signal) => {
      if (code === 0) {
        console.log(`  ${icon.success} ${c.green('内容发布完成')}`)
        resolve()
        return
      }

      const reason = signal ? `signal ${signal}` : `exit code ${code}`
      reject(new Error(`内容发布失败: ${reason}`))
    })
  })
}
