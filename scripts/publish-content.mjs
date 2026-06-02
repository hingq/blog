import { createHash } from 'node:crypto'
import { GetObjectCommand, PutObjectCommand, S3Client } from '../lib/s3-client.mjs'
import nextEnv from '@next/env'
import {
  compileLocalBlogPosts,
  compileSingleBlogPost,
  sortPosts,
  toCoreContent,
  toSearchDocument,
} from './blog-utils.mjs'

const args = process.argv.slice(2)
const argSet = new Set(args)
const { loadEnvConfig } = nextEnv

loadEnvConfig(process.cwd())

const isDryRun = argSet.has('--dry-run')

// Parse --single <file> argument
let singleFilePath = null
const singleIndex = args.indexOf('--single')
if (singleIndex >= 0) {
  singleFilePath = args[singleIndex + 1]
  if (!singleFilePath) {
    throw new Error('--single requires a file path argument')
  }
}

// ---------------------------------------------------------------------------
// 日志美化工具
// ---------------------------------------------------------------------------
const _color =
  !process.env.NO_COLOR &&
  process.env.FORCE_COLOR !== '0' &&
  (process.env.FORCE_COLOR === '1' || (process.stdout.isTTY ?? false))

function _w(code, text) {
  return _color ? `${code}${text}\x1b[0m` : text
}

const _c = {
  bold: (s) => _w('\x1b[1m', s),
  dim: (s) => _w('\x1b[2m', s),
  green: (s) => _w('\x1b[32m', s),
  yellow: (s) => _w('\x1b[33m', s),
  red: (s) => _w('\x1b[31m', s),
  cyan: (s) => _w('\x1b[36m', s),
  gray: (s) => _w('\x1b[90m', s),
}

const _i = {
  publish: '📤',
  success: '✅',
  skip: '⏭️ ',
  info: 'ℹ️ ',
  file: '📄',
  stat: '📊',
  error: '❌',
  new: '🆕',
  done: '🎉',
}

function logStep(message) {
  console.log(`\n${_i.publish} ${_c.bold(`[content-publish]`)} ${message}`)
}

function logInfo(message) {
  console.log(`  ${_i.info} ${message}`)
}

function logDetail(message) {
  console.log(`     ${_c.dim(message)}`)
}

function logSuccess(message) {
  console.log(`  ${_i.success} ${_c.green(message)}`)
}

function logSkip(message) {
  console.log(`  ${_i.skip}${_c.gray(message)}`)
}

function logUpload(message) {
  console.log(`  ${_i.publish} ${message}`)
}

function logStat(message) {
  console.log(`  ${_i.stat} ${message}`)
}


function requiredEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function optionalBoolean(name, defaultValue) {
  const value = process.env[name]
  if (value === undefined) {
    return defaultValue
  }
  return value !== 'false'
}

function sha256(str) {
  return createHash('sha256').update(str).digest('hex')
}

function createPublicUrl(baseUrl, objectKey) {
  if (!baseUrl) {
    return objectKey
  }

  return new URL(
    objectKey.replace(/^\//, ''),
    baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  ).toString()
}

function deriveManifestKey(blogIndexKey) {
  const lastSlash = blogIndexKey.lastIndexOf('/')
  const dir = lastSlash >= 0 ? blogIndexKey.slice(0, lastSlash + 1) : ''
  const file = lastSlash >= 0 ? blogIndexKey.slice(lastSlash + 1) : blogIndexKey
  const dotIndex = file.lastIndexOf('.')
  const base = dotIndex >= 0 ? file.slice(0, dotIndex) : file
  return `${dir}${base}-manifest.json`
}

async function loadCompiledPosts() {
  const payload = await compileLocalBlogPosts()
  const publishedPosts = sortPosts(payload).filter((post) => post.draft !== true)
  if (publishedPosts.length === 0) {
    throw new Error('No published blog posts found in compiled content')
  }

  return publishedPosts
}

function createS3Client() {
  return new S3Client({
    endpoint: requiredEnv('MINIO_ENDPOINT'),
    region: process.env.MINIO_REGION || 'us-east-1',
    forcePathStyle: optionalBoolean('MINIO_FORCE_PATH_STYLE', true),
    credentials: {
      accessKeyId: requiredEnv('MINIO_ACCESS_KEY_ID'),
      secretAccessKey: requiredEnv('MINIO_SECRET_ACCESS_KEY'),
    },
  })
}

async function uploadJson(client, bucket, key, payload) {
  const body = JSON.stringify(payload)

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'application/json; charset=utf-8',
      CacheControl: 'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
    })
  )
}

