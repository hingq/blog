export type Question = {
  title: string
  titleSlug: string
  content: string
  difficulty: string
}

export type DailyQuestion = {
  date: string
  link: string
  question: Question
}

export type SolutionCache = {
  date: string
  titleSlug: string
  solutionSlug?: string
  sourceUrl?: string
  content: string
}

export type TodayRecordResponse = {
  data: {
    todayRecord: Array<{
      date: string
      question: {
        titleSlug: string
      }
    }>
  }
}

export type QuestionResponse = {
  data: {
    question: {
      translatedTitle: string
      titleSlug: string
      translatedContent: string
      difficulty: string
    }
  }
}

export type SolutionArticlesResponse = {
  data: {
    questionSolutionArticles: {
      edges: Array<{
        node: {
          title: string
          slug: string
        }
      }>
    }
  }
}

export type SolutionArticleResponse = {
  data: {
    solutionArticle: {
      title: string
      slug: string
      content: string
    } | null
  }
}

export type LeetcodeSolution = {
  title: string
  slug: string
  sourceUrl: string
  content: string
}
