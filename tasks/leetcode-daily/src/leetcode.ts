import type {
  DailyQuestion,
  LeetcodeSolution,
  QuestionResponse,
  SolutionArticleResponse,
  SolutionArticlesResponse,
  TodayRecordResponse,
} from './types'

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

export function mapSolutionArticle(
  questionSlug: string,
  articlesResp: SolutionArticlesResponse,
  articleResp: SolutionArticleResponse
): LeetcodeSolution {
  const solutionSlug = articlesResp.data.questionSolutionArticles.edges[0]?.node.slug
  if (!solutionSlug) throw new Error(`LeetCode 中文站未返回 ${questionSlug} 的可见题解`)

  const article = articleResp.data.solutionArticle
  if (!article?.content?.trim()) throw new Error(`LeetCode 中文站题解内容为空: ${solutionSlug}`)

  return {
    title: article.title,
    slug: article.slug || solutionSlug,
    sourceUrl: `/problems/${questionSlug}/solutions/${article.slug || solutionSlug}/`,
    content: article.content,
  }
}

export async function fetchQuestionSolution(questionSlug: string): Promise<LeetcodeSolution> {
  const articlesQuery = `
    query solutionArticles($questionSlug: String!) {
      questionSolutionArticles(questionSlug: $questionSlug, skip: 0, first: 1, orderBy: DEFAULT) {
        edges {
          node {
            title
            slug
          }
        }
      }
    }
  `
  const articlesResp = await postGraphql<SolutionArticlesResponse>({
    query: articlesQuery,
    variables: { questionSlug },
  })
  const solutionSlug = articlesResp.data.questionSolutionArticles.edges[0]?.node.slug
  if (!solutionSlug) throw new Error(`LeetCode 中文站未返回 ${questionSlug} 的可见题解`)

  const articleQuery = `
    query solutionArticle($slug: String!) {
      solutionArticle(slug: $slug) {
        title
        slug
        content
      }
    }
  `
  const articleResp = await postGraphql<SolutionArticleResponse>({
    query: articleQuery,
    variables: { slug: solutionSlug },
  })
  return mapSolutionArticle(questionSlug, articlesResp, articleResp)
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
