import fs from 'node:fs'
import path from 'node:path'
import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import type { DailyQuestion } from './types'

export async function writeBlogPost(
  projectRoot: string,
  daily: DailyQuestion,
  solution: string
): Promise<string> {
  const outputDir = path.join(projectRoot, 'data', 'blog')
  fs.mkdirSync(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, `leetcode-${daily.question.titleSlug}.mdx`)
  fs.writeFileSync(outputPath, await renderBlogPost(daily, solution))
  return outputPath
}

export async function renderBlogPost(daily: DailyQuestion, solution: string): Promise<string> {
  const frontmatter = `---\ntitle: 'LeetCode: ${daily.question.title}'\ndate: '${daily.date}'\ntags: ['LeetCode', '算法']\ndraft: false\nsummary: '自动生成的 LeetCode 每日一题题解'\n---\n\n`
  const body = `${frontmatter}## 原文链接\n\n[${daily.question.title}](https://leetcode.cn${daily.link})\n\n## 题目描述\n\n${await formatLeetcodeContent(daily.question.content)}\n\n## 题解分析\n\n${normalizeSolutionMarkdown(solution)}`
  // 整篇写入前兜底：剥离任何残留 HTML 标签（含 LLM 题解里混入的），避免 MDX 编译崩溃。
  return stripStrayHtmlTags(body)
}

/**
 * Whitelist exactly the tags the regex converter below understands. Everything
 * else is dropped by rehype-sanitize while its text content is preserved, so no
 * unknown HTML can leak into the `.mdx` and break MDX compilation.
 */
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: ['p', 'ul', 'ol', 'li', 'pre', 'code', 'strong', 'em', 'sup', 'br', 'img'],
  attributes: {
    img: ['src', 'alt'],
  },
}

/** Parse → sanitize (drop unknown tags, keep text) → serialize back to HTML. */
async function sanitizeHtml(html: string): Promise<string> {
  const file = await unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeSanitize, sanitizeSchema)
    // useNamedReferences keeps &lt; &gt; &amp; &nbsp; so the decoder below matches.
    .use(rehypeStringify, { characterReferences: { useNamedReferences: true } })
    .process(html)
  return String(file)
}

export async function formatLeetcodeContent(content: string): Promise<string> {
  const sanitized = await sanitizeHtml(content)
  let output = stripHtmlAttribute(
    stripHtmlAttribute(sanitized.replace(/&nbsp;/g, ' ').replace(/\u00a0/g, ' '), 'class'),
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

/** Languages to keep in solution code blocks (case-insensitive match). */
const ALLOWED_LANGUAGES = new Set([
  'javascript',
  'js',
  'typescript',
  'ts',
  'rust',
  'go',
  'golang',
  'cpp',
  'c++',
  'text',
])

/**
 * Match opening fence: ```lang [optional-label]
 * Captures the language token (before any space/bracket).
 */
const CODE_FENCE_OPEN = /^```(\S+)?/

/**
 * Remove code blocks whose language is NOT in the whitelist.
 * Bare fences (no language) and `text` fences are always kept.
 */
export function filterCodeBlocksByLanguage(content: string): string {
  const lines = content.split(/\r?\n/)
  const result: string[] = []
  let skip = false

  for (const line of lines) {
    const trimmed = line.trim()

    if (skip) {
      // Currently inside a skipped block — wait for closing fence
      if (trimmed === '```') skip = false
      continue
    }

    const match = trimmed.match(CODE_FENCE_OPEN)
    if (match && trimmed !== '```') {
      // Extract the language token, strip bracket suffixes like "[sol1-C++]"
      const rawLang = (match[1] ?? '').split(/[\s[]/)[0].toLowerCase()
      if (rawLang && !ALLOWED_LANGUAGES.has(rawLang)) {
        skip = true
        continue
      }
    }

    result.push(line)
  }

  return result.join('\n')
}

export function normalizeSolutionMarkdown(content: string): string {
  const lines = content.trim().split(/\r?\n/)
  if (lines[0]?.trimStart().startsWith('# ')) {
    lines.shift()
    while (lines[0]?.trim() === '') lines.shift()
  }
  const normalized = lines.map((line) => (line.trim() === '---' ? '' : line)).join('\n')
  return collapseBlankLines(filterCodeBlocksByLanguage(normalized))
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

/**
 * Final guard before write: strip any residual HTML tag that MDX would try to
 * parse as JSX. Code fences are skipped so language generics like `vector<int>`
 * survive, and the intentional `<Image .../>` JSX is whitelisted. The pattern
 * only matches real tags (`<` followed by a letter), so `<=` / `>=` and `< 5`
 * are left untouched.
 */
function stripStrayHtmlTags(content: string): string {
  let inFence = false
  return content
    .split(/\r?\n/)
    .map((line) => {
      if (line.trim().startsWith('```')) {
        inFence = !inFence
        return line
      }
      if (inFence) return line
      return line.replace(/<\/?(?!Image\b)[A-Za-z][\w-]*(?:\s[^>]*?)?\/?>/g, '')
    })
    .join('\n')
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
