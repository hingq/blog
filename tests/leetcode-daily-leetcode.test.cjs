const assert = require('node:assert/strict')
const test = require('node:test')

const { mapDailyQuestion, mapSolutionArticle } = require('../tasks/leetcode-daily/dist/leetcode.js')

test('mapDailyQuestion maps LeetCode GraphQL responses into internal shape', () => {
  const daily = mapDailyQuestion(
    { data: { todayRecord: [{ date: '2026-04-28', question: { titleSlug: 'two-sum' } }] } },
    {
      data: {
        question: {
          translatedTitle: '两数之和',
          titleSlug: 'two-sum',
          translatedContent: '<p>题目内容</p>',
          difficulty: 'Easy',
        },
      },
    }
  )

  assert.deepEqual(daily, {
    date: '2026-04-28',
    link: '/problems/two-sum/',
    question: {
      title: '两数之和',
      titleSlug: 'two-sum',
      content: '<p>题目内容</p>',
      difficulty: 'Easy',
    },
  })
})

test('mapSolutionArticle maps LeetCode solution responses into internal shape', () => {
  const solution = mapSolutionArticle(
    'two-sum',
    {
      data: {
        questionSolutionArticles: {
          edges: [{ node: { title: '官方题解', slug: 'official-solution' } }],
        },
      },
    },
    {
      data: {
        solutionArticle: {
          title: '官方题解',
          slug: 'official-solution',
          content: '### 方法一\n\n使用哈希表。',
        },
      },
    }
  )

  assert.deepEqual(solution, {
    title: '官方题解',
    slug: 'official-solution',
    sourceUrl: '/problems/two-sum/solutions/official-solution/',
    content: '### 方法一\n\n使用哈希表。',
  })
})

test('mapSolutionArticle fails when no visible solution is returned', () => {
  assert.throws(
    () =>
      mapSolutionArticle(
        'two-sum',
        { data: { questionSolutionArticles: { edges: [] } } },
        { data: { solutionArticle: null } }
      ),
    /未返回 two-sum 的可见题解/
  )
})

test('mapSolutionArticle fails when solution content is empty', () => {
  assert.throws(
    () =>
      mapSolutionArticle(
        'two-sum',
        {
          data: {
            questionSolutionArticles: {
              edges: [{ node: { title: '官方题解', slug: 'official-solution' } }],
            },
          },
        },
        {
          data: {
            solutionArticle: {
              title: '官方题解',
              slug: 'official-solution',
              content: '   ',
            },
          },
        }
      ),
    /题解内容为空: official-solution/
  )
})
