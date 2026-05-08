const assert = require('node:assert/strict')
const test = require('node:test')

const { mapDailyQuestion } = require('../tasks/leetcode-daily/dist/leetcode.js')

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
