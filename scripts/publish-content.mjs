import { createHash } from 'node:crypto'
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import nextEnv from '@next/env'
import { compileLocalBlogPosts, sortPosts, toCoreContent } from './blog-utils.mjs'

const args = new Set(process.argv.slice(2))
const { loadEnvConfig } = nextEnv

loadEnvConfig(process.cwd())

const isDryRun = args.has('--dry-run')

function logStep(message) {
  console.log(`\n[content-publish] ${message}`)
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

async function loadManifest(client, bucket, manifestKey) {
  try {
    const response = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: manifestKey })
    )
    if (!response.Body) return null
    const raw = await response.Body.transformToString()
    return JSON.parse(raw)
  } catch {
    return null
  }
}

async function main() {
  logStep('Compiling blog content from data/blog')
  const publishedPosts = await loadCompiledPosts()
  const coreIndex = publishedPosts.map(toCoreContent)
  const searchIndex = coreIndex

  console.log(`[content-publish] Published posts: ${publishedPosts.length}`)

  if (isDryRun) {
    console.log('[content-publish] Dry run mode — computing diff without uploading')
  }

  const bucket = requiredEnv('MINIO_BUCKET')
  const blogIndexKey = requiredEnv('MINIO_BLOG_INDEX_KEY')
  const searchIndexKey = requiredEnv('MINIO_SEARCH_INDEX_KEY')
  const postsPrefix = process.env.MINIO_POSTS_PREFIX ?? 'posts/'
  const publicBaseUrl = process.env.MINIO_PUBLIC_BASE_URL
  const manifestKey = deriveManifestKey(blogIndexKey)

  const client = createS3Client()

  logStep('Loading publish manifest from MinIO')
  const manifest = await loadManifest(client, bucket, manifestKey)
  if (manifest) {
    console.log(`[content-publish] Manifest found (published at ${manifest.publishedAt})`)
  } else {
    console.log('[content-publish] No manifest found — first publish, uploading everything')
  }

  const oldPostHashes = manifest?.posts ?? {}
  const newPostHashes = {}

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
      console.log(`[content-publish]   skip  ${post.slug}`)
      skippedCount++
      continue
    }

    const label = oldPostHashes[post.slug] ? 'update' : 'new  '
    console.log(`[content-publish]   ${label} ${post.slug}`)

    if (!isDryRun) {
      await uploadJson(client, bucket, postKey, post)
      console.log(`[content-publish]         uploaded: ${bucket}/${postKey}`)
    }
    uploadedCount++
  }

  console.log(
    `[content-publish] Posts: ${uploadedCount} uploaded, ${skippedCount} unchanged`
  )

  // Upload lightweight index (no body)
  logStep('Checking blog index (lightweight)')
  const indexJson = JSON.stringify(coreIndex)
  const indexHash = sha256(indexJson)

  if (manifest?.indexHash === indexHash) {
    console.log('[content-publish] Blog index unchanged, skipping')
  } else {
    console.log('[content-publish] Blog index changed, uploading')
    if (!isDryRun) {
      await uploadJson(client, bucket, blogIndexKey, coreIndex)
      console.log(
        `[content-publish] Blog index URL: ${createPublicUrl(publicBaseUrl, blogIndexKey)}`
      )
    }
  }

  // Upload search index
  logStep('Checking search index')
  const searchJson = JSON.stringify(searchIndex)
  const searchHash = sha256(searchJson)

  if (manifest?.searchHash === searchHash) {
    console.log('[content-publish] Search index unchanged, skipping')
  } else {
    console.log('[content-publish] Search index changed, uploading')
    if (!isDryRun) {
      await uploadJson(client, bucket, searchIndexKey, searchIndex)
      console.log(
        `[content-publish] Search index URL: ${createPublicUrl(publicBaseUrl, searchIndexKey)}`
      )
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
    console.log(`[content-publish] Manifest saved: ${bucket}/${manifestKey}`)
  } else {
    console.log('\n[content-publish] Dry run complete, no files uploaded')
  }
}

main().catch((error) => {
  console.error('\n[content-publish] Failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
