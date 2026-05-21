import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

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
  options: RunPublishOptions = {}
): Promise<void> {
  const env = options.env ?? process.env
  if (!shouldPublishContent(env)) {
    console.log('4. 跳过内容发布。')
    return
  }

  const scriptPath = resolvePublishScriptPath(projectRoot, options)
  const spawnCommand = options.spawnCommand ?? spawn

  console.log('4. 正在发布博客内容...')
  console.log(`   发布脚本: ${scriptPath}`)

  await new Promise<void>((resolve, reject) => {
    const child = spawnCommand(process.execPath, [scriptPath], {
      cwd: projectRoot,
      env: {
        ...env,
        TASKS_PROJECT_ROOT: projectRoot,
        CONTENT_PROJECT_ROOT: projectRoot,
        LEETCODE_DAILY_ONLY: 'true',
      },
      stdio: 'inherit',
    })

    child.once('error', (error) => {
      reject(new Error(`内容发布失败: ${error.message}`))
    })

    child.once('exit', (code, signal) => {
      if (code === 0) {
        console.log('   内容发布完成。')
        resolve()
        return
      }

      const reason = signal ? `signal ${signal}` : `exit code ${code}`
      reject(new Error(`内容发布失败: ${reason}`))
    })
  })
}
