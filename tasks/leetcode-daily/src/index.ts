import path from 'node:path'
import { writeBlogPost } from './blog'
import { questionCachePath, readJson, solutionCachePath, writeJson } from './cache'
import { cacheRoot, loadDotenv, projectRoot } from './config'
import { sendDailyEmail } from './email'
import { fetchDailyQuestion, fetchQuestionSolution } from './leetcode'
import type { DailyQuestion, SolutionCache } from './types'

function todayBeijing(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export async function runLeetcodeDaily() {
  const root = projectRoot()
  loadDotenv(path.join(root, '.env'))
  const today = todayBeijing()
  const rootCache = cacheRoot(root)

  console.log('1. 正在获取 LeetCode 每日一题数据...')
  const questionPath = questionCachePath(rootCache, today)
  let daily = readJson<DailyQuestion>(questionPath)
  if (daily) {
    console.log(`   命中题目缓存: ${questionPath}`)
  } else {
    daily = await fetchDailyQuestion()
    writeJson(questionPath, daily)
    console.log(`   请求成功并写入题目缓存: ${questionPath}`)
  }
  console.log(`   当前题目: ${daily.question.title}`)

  console.log('2. 正在获取 LeetCode 中文站题解...')
  const solutionPath = solutionCachePath(rootCache, today)
  const cachedSolution = readJson<SolutionCache>(solutionPath)
  let solution = cachedSolution?.content
  if (solution) {
    console.log(`   命中题解缓存: ${solutionPath}`)
  } else {
    const fetchedSolution = await fetchQuestionSolution(daily.question.titleSlug)
    solution = fetchedSolution.content
    writeJson(solutionPath, {
      date: daily.date,
      titleSlug: daily.question.titleSlug,
      solutionSlug: fetchedSolution.slug,
      sourceUrl: fetchedSolution.sourceUrl,
      content: fetchedSolution.content,
    })
    console.log(`   题解请求成功并写入缓存: ${solutionPath}`)
  }

  console.log('3. 正在写入本地博客文件...')
  const outputPath = writeBlogPost(root, daily, solution)
  console.log(`   文件已保存至: ${outputPath}`)

  const shouldSendEmail =
    process.env.SEND_EMAIL == null ||
    (process.env.SEND_EMAIL !== 'false' && process.env.SEND_EMAIL !== '0')
  if (shouldSendEmail) {
    console.log('4. 正在发送邮件通知...')
    try {
      await sendDailyEmail(daily)
      console.log('   邮件已成功发送至收件箱。')
    } catch (error) {
      console.error(`   邮件发送失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  } else {
    console.log('4. 跳过邮件发送。')
  }

  console.log('任务全部完成。')
}

if (require.main === module) {
  runLeetcodeDaily().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : error)
    process.exit(1)
  })
}
