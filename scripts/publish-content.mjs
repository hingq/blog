import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
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

function createPublicUrl(baseUrl, objectKey) {
  if (!baseUrl) {
    return objectKey
  }

  return new URL(
    objectKey.replace(/^\//, ''),
    baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  ).toString()
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

async function main() {
  logStep('Compiling blog content from data/blog')
  const publishedPosts = await loadCompiledPosts()
  const searchIndex = publishedPosts.map(toCoreContent)

  console.log(`[content-publish] Published posts: ${publishedPosts.length}`)
  console.log(`[content-publish] Search index entries: ${searchIndex.length}`)

  if (isDryRun) {
    console.log('[content-publish] Dry run complete, upload skipped')
    return
  }

  const bucket = requiredEnv('MINIO_BUCKET')
  const blogIndexKey = requiredEnv('MINIO_BLOG_INDEX_KEY')
  const searchIndexKey = requiredEnv('MINIO_SEARCH_INDEX_KEY')
  const publicBaseUrl = process.env.MINIO_PUBLIC_BASE_URL

  logStep('Uploading JSON payloads to MinIO')
  const client = createS3Client()

  await uploadJson(client, bucket, blogIndexKey, publishedPosts)
  await uploadJson(client, bucket, searchIndexKey, searchIndex)

  console.log(`[content-publish] Blog index uploaded: ${bucket}/${blogIndexKey}`)
  console.log(`[content-publish] Search index uploaded: ${bucket}/${searchIndexKey}`)
  console.log(`[content-publish] Blog index URL: ${createPublicUrl(publicBaseUrl, blogIndexKey)}`)
  console.log(
    `[content-publish] Search index URL: ${createPublicUrl(publicBaseUrl, searchIndexKey)}`
  )
}

main().catch((error) => {
  console.error('\n[content-publish] Failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
