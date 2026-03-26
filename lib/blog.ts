import { cache } from 'react'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { slug } from 'github-slugger'

export interface BlogPostBody {
  code: string
  raw?: string
}

export interface BlogPostRaw {
  flattenedPath?: string
  sourceFilePath?: string
}

export interface BlogPost {
  _id?: string
  _raw?: BlogPostRaw
  title: string
  date: string
  tags?: string[]
  lastmod?: string
  draft?: boolean
  summary?: string
  images?: string[] | string
  authors?: string[]
  layout?: string
  bibliography?: string
  canonicalUrl?: string
  readingTime?: Record<string, unknown>
  slug: string
  path: string
  filePath?: string
  toc?: Array<Record<string, unknown>>
  structuredData?: Record<string, unknown>
  body: BlogPostBody
}

export type CoreBlogPost = Omit<BlogPost, 'body' | '_id' | '_raw'>

const BLOG_INDEX_URL = process.env.BLOG_INDEX_URL
const REVALIDATE_SECONDS = 60
const isProduction = process.env.NODE_ENV === 'production'
const isDevelopment = process.env.NODE_ENV !== 'production'
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT
const MINIO_REGION = process.env.MINIO_REGION || 'us-east-1'
const MINIO_BUCKET = process.env.MINIO_BUCKET
const MINIO_BLOG_INDEX_KEY = process.env.MINIO_BLOG_INDEX_KEY
const MINIO_ACCESS_KEY_ID = process.env.MINIO_ACCESS_KEY_ID
const MINIO_SECRET_ACCESS_KEY = process.env.MINIO_SECRET_ACCESS_KEY
const MINIO_FORCE_PATH_STYLE = process.env.MINIO_FORCE_PATH_STYLE !== 'false'

function logBlogSource(message: string, ...args: unknown[]) {
  if (isDevelopment) {
    console.log(`[blog] ${message}`, ...args)
  }
}

function warnBlogSource(message: string, error: unknown) {
  const details = error instanceof Error ? error.message : error
  console.warn(`[blog] ${message}`, details)
}

function hasMinioRuntimeConfig() {
  return Boolean(
    MINIO_ENDPOINT &&
    MINIO_BUCKET &&
    MINIO_BLOG_INDEX_KEY &&
    MINIO_ACCESS_KEY_ID &&
    MINIO_SECRET_ACCESS_KEY
  )
}

function createMinioClient() {
  if (!hasMinioRuntimeConfig()) {
    throw new Error('MinIO runtime config is incomplete')
  }

  return new S3Client({
    endpoint: MINIO_ENDPOINT,
    region: MINIO_REGION,
    forcePathStyle: MINIO_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: MINIO_ACCESS_KEY_ID!,
      secretAccessKey: MINIO_SECRET_ACCESS_KEY!,
    },
  })
}

function assertBlogPost(post: unknown, index: number): asserts post is BlogPost {
  if (!post || typeof post !== 'object') {
    throw new Error(`Invalid blog post at index ${index}: expected object`)
  }

  const candidate = post as Partial<BlogPost>

  if (
    typeof candidate.title !== 'string' ||
    typeof candidate.date !== 'string' ||
    typeof candidate.slug !== 'string' ||
    typeof candidate.path !== 'string'
  ) {
    throw new Error(`Invalid blog post at index ${index}: missing required fields`)
  }

  if (!candidate.body || typeof candidate.body.code !== 'string') {
    throw new Error(`Invalid blog post at index ${index}: missing body.code`)
  }
}

function sortPosts<T extends { date: string }>(posts: T[]) {
  return [...posts].sort((a, b) => {
    if (a.date > b.date) return -1
    if (a.date < b.date) return 1
    return 0
  })
}

function corePost(post: BlogPost): CoreBlogPost {
  const { body, _id, _raw, ...rest } = post
  return rest
}

function filterDrafts<T extends { draft?: boolean }>(posts: T[]) {
  return isProduction ? posts.filter((post) => post.draft !== true) : posts
}

