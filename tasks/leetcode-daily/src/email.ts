import { sendMail } from '../../worker/src/mailer'
import type { DailyQuestion } from './types'

export async function sendDailyEmail(question: DailyQuestion) {
  await sendMail(
    `[LeetCode Daily] ${question.question.title}`,
    `<h3>${question.question.title} (${question.question.difficulty})</h3><p><a href='https://leetcode.cn${question.link}'>查看原题链接</a></p><hr/>${question.question.content}`
  )
}
