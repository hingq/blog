import { createHash } from 'node:crypto'
import readingTime from 'reading-time'
import siteMetadata from '@/data/siteMetadata'
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@/lib/s3-client.mjs'
import { createMinioClient, hasMinioObjectConfig } from '@/lib/runtime-content-source.mjs'
import type { BlogPost, CoreBlogPost } from '@/lib/blog'

export type AdminPostInput = {
  title: string
  slug: string
  date: string
  summary?: string
  tags?: string[]
  draft: boolean
  body: string
}

export type ManagedBlogPost = BlogPost

export type TrashedPostEntry = CoreBlogPost & {
  deletedAt: string
}

type TrashedPostRecord = {
  deletedAt: string
  post: ManagedBlogPost
}

type PublishManifest = {
  version: number
  publishedAt: string
  posts: Record<string, string>
  indexHash: string
  searchHash: string
}

type ObjectSnapshot = {
  exists: boolean
  value?: unknown
}

type MutationPlan = {
  deletes?: string[]
  puts?: Array<{ key: string; value: unknown }>
}

export class AdminPostError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'AdminPostError'
    this.status = status
  }
}

const SLUG_PATTERN = /^[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*$/

function requiredEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new AdminPostError(`Missing required environment variable: ${name}`, 500)
  return value
}

function getConfig() {
  if (!hasMinioObjectConfig({ minioKeyEnvName: 'MINIO_BLOG_INDEX_KEY' })) {
    throw new AdminPostError('MinIO blog management is not configured', 500)
  }

  return {
    bucket: requiredEnv('MINIO_BUCKET'),
    blogIndexKey: requiredEnv('MINIO_BLOG_INDEX_KEY'),
    searchIndexKey: requiredEnv('MINIO_SEARCH_INDEX_KEY'),
    postsPrefix: process.env.MINIO_POSTS_PREFIX ?? 'posts/',
    adminPostsIndexKey: process.env.MINIO_ADMIN_POSTS_INDEX_KEY ?? 'admin/posts-index.json',
    draftsPrefix: process.env.MINIO_ADMIN_DRAFTS_PREFIX ?? 'admin/drafts/',
    trashPrefix: process.env.MINIO_ADMIN_TRASH_PREFIX ?? 'admin/trash/posts/',
    trashIndexKey: process.env.MINIO_ADMIN_TRASH_INDEX_KEY ?? 'admin/trash-index.json',
  }
}

function createClient() {
  return createMinioClient(process.env)
}

function postKey(slug: string) {
  return `${getConfig().postsPrefix}${slug}.json`
}

function trashKey(slug: string) {
  return `${getConfig().trashPrefix}${slug}.json`
}

function draftKey(slug: string) {
  return `${getConfig().draftsPrefix}${slug}.json`
}

function deriveManifestKey(blogIndexKey: string) {
  const lastSlash = blogIndexKey.lastIndexOf('/')
  const directory = lastSlash >= 0 ? blogIndexKey.slice(0, lastSlash + 1) : ''
  const file = lastSlash >= 0 ? blogIndexKey.slice(lastSlash + 1) : blogIndexKey
  const dot = file.lastIndexOf('.')
  return `${directory}${dot >= 0 ? file.slice(0, dot) : file}-manifest.json`
}

function hashJson(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

async function readOptionalJson<T>(key: string): Promise<T | null> {
  const { bucket } = getConfig()
  try {
    const response = await createClient().send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    if (!response.Body) return null
    return JSON.parse(await response.Body.transformToString()) as T
  } catch (error) {
    if (
      error instanceof Error &&
      ('code' in error ? error.code === 'NoSuchKey' : 'status' in error && error.status === 404)
    ) {
      return null
    }
    throw error
  }
}

async function putJson(key: string, value: unknown) {
  const config = getConfig()
  const isPublicObject =
    key === config.blogIndexKey ||
    key === config.searchIndexKey ||
    key.startsWith(config.postsPrefix)
  await createClient().send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: JSON.stringify(value),
      CacheControl: isPublicObject
        ? 'public, max-age=60, s-maxage=60, stale-while-revalidate=300'
        : 'private, no-store',
      ContentType: 'application/json; charset=utf-8',
    })
  )
}

async function deleteObject(key: string) {
  const { bucket } = getConfig()
  try {
    await createClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  } catch (error) {
    if (
      error instanceof Error &&
      ('code' in error ? error.code === 'NoSuchKey' : 'status' in error && error.status === 404)
    ) {
      return
    }
    throw error
  }
}

