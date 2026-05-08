import fs from 'node:fs'
import path from 'node:path'
import type { DailyQuestion } from './types'

export function writeBlogPost(projectRoot: string, daily: DailyQuestion, solution: string): string {
  const outputDir = path.join(projectRoot, 'data', 'blog')
  fs.mkdirSync(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, `leetcode-${daily.question.titleSlug}.mdx`)
  fs.writeFileSync(outputPath, renderBlogPost(daily, solution))
  return outputPath
}

export function renderBlogPost(daily: DailyQuestion, solution: string): string {
  const frontmatter = `---\ntitle: 'LeetCode: ${daily.question.title}'\ndate: '${daily.date}'\ntags: ['LeetCode', '算法']\ndraft: false\nsummary: '自动生成的 LeetCode 每日一题题解'\n---\n\n`
  return `${frontmatter}## 原文链接\n\n[${daily.question.title}](https://leetcode.cn${daily.link})\n\n## 题目描述\n\n${formatLeetcodeContent(daily.question.content)}\n\n## 题解分析\n\n${normalizeSolutionMarkdown(solution)}`
}

export function formatLeetcodeContent(content: string): string {
  let output = stripHtmlAttribute(
    stripHtmlAttribute(content.replace(/&nbsp;/g, ' '), 'class'),
    'style'
  )
  output = output.replace(
    /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi,
    '<Image src="$1" alt="Image" />'
  )
  output = replaceBlocks(
    output,
    '<pre>',
    '</pre>',
    (inner) => `\n\n\`\`\`text\n${inlineHtmlToText(inner).trim()}\n\`\`\`\n\n`
  )
  output = replaceBlocks(output, '<ul>', '</ul>', (inner) => {
    const items = [...inner.matchAll(/<li>([\s\S]*?)<\/li>/gi)].map(
      (match) => `- ${inlineHtmlToMarkdown(match[1]).trim()}`
    )
    return `\n\n${items.join('\n')}\n\n`
  })
  output = replaceBlocks(output, '<p>', '</p>', (inner) => {
    const markdown = inlineHtmlToMarkdown(inner).trim()
    return markdown ? `\n\n${markdown}\n\n` : ''
  })
  return collapseBlankLines(inlineHtmlToMarkdown(output))
}

export function normalizeSolutionMarkdown(content: string): string {
  const lines = content.trim().split(/\r?\n/)
  if (lines[0]?.trimStart().startsWith('# ')) {
    lines.shift()
    while (lines[0]?.trim() === '') lines.shift()
  }
  return collapseBlankLines(lines.map((line) => (line.trim() === '---' ? '' : line)).join('\n'))
}

function replaceBlocks(
  content: string,
  open: string,
  close: string,
  convert: (inner: string) => string
): string {
  let output = ''
  let rest = content
  while (true) {
    const start = rest.indexOf(open)
    if (start < 0) return output + rest
    output += rest.slice(0, start)
    const innerStart = start + open.length
    const end = rest.indexOf(close, innerStart)
    if (end < 0) return output + rest.slice(start)
    output += convert(rest.slice(innerStart, end))
    rest = rest.slice(end + close.length)
  }
}

function inlineHtmlToMarkdown(content: string): string {
  return decodeHtmlEntities(content)
    .replace(/<code>/g, '`')
    .replace(/<\/code>/g, '`')
    .replace(/<strong>/g, '**')
    .replace(/<\/strong>/g, '**')
    .replace(/<em>/g, '_')
    .replace(/<\/em>/g, '_')
    .replace(/<sup>/g, '^')
    .replace(/<\/sup>/g, '')
    .trim()
}

function inlineHtmlToText(content: string): string {
  return decodeHtmlEntities(content)
    .replace(/<\/?(strong|code|em)>/g, '')
    .replace(/<sup>/g, '^')
    .replace(/<\/sup>/g, '')
    .trim()
}

function decodeHtmlEntities(content: string): string {
  return content
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function stripHtmlAttribute(content: string, attrName: string): string {
  return content.replace(new RegExp(`\\s${attrName}\\s*=\\s*("[^"]*"|'[^']*')`, 'gi'), '')
}

function collapseBlankLines(content: string): string {
  return content
    .split(/\r?\n/)
    .reduce<string[]>((lines, line) => {
      if (line.trim() || lines.at(-1) !== '') lines.push(line)
      return lines
    }, [])
    .join('\n')
    .trim()
}