async function loadRemoteJson(client, bucket, key) {
  try {
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    if (!response.Body) return null
    const raw = await response.Body.transformToString()
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Single-file publish mode
// ---------------------------------------------------------------------------
async function mainSingle(filePath) {
  logStep(`Single-file mode: compiling ${filePath}`)
  const post = await compileSingleBlogPost(filePath)

  if (post.draft === true) {
    logSkip('Post is a draft, skipping publish')
    return
  }

  logInfo(`Post: ${post.title} (${post.slug})`)

  if (isDryRun) {
    logInfo(`${_c.yellow('Dry run mode')} — will not upload`)
  }

  const bucket = requiredEnv('MINIO_BUCKET')
  const blogIndexKey = requiredEnv('MINIO_BLOG_INDEX_KEY')
  const searchIndexKey = requiredEnv('MINIO_SEARCH_INDEX_KEY')
  const postsPrefix = process.env.MINIO_POSTS_PREFIX ?? 'posts/'
  const publicBaseUrl = process.env.MINIO_PUBLIC_BASE_URL
  const manifestKey = deriveManifestKey(blogIndexKey)

  const client = createS3Client()

  // 1. Upload the individual post (always overwrite)
  const postKey = `${postsPrefix}${post.slug}.json`
  logStep(`Uploading post: ${postKey}`)
  if (!isDryRun) {
    await uploadJson(client, bucket, postKey, post)
    logUpload(`uploaded: ${bucket}/${postKey}`)
  }

  // 2. Load existing manifest & indexes, then merge
  logStep('Loading existing manifest and indexes from remote')
  const manifest = await loadRemoteJson(client, bucket, manifestKey)
  const existingIndex = (await loadRemoteJson(client, bucket, blogIndexKey)) || []
  const existingSearch = (await loadRemoteJson(client, bucket, searchIndexKey)) || []

  if (manifest) {
    logInfo(`Manifest found ${_c.dim(`(published at ${manifest.publishedAt})`)}`)
  } else {
    logInfo('No manifest found — first publish')
  }

  // 3. Merge post into index: replace if slug exists, append otherwise
  const coreContent = toCoreContent(post)
  const searchDoc = toSearchDocument(post)

  const existingIndexIdx = existingIndex.findIndex((p) => p.slug === post.slug)
  if (existingIndexIdx >= 0) {
    existingIndex[existingIndexIdx] = coreContent
    logInfo('Updated existing entry in blog index')
  } else {
    existingIndex.push(coreContent)
    logInfo('Appended new entry to blog index')
  }

  // Sort by date descending
  existingIndex.sort((a, b) => {
    if (a.date > b.date) return -1
    if (a.date < b.date) return 1
    return 0
  })

  const existingSearchIdx = existingSearch.findIndex((p) => p.slug === post.slug)
  if (existingSearchIdx >= 0) {
    existingSearch[existingSearchIdx] = searchDoc
  } else {
    existingSearch.push(searchDoc)
  }

  existingSearch.sort((a, b) => {
    if (a.date > b.date) return -1
    if (a.date < b.date) return 1
    return 0
  })

  // 4. Upload merged indexes
  logStep('Uploading merged blog index')
  const indexJson = JSON.stringify(existingIndex)
  const indexHash = sha256(indexJson)
  if (!isDryRun) {
    await uploadJson(client, bucket, blogIndexKey, existingIndex)
    logUpload(`Blog index → ${createPublicUrl(publicBaseUrl, blogIndexKey)}`)
  }

  logStep('Uploading merged search index')
  const searchJson = JSON.stringify(existingSearch)
  const searchHash = sha256(searchJson)
  if (!isDryRun) {
    await uploadJson(client, bucket, searchIndexKey, existingSearch)
    logUpload(`Search index → ${createPublicUrl(publicBaseUrl, searchIndexKey)}`)
  }

  // 5. Save manifest
  if (!isDryRun) {
    logStep('Saving publish manifest')
    const postHash = sha256(JSON.stringify(post))
    const oldPostHashes = manifest?.posts ?? {}
    const newPostHashes = { ...oldPostHashes, [post.slug]: postHash }
    const newManifest = {
      version: 1,
      publishedAt: new Date().toISOString(),
      posts: newPostHashes,
      indexHash,
      searchHash,
    }
    await uploadJson(client, bucket, manifestKey, newManifest)
    logSuccess(`Manifest saved: ${bucket}/${manifestKey}`)
  } else {
    logInfo(`${_c.yellow('Dry run complete')}, no files uploaded`)
  }
}

// ---------------------------------------------------------------------------
// Full publish mode (original behavior)
// ---------------------------------------------------------------------------
async function mainFull() {
  logStep('Compiling blog content from data/blog')
  const publishedPosts = await loadCompiledPosts()
  const coreIndex = publishedPosts.map(toCoreContent)
  const searchIndex = publishedPosts.map(toSearchDocument)

  logInfo(`Published posts: ${publishedPosts.length}`)

  if (isDryRun) {
    logInfo(`${_c.yellow('Dry run mode')} — computing diff without uploading`)
  }

  const bucket = requiredEnv('MINIO_BUCKET')
  const blogIndexKey = requiredEnv('MINIO_BLOG_INDEX_KEY')
  const searchIndexKey = requiredEnv('MINIO_SEARCH_INDEX_KEY')
  const postsPrefix = process.env.MINIO_POSTS_PREFIX ?? 'posts/'
  const publicBaseUrl = process.env.MINIO_PUBLIC_BASE_URL
  const manifestKey = deriveManifestKey(blogIndexKey)

  const client = createS3Client()

  logStep('Loading publish manifest from MinIO')
  const manifest = await loadRemoteJson(client, bucket, manifestKey)
  if (manifest) {
    logInfo(`Manifest found ${_c.dim(`(published at ${manifest.publishedAt})`)}`)
  } else {
    logInfo('No manifest found — first publish, uploading everything')
  }

  const oldPostHashes = manifest?.posts ?? {}
  const newPostHashes = { ...oldPostHashes }

  // Upload individual post files (incremental)
  logStep('Checking individual posts')
  let uploadedCount = 0
  let skippedCount = 0

  for (const post of publishedPosts) {
    const postJson = JSON.stringify(post)
    const hash = sha256(postJson)
    newPostHashes[post.slug] = hash

    const postKey = `${postsPrefix}${post.slug}.json`

    if (oldPostHashes[post.slug] === hash) {
      logSkip(`skip  ${post.slug}`)
      skippedCount++
      continue
    }

    const label = oldPostHashes[post.slug] ? 'update' : `${_i.new} new `
    logInfo(`${label} ${post.slug}`)

    if (!isDryRun) {
      await uploadJson(client, bucket, postKey, post)
      logUpload(`uploaded: ${bucket}/${postKey}`)
    }
    uploadedCount++
  }

  logStat(`Posts: ${_c.green(`${uploadedCount} uploaded`)}, ${_c.gray(`${skippedCount} unchanged`)}`)

  // Upload lightweight index (no body)
  logStep('Checking blog index (lightweight)')
  const indexJson = JSON.stringify(coreIndex)
  const indexHash = sha256(indexJson)

  if (manifest?.indexHash === indexHash) {
    logSkip('Blog index unchanged')
  } else {
    logInfo('Blog index changed, uploading')
    if (!isDryRun) {
      await uploadJson(client, bucket, blogIndexKey, coreIndex)
      logUpload(`Blog index → ${createPublicUrl(publicBaseUrl, blogIndexKey)}`)
    }
  }

  // Upload search index
  logStep('Checking search index')
  const searchJson = JSON.stringify(searchIndex)
  const searchHash = sha256(searchJson)

  if (manifest?.searchHash === searchHash) {
    logSkip('Search index unchanged')
  } else {
    logInfo('Search index changed, uploading')
    if (!isDryRun) {
      await uploadJson(client, bucket, searchIndexKey, searchIndex)
      logUpload(`Search index → ${createPublicUrl(publicBaseUrl, searchIndexKey)}`)
    }
  }

  // Save manifest
  if (!isDryRun) {
    logStep('Saving publish manifest')
    const newManifest = {
      version: 1,
      publishedAt: new Date().toISOString(),
      posts: newPostHashes,
      indexHash,
      searchHash,
    }
    await uploadJson(client, bucket, manifestKey, newManifest)
    logSuccess(`Manifest saved: ${bucket}/${manifestKey}`)
  } else {
    logInfo(`${_c.yellow('Dry run complete')}, no files uploaded`)
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
async function main() {
  if (singleFilePath) {
    await mainSingle(singleFilePath)
  } else {
    await mainFull()
  }
}

main().catch((error) => {
  console.error(`\n${_i.error} ${_c.red('[content-publish] Failed:')} ${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
