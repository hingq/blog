const assert = require('node:assert/strict')
const test = require('node:test')

const {
  formatLeetcodeContent,
  normalizeSolutionMarkdown,
  renderBlogPost,
} = require('../tasks/leetcode-daily/dist/blog.js')

test('formatLeetcodeContent converts LeetCode HTML into MDX-friendly markdown', () => {
  const html = `<p>给你一个整数 <code>x</code>。</p>

<p><img alt="" src="https://example.com/grid.png" style="width: 164px;" /></p>

<pre>
<strong>输入：</strong>grid = [[1,2]]
<strong>输出：</strong>3
</pre>

<ul>
  <li><code>1 &lt;= x &lt;= 10<sup>4</sup></code></li>
</ul>`

  const formatted = formatLeetcodeContent(html)

  assert.match(formatted, /给你一个整数 `x`。/)
  assert.match(formatted, /<Image src="https:\/\/example.com\/grid.png" alt="Image" \/>/)
  assert.match(formatted, /```text\n输入：grid = \[\[1,2\]\]\n输出：3\n```/)
  assert.match(formatted, /- `1 <= x <= 10\^4`/)
})

test('normalizeSolutionMarkdown removes top-level heading and horizontal rules', () => {
  const normalized = normalizeSolutionMarkdown(
    '# 题目标题\n\n### 解题思路\n\n内容\n\n---\n\n### 总结'
  )

  assert.equal(normalized.startsWith('# '), false)
  assert.match(normalized, /^### 解题思路/)
  assert.doesNotMatch(normalized, /\n---\n/)
})

test('renderBlogPost includes original link before problem content', () => {
  const daily = {
    date: '2026-04-28',
    link: '/problems/two-sum/',
    question: {
      title: '两数之和',
      titleSlug: 'two-sum',
      content: '<p>题目内容</p>',
      difficulty: 'Easy',
    },
  }

  const content = renderBlogPost(daily, '### 解题思路\n\n内容')

  assert.match(content, /## 原文链接\n\n\[两数之和\]\(https:\/\/leetcode.cn\/problems\/two-sum\/\)/)
  assert.ok(content.indexOf('## 原文链接') < content.indexOf('## 题目描述'))
})
