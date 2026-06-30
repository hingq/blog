import matter from 'gray-matter'
import path from 'node:path'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import readingTime from 'reading-time'
import { extractTocHeadings } from 'pliny/mdx-plugins/index.js'

export const projectRoot = process.env.CONTENT_PROJECT_ROOT
  ? path.resolve(process.env.CONTENT_PROJECT_ROOT)
  : process.env.TASKS_PROJECT_ROOT
    ? path.resolve(process.env.TASKS_PROJECT_ROOT)
    : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const blogDir = path.join(projectRoot, 'data', 'blog')

export function sortPosts(posts) {
  return [...posts].sort((a, b) => {
    if (a.date > b.date) return -1
    if (a.date < b.date) return 1
    return 0
  })
}

export function toCoreContent(post) {
  const { body, _raw, _id, ...rest } = post
  return rest
}

export function toSearchDocument(post) {
  const coreContent = toCoreContent(post)

  return {
    ...coreContent,
    date: typeof coreContent.date === 'string' ? coreContent.date.slice(0, 10) : coreContent.date,
  }
}

async function getMdxFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((entry) => {
      const fullPath = path.join(dir, entry.name)
      return entry.isDirectory() ? getMdxFiles(fullPath) : [fullPath]
    })
  )

  return files.flat().filter((file) => file.endsWith('.md') || file.endsWith('.mdx'))
}

let siteMetadataPromise

function fallbackSiteMetadata() {
  const siteUrl =
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.MINIO_PUBLIC_BASE_URL ||
    ''
  return {
    siteUrl: siteUrl.replace(/\/$/, ''),
    socialBanner: `${process.env.BASE_PATH || ''}/static/images/twitter-card.png`,
  }
}

async function loadSiteMetadata() {
  const metadataPath = path.join(projectRoot, 'data', 'siteMetadata.js')
  try {
    await readFile(metadataPath, 'utf8')
  } catch {
    return fallbackSiteMetadata()
  }

  siteMetadataPromise ??= import(pathToFileURL(metadataPath).href)
  const mod = await siteMetadataPromise
  return mod.default ?? mod
}

function getPrimaryImage(images, siteMetadata) {
  if (Array.isArray(images)) {
    return images[0]
  }

  return images || siteMetadata.socialBanner
}

async function compileOneFile(file, siteMetadata) {
  const source = await readFile(file, 'utf8')
  const { data, content } = matter(source)
  const sourceFilePath = path.relative(path.join(projectRoot, 'data'), file).replace(/\\/g, '/')
  const flattenedPath = sourceFilePath.replace(/\.mdx?$/, '')

  return {
    title: data.title,
    date: new Date(data.date).toISOString(),
    tags: data.tags || [],
    lastmod: data.lastmod ? new Date(data.lastmod).toISOString() : undefined,
    draft: data.draft,
    summary: data.summary,
    images: data.images,
    authors: data.authors,
    layout: data.layout,
    bibliography: data.bibliography,
    canonicalUrl: data.canonicalUrl,
    readingTime: readingTime(content),
    slug: flattenedPath.replace(/^.+?\//, ''),
    path: flattenedPath,
    filePath: sourceFilePath,
    // toc: await extractTocHeadings(content),
    structuredData: {
      // SEO
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: data.title,
      datePublished: new Date(data.date).toISOString(),
      dateModified: data.lastmod
        ? new Date(data.lastmod).toISOString()
        : new Date(data.date).toISOString(),
      description: data.summary,
      image: getPrimaryImage(data.images, siteMetadata),
      url: siteMetadata.siteUrl ? `${siteMetadata.siteUrl}/${flattenedPath}` : flattenedPath,
    },
    body: {
      raw: content,
    },
  }
}
/**
 * @description 限制并发
 */
async function mapLimit(items, limit, fn) {
  const ret = []
  const executing = new Set()

  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item))
    ret.push(p)
    executing.add(p)

    p.finally(() => executing.delete(p))

    if (executing.size >= limit) {
      await Promise.race(executing)
    }
  }

  return Promise.all(ret)
}
export async function compileLocalBlogPosts() {
  const files = await getMdxFiles(blogDir)
  const seenPaths = new Map()
  const siteMetadata = await loadSiteMetadata()

  return mapLimit(files, 8, async (file) => {
    const post = await compileOneFile(file, siteMetadata)

    const duplicatePath = seenPaths.get(post.path)
    if (duplicatePath) {
      throw new Error(
        `Duplicate blog path "${post.path}" from "${duplicatePath}" and "${post.filePath}"`
      )
    }

    seenPaths.set(post.path, post.filePath)
    return post
  })
}

export async function compileSingleBlogPost(filePath) {
  const absolutePath = path.resolve(filePath)
  const siteMetadata = await loadSiteMetadata()
  return compileOneFile(absolutePath, siteMetadata)
}