async function fetchBlogIndexFromMinio(): Promise<BlogPost[]> {
  if (!hasMinioRuntimeConfig()) {
    throw new Error('MinIO runtime config is incomplete')
  }

  logBlogSource('fetching private blog index from MinIO', `${MINIO_BUCKET}/${MINIO_BLOG_INDEX_KEY}`)
  const client = createMinioClient()
  const response = await client.send(
    new GetObjectCommand({
      Bucket: MINIO_BUCKET,
      Key: MINIO_BLOG_INDEX_KEY,
    })
  )
  logBlogSource('private blog index response', response.$metadata.httpStatusCode)

  if (!response.Body) {
    throw new Error('MinIO returned an empty blog index body')
  }

  const raw = await response.Body.transformToString()
  const payload = JSON.parse(raw)

  if (!Array.isArray(payload)) {
    throw new Error('Invalid blog index payload: expected a top-level array')
  }

  payload.forEach((post, index) => assertBlogPost(post, index))
  return payload
}

async function fetchBlogIndexFromPublicUrl(): Promise<BlogPost[]> {
  if (!BLOG_INDEX_URL) {
    throw new Error('BLOG_INDEX_URL is not configured')
  }

  logBlogSource('fetching public blog index', BLOG_INDEX_URL)
  const response = await fetch(BLOG_INDEX_URL, {
    next: { revalidate: REVALIDATE_SECONDS },
  })
  logBlogSource('public blog index response', response.status, response.statusText)

  if (!response.ok) {
    throw new Error(`Failed to fetch blog index: ${response.status} ${response.statusText}`)
  }

  const payload = await response.json()
  if (!Array.isArray(payload)) {
    throw new Error('Invalid blog index payload: expected a top-level array')
  }

  payload.forEach((post, index) => assertBlogPost(post, index))
  return payload
}

const loadBlogPosts = cache(async (): Promise<BlogPost[]> => {
  if (hasMinioRuntimeConfig()) {
    logBlogSource('using private MinIO blog index source')
    return fetchBlogIndexFromMinio()
  }

  if (BLOG_INDEX_URL) {
    logBlogSource('using public blog index source')
    return fetchBlogIndexFromPublicUrl()
  }

  const error = new Error(
    'Blog source is not configured. Set MinIO runtime env vars or BLOG_INDEX_URL.'
  )
  warnBlogSource('missing blog source configuration', error)
  throw error
})

export async function getAllPosts(): Promise<BlogPost[]> {
  const posts = await loadBlogPosts()
  return filterDrafts(sortPosts(posts))
}

export async function getAllCorePosts(): Promise<CoreBlogPost[]> {
  const posts = await getAllPosts()
  return posts.map(corePost)
}

export async function getPostBySlug(slug: string): Promise<BlogPost | undefined> {
  const posts = await getAllPosts()
  return posts.find((post) => post.slug === slug)
}

export async function getTagCounts(): Promise<Record<string, number>> {
  const posts = await getAllPosts()
  return posts.reduce<Record<string, number>>((acc, post) => {
    for (const tag of post.tags || []) {
      const normalizedTag = slug(tag)
      acc[normalizedTag] = (acc[normalizedTag] || 0) + 1
    }
    return acc
  }, {})
}

export async function getPostsByTag(tag: string): Promise<CoreBlogPost[]> {
  const posts = await getAllPosts()
  return posts
    .filter((post) => (post.tags || []).some((postTag) => slug(postTag) === tag))
    .map(corePost)
}

export async function getAdjacentPosts(slug: string): Promise<{
  prev?: CoreBlogPost
  next?: CoreBlogPost
}> {
  const posts = await getAllCorePosts()
  const index = posts.findIndex((post) => post.slug === slug)

  if (index === -1) {
    return {}
  }

  return {
    prev: posts[index + 1],
    next: posts[index - 1],
  }
}