async function runMutation(plan: MutationPlan) {
  const puts = plan.puts ?? []
  const deletes = plan.deletes ?? []
  const keys = [...new Set([...puts.map(({ key }) => key), ...deletes])]
  const snapshots = new Map<string, ObjectSnapshot>()

  await Promise.all(
    keys.map(async (key) => {
      const value = await readOptionalJson(key)
      snapshots.set(key, value === null ? { exists: false } : { exists: true, value })
    })
  )

  try {
    for (const { key, value } of puts) await putJson(key, value)
    for (const key of deletes) await deleteObject(key)
  } catch (error) {
    const rollbackErrors: unknown[] = []
    for (const key of [...keys].reverse()) {
      const snapshot = snapshots.get(key)
      try {
        if (snapshot?.exists) await putJson(key, snapshot.value)
        else await deleteObject(key)
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError)
      }
    }

    if (rollbackErrors.length > 0) {
      console.error('[admin-posts] Failed to fully roll back MinIO mutation', rollbackErrors)
    }
    throw error
  }
}

function validateInput(input: AdminPostInput) {
  if (!input || typeof input !== 'object') throw new AdminPostError('Invalid article payload')
  if (typeof input.title !== 'string' || !input.title.trim()) {
    throw new AdminPostError('Title is required')
  }
  if (typeof input.slug !== 'string' || !SLUG_PATTERN.test(input.slug)) {
    throw new AdminPostError('Slug must contain only letters, numbers, hyphens, and underscores')
  }
  if (typeof input.body !== 'string') throw new AdminPostError('Article body is required')
  if (typeof input.draft !== 'boolean') throw new AdminPostError('Article status is required')
  if (!input.date || Number.isNaN(new Date(input.date).getTime())) {
    throw new AdminPostError('A valid publication date is required')
  }
  if (input.summary !== undefined && typeof input.summary !== 'string') {
    throw new AdminPostError('Summary must be a string')
  }
  if (!Array.isArray(input.tags) || input.tags.some((tag) => typeof tag !== 'string')) {
    throw new AdminPostError('Tags must be an array of strings')
  }
}

function toCoreContent(post: ManagedBlogPost): CoreBlogPost {
  const { body: _body, _raw: _rawValue, _id: _idValue, ...core } = post
  return core
}

function toSearchDocument(post: ManagedBlogPost): CoreBlogPost {
  return { ...toCoreContent(post), date: post.date.slice(0, 10) }
}

function sortByDate<T extends { date: string }>(items: T[]) {
  return [...items].sort((left, right) => right.date.localeCompare(left.date))
}

function buildPost(
  input: AdminPostInput,
  existing?: ManagedBlogPost,
  now = new Date().toISOString()
): ManagedBlogPost {
  const date = new Date(input.date).toISOString()
  const firstPublishedAt =
    existing?.firstPublishedAt ??
    (existing && existing.draft !== true ? existing.date : input.draft ? undefined : now)
  const summary = input.summary?.trim() || undefined
  const tags = [...new Set((input.tags ?? []).map((tag) => tag.trim()).filter(Boolean))]

  return {
    title: input.title.trim(),
    date,
    tags,
    lastmod: now,
    draft: input.draft,
    summary,
    authors: existing?.authors,
    layout: existing?.layout,
    canonicalUrl: existing?.canonicalUrl,
    images: existing?.images,
    bibliography: existing?.bibliography,
    firstPublishedAt,
    readingTime: { ...readingTime(input.body) },
    slug: input.slug,
    path: `blog/${input.slug}`,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: input.title.trim(),
      datePublished: date,
      dateModified: now,
      description: summary,
      image: siteMetadata.socialBanner,
      url: `${String(siteMetadata.siteUrl).replace(/\/$/, '')}/blog/${input.slug}`,
    },
    body: { raw: input.body },
  }
}

