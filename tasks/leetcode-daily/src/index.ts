import { writeBlogPost } from './blog'
import { questionCachePath, readJson, solutionCachePath, writeJson } from './cache'
import { cacheRoot, loadConfiguredDotenv, projectRoot } from './config'
import { sendDailyEmail } from './email'
import { fetchDailyQuestion, fetchQuestionSolution } from './leetcode'
import { createTaskLogger, icon } from '../../shared/logger'
import { publishContent } from './publish'
import type { DailyQuestion, SolutionCache } from './types'
import { pathToFileURL } from 'node:url'

function todayBeijing(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

const TOTAL_STEPS = 5

export async function runLeetcodeDaily() {
  const log = createTaskLogger('LeetCode 每日一题')
  log.header()

  const root = projectRoot()
  loadConfiguredDotenv(root)
  const today = todayBeijing()
  const rootCache = cacheRoot(root)

  // Step 1 — 获取题目
  log.step(1, TOTAL_STEPS, icon.network, '获取每日一题数据')
  const daily = await log.timed(async () => {
    const questionPath = questionCachePath(rootCache, today)
    let result = readJson<DailyQuestion>(questionPath)
    if (result) {
      log.cacheHit('命中题目缓存')
      log.detail(questionPath)
    } else {
      result = await fetchDailyQuestion()
      writeJson(questionPath, result)
      log.success('请求成功并写入缓存')
      log.detail(questionPath)
    }
    log.info(`当前题目: ${result.question.title} (${result.question.difficulty})`)
    return result
  })

  // Step 2 — 获取题解
  log.step(2, TOTAL_STEPS, icon.network, '获取中文站题解')
  const solution = await log.timed(async () => {
    const solutionPath = solutionCachePath(rootCache, today)
    const cachedSolution = readJson<SolutionCache>(solutionPath)
    if (cachedSolution?.content) {
      log.cacheHit('命中题解缓存')
      log.detail(solutionPath)
      return cachedSolution.content
    }
    const fetchedSolution = await fetchQuestionSolution(daily.question.titleSlug)
    writeJson(solutionPath, {
      date: daily.date,
      titleSlug: daily.question.titleSlug,
      solutionSlug: fetchedSolution.slug,
      sourceUrl: fetchedSolution.sourceUrl,
      content: fetchedSolution.content,
    })
    log.success('题解请求成功并写入缓存')
    log.detail(solutionPath)
    return fetchedSolution.content
  })

  // Step 3 — 写入博客
  log.step(3, TOTAL_STEPS, icon.file, '写入本地博客文件')
  const outputPath = await log.timed(() => {
    const filePath = writeBlogPost(root, daily, solution)
    log.success('文件已保存')
    log.detail(filePath)
    return filePath
  })

  // Step 4 — 发布内容
  log.step(4, TOTAL_STEPS, icon.publish, '发布博客内容')
  await log.timed(() => publishContent(root, outputPath))

  // Step 5 — 邮件通知
  const shouldSendEmail =
    process.env.SEND_EMAIL == null ||
    (process.env.SEND_EMAIL !== 'false' && process.env.SEND_EMAIL !== '0')
  log.step(5, TOTAL_STEPS, icon.mail, '发送邮件通知')
  if (shouldSendEmail) {
    await log.timed(async () => {
      try {
        await sendDailyEmail(daily)
        log.success('邮件已成功发送至收件箱')
      } catch (error) {
        log.error(`邮件发送失败: ${error instanceof Error ? error.message : String(error)}`)
      }
    })
  } else {
    log.skip('跳过邮件发送 (SEND_EMAIL=false)')
  }

  log.summary()
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runLeetcodeDaily().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : error)
    process.exit(1)
  })
}
