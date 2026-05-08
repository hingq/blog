import type { DailyQuestion, QuestionResponse, TodayRecordResponse } from './types'

const LEETCODE_GRAPHQL_URL = 'https://leetcode.cn/graphql'

export function mapDailyQuestion(
  todayResp: TodayRecordResponse,
  questionResp: QuestionResponse
): DailyQuestion {
  const today = todayResp.data.todayRecord[0]
  if (!today) throw new Error('LeetCode 中文站未返回每日一题')
  const question = questionResp.data.question
  return {
    date: today.date,
    link: `/problems/${question.titleSlug}/`,
    question: {
      title: question.translatedTitle,
      titleSlug: question.titleSlug,
      content: question.translatedContent,
      difficulty: question.difficulty,
    },
  }
}

export async function fetchDailyQuestion(): Promise<DailyQuestion> {
  const todayQuery = `
    query questionOfToday {
      todayRecord {
        date
        question {
          titleSlug
        }
      }
    }
  `
  const todayResp = await postGraphql<TodayRecordResponse>({ query: todayQuery })
  const titleSlug = todayResp.data.todayRecord[0]?.question.titleSlug
  if (!titleSlug) throw new Error('LeetCode 中文站未返回每日一题 slug')

  const questionQuery = `
    query questionData($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        translatedTitle
        titleSlug
        translatedContent
        difficulty
      }
    }
  `
  const questionResp = await postGraphql<QuestionResponse>({
    query: questionQuery,
    variables: { titleSlug },
  })
  return mapDailyQuestion(todayResp, questionResp)
}

async function postGraphql<T>(body: unknown): Promise<T> {
  const response = await fetch(LEETCODE_GRAPHQL_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok)
    throw new Error(`LeetCode GraphQL 请求失败: HTTP ${response.status}: ${await response.text()}`)
  return (await response.json()) as T
}