async function loadIndexes() {
  const config = getConfig()
  const manifestKey = deriveManifestKey(config.blogIndexKey)
  const [published, managed, search, trash, manifest] = await Promise.all([
    readOptionalJson<CoreBlogPost[]>(config.blogIndexKey),
    readOptionalJson<CoreBlogPost[]>(config.adminPostsIndexKey),
    readOptionalJson<CoreBlogPost[]>(config.searchIndexKey),
    readOptionalJson<TrashedPostEntry[]>(config.trashIndexKey),
    readOptionalJson<PublishManifest>(manifestKey),
  ])
  return {
    published: Array.isArray(published) ? published : [],
    managed: Array.isArray(managed) ? managed : [],
    search: Array.isArray(search) ? search : [],
    trash: Array.isArray(trash) ? trash : [],
    manifest,
    manifestKey,
  }
}

function createManifest(
  posts: CoreBlogPost[],
  search: CoreBlogPost[],
  postHashes: Record<string, string>
): PublishManifest {
  return {
    version: 1,
    publishedAt: new Date().toISOString(),
    posts: postHashes,
    indexHash: hashJson(posts),
    searchHash: hashJson(search),
  }
}

function addOrReplace<T extends { slug: string }>(items: T[], value: T) {
  return [...items.filter((item) => item.slug !== value.slug), value]
}

export async function listManagedPosts() {
  const { published, managed, trash } = await loadIndexes()
  const posts = published.reduce(
    (items, post) => addOrReplace(items, post),
    managed as CoreBlogPost[]
  )
  return {
    posts: sortByDate(posts),
    trash: [...trash].sort((left, right) => right.deletedAt.localeCompare(left.deletedAt)),
  }
}

export async function getManagedPost(slug: string) {
  if (!SLUG_PATTERN.test(slug)) throw new AdminPostError('Invalid slug')
  return (
    (await readOptionalJson<ManagedBlogPost>(postKey(slug))) ??
    readOptionalJson<ManagedBlogPost>(draftKey(slug))
  )
}

export async function createManagedPost(input: AdminPostInput) {
  validateInput(input)
  if (await getManagedPost(input.slug)) throw new AdminPostError('Slug already exists', 409)
  if (await readOptionalJson<TrashedPostRecord>(trashKey(input.slug))) {
    throw new AdminPostError(
      'Slug exists in the recycle bin; restore or permanently delete it',
      409
    )
  }

  const post = buildPost(input)
  const indexes = await loadIndexes()
  const core = toCoreContent(post)
  const published = input.draft
    ? indexes.published.filter((item) => item.slug !== post.slug)
    : sortByDate(addOrReplace(indexes.published, core))
  const managed = sortByDate(addOrReplace(indexes.managed, core))
  const search = input.draft
    ? indexes.search.filter((item) => item.slug !== post.slug)
    : sortByDate(addOrReplace(indexes.search, toSearchDocument(post)))
  const hashes = { ...(indexes.manifest?.posts ?? {}), [post.slug]: hashJson(post) }
  const manifest = createManifest(published, search, hashes)
  const config = getConfig()

  await runMutation({
    puts: [
      { key: input.draft ? draftKey(post.slug) : postKey(post.slug), value: post },
      { key: config.blogIndexKey, value: published },
      { key: config.adminPostsIndexKey, value: managed },
      { key: config.searchIndexKey, value: search },
      { key: indexes.manifestKey, value: manifest },
    ],
  })
  return post
}

export async function updateManagedPost(currentSlug: string, input: AdminPostInput) {
  validateInput(input)
  const existing = await getManagedPost(currentSlug)
  if (!existing) throw new AdminPostError('Article not found', 404)

  const slugChanged = currentSlug !== input.slug
  const slugLocked = Boolean(existing.firstPublishedAt || existing.draft !== true)
  if (slugChanged && slugLocked) {
    throw new AdminPostError('Slug cannot be changed after the article has been published', 409)
  }
  if (slugChanged && (await getManagedPost(input.slug))) {
    throw new AdminPostError('Slug already exists', 409)
  }

  const post = buildPost(input, existing)
  const nextObjectKey = input.draft ? draftKey(post.slug) : postKey(post.slug)
  const previousObjectKeys = [postKey(currentSlug), draftKey(currentSlug)].filter(
    (key) => key !== nextObjectKey
  )
  const indexes = await loadIndexes()
  const core = toCoreContent(post)
  const withoutPreviousPublished = indexes.published.filter(
    (item) => item.slug !== currentSlug && item.slug !== post.slug
  )
  const published = input.draft
    ? withoutPreviousPublished
    : sortByDate([...withoutPreviousPublished, core])
  const managed = sortByDate([
    ...indexes.managed.filter((item) => item.slug !== currentSlug && item.slug !== post.slug),
    core,
  ])
  const withoutPreviousSearch = indexes.search.filter(
    (item) => item.slug !== currentSlug && item.slug !== post.slug
  )
  const search = input.draft
    ? withoutPreviousSearch
    : sortByDate([...withoutPreviousSearch, toSearchDocument(post)])
  const hashes = { ...(indexes.manifest?.posts ?? {}) }
  delete hashes[currentSlug]
  hashes[post.slug] = hashJson(post)
  const manifest = createManifest(published, search, hashes)
  const config = getConfig()

  await runMutation({
    puts: [
      { key: nextObjectKey, value: post },
      { key: config.blogIndexKey, value: published },
      { key: config.adminPostsIndexKey, value: managed },
      { key: config.searchIndexKey, value: search },
      { key: indexes.manifestKey, value: manifest },
    ],
    deletes: previousObjectKeys,
  })
  return post
}

