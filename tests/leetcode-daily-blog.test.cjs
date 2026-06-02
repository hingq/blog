const assert = require('node:assert/strict')
const test = require('node:test')

const blogModule = import('../tasks/dist/tasks/leetcode-daily-blog.mjs')

test('formatLeetcodeContent converts LeetCode HTML into MDX-friendly markdown', async () => {
  const { formatLeetcodeContent } = await blogModule
  const html = `<p>给你一个整数 <code>x</code>。</p>

<p><img alt="" src="https://example.com/grid.png" style="width: 164px;" /></p>

<pre>
<strong>输入：</strong>grid = [[1,2]]
<strong>输出：</strong>3
</pre>

<ul>
  <li><code>1 &lt;= x &lt;= 10<sup>4</sup></code></li>
</ul>`

  const formatted = await formatLeetcodeContent(html)

  assert.match(formatted, /给你一个整数 `x`。/)
  assert.match(formatted, /<Image src="https:\/\/example.com\/grid.png" alt="Image" \/>/)
  assert.match(formatted, /```text\n输入：grid = \[\[1,2\]\]\n输出：3\n```/)
  assert.match(formatted, /- `1 <= x <= 10\^4`/)
})

test('formatLeetcodeContent strips unknown HTML tags but keeps their text', async () => {
  const { formatLeetcodeContent } = await blogModule
  const html = `<div class="note"><p>外层 <b>加粗</b> 与 <i>斜体</i> 文本。</p></div>
<table><tr><td>表格单元</td></tr></table>
<p><font color="red">红字</font></p>`

  const formatted = await formatLeetcodeContent(html)

  // No raw HTML tag should survive into the MDX.
  assert.doesNotMatch(formatted, /<\/?(div|b|i|table|tr|td|font)\b/i)
  // Text content of the stripped tags is preserved.
  assert.match(formatted, /外层/)
  assert.match(formatted, /加粗/)
  assert.match(formatted, /斜体/)
  assert.match(formatted, /表格单元/)
  assert.match(formatted, /红字/)
})

test('formatLeetcodeContent does not leak an unclosed tag', async () => {
  const { formatLeetcodeContent } = await blogModule
  const formatted = await formatLeetcodeContent('<p><strong>未闭合的内容</p>')

  assert.doesNotMatch(formatted, /<strong/i)
  assert.match(formatted, /未闭合的内容/)
})

test('normalizeSolutionMarkdown removes top-level heading and horizontal rules', async () => {
  const { normalizeSolutionMarkdown } = await blogModule
  const normalized = normalizeSolutionMarkdown(
    '# 题目标题\n\n### 解题思路\n\n内容\n\n---\n\n### 总结'
  )

  assert.equal(normalized.startsWith('# '), false)
  assert.match(normalized, /^### 解题思路/)
  assert.doesNotMatch(normalized, /\n---\n/)
})

test('renderBlogPost includes original link before problem content', async () => {
  const { renderBlogPost } = await blogModule
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

  const content = await renderBlogPost(daily, '### 解题思路\n\n内容')

  assert.match(content, /## 原文链接\n\n\[两数之和\]\(https:\/\/leetcode.cn\/problems\/two-sum\/\)/)
  assert.ok(content.indexOf('## 原文链接') < content.indexOf('## 题目描述'))
})

test('renderBlogPost keeps code-fence generics but strips stray prose tags', async () => {
  const { renderBlogPost } = await blogModule
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
  const solution =
    '### 解题思路\n\n用 <span>哈希表</span>。\n\n```cpp\nvector<int> twoSum(vector<int>& nums) {}\n```'

  const content = await renderBlogPost(daily, solution)

  // Generic inside the fenced code block survives.
  assert.match(content, /vector<int> twoSum\(vector<int>& nums\)/)
  // Stray prose tag is removed, text kept.
  assert.doesNotMatch(content, /<span>/)
  assert.match(content, /用 哈希表。/)
})
