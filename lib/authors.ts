import { cache } from 'react'
import matter from 'gray-matter'
import path from 'node:path'
import { readFile, readdir } from 'node:fs/promises'
import { remark } from 'remark'
import remarkRehype from 'remark-rehype'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { remarkAlert } from 'remark-github-blockquote-alert'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeKatex from 'rehype-katex'
import rehypeKatexNoTranslate from 'rehype-katex-notranslate'
import rehypeStringify from 'rehype-stringify'

const root = process.cwd()
const authorsDir = path.join(root, 'data', 'authors')

export interface AuthorBody {
  html: string
  raw?: string
}

export interface Author {
  name: string
  avatar?: string
  occupation?: string
  company?: string
  email?: string
  twitter?: string
  bluesky?: string
  linkedin?: string
  github?: string
  layout?: string
  slug: string
  path: string
  filePath: string
  body: AuthorBody
}

export type CoreAuthor = Omit<Author, 'body'>

async function getAuthorFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((entry) => {
      const fullPath = path.join(dir, entry.name)
      return entry.isDirectory() ? getAuthorFiles(fullPath) : [fullPath]
    })
  )

  return files.flat().filter((file) => file.endsWith('.mdx'))
}

async function compileMdx(source: string) {
  const result = await remark()
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkAlert)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: 'prepend' })
    .use(rehypeKatex)
    .use(rehypeKatexNoTranslate)
    .use(rehypeStringify)
    .process(source)

  return String(result)
}

const loadAuthors = cache(async (): Promise<Author[]> => {
  const files = await getAuthorFiles(authorsDir)

  return Promise.all(
    files.map(async (file) => {
      const source = await readFile(file, 'utf8')
      const { data, content } = matter(source)
      const relativePath = path.relative(authorsDir, file)
      const slug = relativePath.replace(/\.mdx$/, '').replace(/\\/g, '/')

      return {
        name: data.name,
        avatar: data.avatar,
        occupation: data.occupation,
        company: data.company,
        email: data.email,
        twitter: data.twitter,
        bluesky: data.bluesky,
        linkedin: data.linkedin,
        github: data.github,
        layout: data.layout,
        slug,
        path: `authors/${slug}`,
        filePath: path.relative(root, file).replace(/\\/g, '/'),
        body: {
          raw: content,
          html: await compileMdx(content),
        },
      } satisfies Author
    })
  )
})

export async function getAuthorBySlug(slug: string): Promise<Author | undefined> {
  const authors = await loadAuthors()
  return authors.find((author) => author.slug === slug)
}

export async function getAuthorsBySlugs(slugs: string[]): Promise<CoreAuthor[]> {
  const authors = await loadAuthors()

  return slugs
    .map((slug) => authors.find((author) => author.slug === slug))
    .filter((author): author is Author => Boolean(author))
    .map(({ body, ...author }) => author)
}