export async function trashManagedPost(slug: string) {
  const post = await getManagedPost(slug)
  if (!post) throw new AdminPostError('Article not found', 404)

  const deletedAt = new Date().toISOString()
  const indexes = await loadIndexes()
  const published = indexes.published.filter((item) => item.slug !== slug)
  const managed = indexes.managed.filter((item) => item.slug !== slug)
  const search = indexes.search.filter((item) => item.slug !== slug)
  const trashEntry = { ...toCoreContent(post), deletedAt }
  const trash = [
    ...indexes.trash.filter((item) => item.slug !== slug),
    trashEntry,
  ] as TrashedPostEntry[]
  const hashes = { ...(indexes.manifest?.posts ?? {}) }
  delete hashes[slug]
  const manifest = createManifest(published, search, hashes)
  const config = getConfig()

  await runMutation({
    puts: [
      { key: trashKey(slug), value: { deletedAt, post } satisfies TrashedPostRecord },
      { key: config.blogIndexKey, value: published },
      { key: config.adminPostsIndexKey, value: managed },
      { key: config.searchIndexKey, value: search },
      { key: config.trashIndexKey, value: trash },
      { key: indexes.manifestKey, value: manifest },
    ],
    deletes: [postKey(slug), draftKey(slug)],
  })
}

export async function restoreManagedPost(slug: string) {
  if (!SLUG_PATTERN.test(slug)) throw new AdminPostError('Invalid slug')
  if (await getManagedPost(slug)) throw new AdminPostError('An article with this slug exists', 409)
  const record = await readOptionalJson<TrashedPostRecord>(trashKey(slug))
  if (!record?.post) throw new AdminPostError('Trashed article not found', 404)

  const indexes = await loadIndexes()
  const post = { ...record.post, lastmod: new Date().toISOString() }
  const core = toCoreContent(post)
  const published = post.draft
    ? indexes.published.filter((item) => item.slug !== slug)
    : sortByDate(addOrReplace(indexes.published, core))
  const managed = sortByDate(addOrReplace(indexes.managed, core))
  const search = post.draft
    ? indexes.search.filter((item) => item.slug !== slug)
    : sortByDate(addOrReplace(indexes.search, toSearchDocument(post)))
  const trash = indexes.trash.filter((item) => item.slug !== slug)
  const hashes = { ...(indexes.manifest?.posts ?? {}), [slug]: hashJson(post) }
  const manifest = createManifest(published, search, hashes)
  const config = getConfig()

  await runMutation({
    puts: [
      { key: post.draft ? draftKey(slug) : postKey(slug), value: post },
      { key: config.blogIndexKey, value: published },
      { key: config.adminPostsIndexKey, value: managed },
      { key: config.searchIndexKey, value: search },
      { key: config.trashIndexKey, value: trash },
      { key: indexes.manifestKey, value: manifest },
    ],
    deletes: [trashKey(slug)],
  })
  return post
}

export async function permanentlyDeleteManagedPost(slug: string) {
  if (!SLUG_PATTERN.test(slug)) throw new AdminPostError('Invalid slug')
  const record = await readOptionalJson<TrashedPostRecord>(trashKey(slug))
  if (!record) throw new AdminPostError('Trashed article not found', 404)
  const indexes = await loadIndexes()
  const config = getConfig()
  await runMutation({
    puts: [
      {
        key: config.trashIndexKey,
        value: indexes.trash.filter((item) => item.slug !== slug),
      },
    ],
    deletes: [trashKey(slug)],
  })
}
