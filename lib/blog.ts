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
const BLOG_POSTS_BASE_URL = process.env.BLOG_POSTS_BASE_URL
const REVALIDATE_SECONDS = 60
const isProduction = process.env.NODE_ENV === 'production'
const isDevelopment = process.env.NODE_ENV !== 'production'
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT
const MINIO_REGION = process.env.MINIO_REGION || 'us-east-1'
const MINIO_BUCKET = process.env.MINIO_BUCKET
const MINIO_BLOG_INDEX_KEY = process.env.MINIO_BLOG_INDEX_KEY
const MINIO_POSTS_PREFIX = process.env.MINIO_POSTS_PREFIX ?? 'posts/'
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

function assertCorePost(post: unknown, index: number): asserts post is CoreBlogPost {
  if (!post || typeof post !== 'object') {
    throw new Error(`Invalid blog post at index ${index}: expected object`)
  }

  const candidate = post as Partial<CoreBlogPost>

  if (
    typeof candidate.title !== 'string' ||
    typeof candidate.date !== 'string' ||
    typeof candidate.slug !== 'string' ||
    typeof candidate.path !== 'string'
  ) {
    throw new Error(`Invalid blog post at index ${index}: missing required fields`)
  }
}

function assertBlogPost(post: unknown, index: number): asserts post is BlogPost {
  assertCorePost(post, index)

  const candidate = post as Partial<BlogPost>
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

function filterDrafts<T extends { draft?: boolean }>(posts: T[]) {
  return isProduction ? posts.filter((post) => post.draft !== true) : posts
}

async function fetchIndexFromMinio(): Promise<CoreBlogPost[]> {
  logBlogSource('fetching blog index from MinIO', `${MINIO_BUCKET}/${MINIO_BLOG_INDEX_KEY}`)
  const client = createMinioClient()
  const response = await client.send(
    new GetObjectCommand({
      Bucket: MINIO_BUCKET,
      Key: MINIO_BLOG_INDEX_KEY,
    })
  )
  logBlogSource('blog index response', response.$metadata.httpStatusCode)

  if (!response.Body) {
    throw new Error('MinIO returned an empty blog index body')
  }

  const raw = await response.Body.transformToString()
  const payload = JSON.parse(raw)

  if (!Array.isArray(payload)) {
    throw new Error('Invalid blog index payload: expected a top-level array')
  }

  payload.forEach((post, index) => assertCorePost(post, index))
  return payload
}

async function fetchIndexFromPublicUrl(): Promise<CoreBlogPost[]> {
  if (!BLOG_INDEX_URL) {
    throw new Error('BLOG_INDEX_URL is not configured')
  }

  logBlogSource('fetching blog index', BLOG_INDEX_URL)
  const response = await fetch(BLOG_INDEX_URL, {
    next: { revalidate: REVALIDATE_SECONDS },
  })
  logBlogSource('blog index response', response.status, response.statusText)

  if (!response.ok) {
    throw new Error(`Failed to fetch blog index: ${response.status} ${response.statusText}`)
  }

  const payload = await response.json()
  if (!Array.isArray(payload)) {
    throw new Error('Invalid blog index payload: expected a top-level array')
  }

  payload.forEach((post, index) => assertCorePost(post, index))
  return payload
}

async function fetchPostFromMinio(postSlug: string): Promise<BlogPost> {
  const key = `${MINIO_POSTS_PREFIX}${postSlug}.json`
  logBlogSource('fetching post from MinIO', `${MINIO_BUCKET}/${key}`)
  const client = createMinioClient()
  const response = await client.send(new GetObjectCommand({ Bucket: MINIO_BUCKET, Key: key }))

  if (!response.Body) {
    throw new Error(`MinIO returned empty body for post: ${postSlug}`)
  }

  const raw = await response.Body.transformToString()
  const post = JSON.parse(raw)
  assertBlogPost(post, 0)
  return post
}

async function fetchPostFromPublicUrl(postSlug: string): Promise<BlogPost> {
  if (!BLOG_POSTS_BASE_URL) {
    throw new Error('BLOG_POSTS_BASE_URL is not configured')
  }

  const base = BLOG_POSTS_BASE_URL.endsWith('/') ? BLOG_POSTS_BASE_URL : `${BLOG_POSTS_BASE_URL}/`
  const url = `${base}${postSlug}.json`
  logBlogSource('fetching post', url)
  const response = await fetch(url, {
    next: { revalidate: REVALIDATE_SECONDS },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch post ${postSlug}: ${response.status} ${response.statusText}`)
  }

  const post = await response.json()
  assertBlogPost(post, 0)
  return post
}

const loadPostIndex = cache(async (): Promise<CoreBlogPost[]> => {
  if (hasMinioRuntimeConfig()) {
    logBlogSource('using MinIO blog index source')
    return fetchIndexFromMinio()
  }

  if (BLOG_INDEX_URL) {
    logBlogSource('using public blog index source')
    return fetchIndexFromPublicUrl()
  }

  const error = new Error(
    'Blog source is not configured. Set MinIO runtime env vars or BLOG_INDEX_URL.'
  )
  warnBlogSource('missing blog source configuration', error)
  throw error
})

const loadPostBySlug = cache(async (postSlug: string): Promise<BlogPost | undefined> => {
  try {
    if (hasMinioRuntimeConfig()) {
      logBlogSource('using MinIO post source')
      return await fetchPostFromMinio(postSlug)
    }

    if (BLOG_POSTS_BASE_URL) {
      logBlogSource('using public post source')
      return await fetchPostFromPublicUrl(postSlug)
    }

    const error = new Error(
      'Post source is not configured. Set MinIO runtime env vars or BLOG_POSTS_BASE_URL.'
    )
    warnBlogSource('missing post source configuration', error)
    throw error
  } catch (err) {
    warnBlogSource(`failed to load post "${postSlug}"`, err)
    return undefined
  }
})

export async function getAllPosts(): Promise<CoreBlogPost[]> {
  const posts = await loadPostIndex()
  return filterDrafts(sortPosts(posts))
}

export async function getAllCorePosts(): Promise<CoreBlogPost[]> {
  return getAllPosts()
}

export async function getPostBySlug(postSlug: string): Promise<BlogPost | undefined> {
  return loadPostBySlug(postSlug)
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
  return posts.filter((post) => (post.tags || []).some((postTag) => slug(postTag) === tag))
}

export async function getAdjacentPosts(postSlug: string): Promise<{
  prev?: CoreBlogPost
  next?: CoreBlogPost
}> {
  const posts = await getAllCorePosts()
  const index = posts.findIndex((post) => post.slug === postSlug)

  if (index === -1) {
    return {}
  }

  return {
    prev: posts[index + 1],
    next: posts[index - 1],
  }
}
