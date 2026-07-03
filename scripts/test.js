const { loadEnvConfig } = require('@next/env')

loadEnvConfig(process.cwd())

const shouldApply = process.argv.includes('--apply')

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function optionalBoolean(name, defaultValue) {
  const value = process.env[name]
  return value === undefined ? defaultValue : value !== 'false'
}

async function loadJson(client, GetObjectCommand, bucket, key) {
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  if (!response.Body) {
    throw new Error(`Remote object is empty: ${key}`)
  }

  const body = await response.Body.transformToString()
  try {
    return JSON.parse(body)
  } catch {
    throw new Error(`Remote object is not valid JSON: ${key}`)
  }
}

async function uploadJson(client, PutObjectCommand, bucket, key, value) {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(value),
      ContentType: 'application/json; charset=utf-8',
      CacheControl: 'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
    })
  )
}

async function listAllPostKeys(client, ListObjectsV2Command, bucket, prefix) {
  const keys = []
  let continuationToken

  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    )

    keys.push(
      ...(page.Contents ?? [])
        .map((object) => object.Key)
        .filter((key) => key && key !== prefix && key.toLowerCase().endsWith('.json'))
    )
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined

    if (page.IsTruncated && !continuationToken) {
      throw new Error('MinIO response is truncated but has no continuation token')
    }
  } while (continuationToken)

  return [...new Set(keys)]
}

function assertIndex(index, indexKey) {
  if (!Array.isArray(index)) {
    throw new Error(`Remote blog index must be an array: ${indexKey}`)
  }

  index.forEach((post, position) => {
    if (!post || typeof post !== 'object' || typeof post.slug !== 'string') {
      throw new Error(`Invalid blog index entry at position ${position}`)
    }
  })
}

function assertPost(post, objectKey) {
  if (
    !post ||
    typeof post !== 'object' ||
    typeof post.slug !== 'string' ||
    typeof post.title !== 'string' ||
    typeof post.date !== 'string' ||
    typeof post.path !== 'string'
  ) {
    throw new Error(`Remote post is missing title, date, slug, or path: ${objectKey}`)
  }
}

async function main() {
  const [
    { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client },
    { sortPosts, toCoreContent },
  ] = await Promise.all([import('../lib/s3-client.mjs'), import('./blog-utils.mjs')])

  const bucket = requiredEnv('MINIO_BUCKET')
  const indexKey = requiredEnv('MINIO_BLOG_INDEX_KEY')
  const postsPrefix = process.env.MINIO_POSTS_PREFIX ?? 'posts/'
  const client = new S3Client({
    endpoint: requiredEnv('MINIO_ENDPOINT'),
    region: process.env.MINIO_REGION || 'us-east-1',
    forcePathStyle: optionalBoolean('MINIO_FORCE_PATH_STYLE', true),
    credentials: {
      accessKeyId: requiredEnv('MINIO_ACCESS_KEY_ID'),
      secretAccessKey: requiredEnv('MINIO_SECRET_ACCESS_KEY'),
    },
  })

  const index = await loadJson(client, GetObjectCommand, bucket, indexKey)
  assertIndex(index, indexKey)

  const postKeys = await listAllPostKeys(client, ListObjectsV2Command, bucket, postsPrefix)
  const indexedSlugs = new Set(index.map((post) => post.slug))
  const missingBySlug = new Map()

  for (const objectKey of postKeys) {
    const post = await loadJson(client, GetObjectCommand, bucket, objectKey)
    assertPost(post, objectKey)
    const coreContent = toCoreContent(post)

    if (indexedSlugs.has(coreContent.slug)) {
      continue
    }
    if (missingBySlug.has(coreContent.slug)) {
      throw new Error(
        `Duplicate remote post slug "${coreContent.slug}": ${missingBySlug.get(coreContent.slug).objectKey} and ${objectKey}`
      )
    }

    missingBySlug.set(coreContent.slug, { objectKey, coreContent })
  }

  console.log(`Actual post files: ${postKeys.length}`)
  console.log(`Existing index entries: ${index.length}`)
  console.log(`Missing index entries: ${missingBySlug.size}`)

  for (const { objectKey, coreContent } of missingBySlug.values()) {
    console.log(`- ${coreContent.slug} (${objectKey})`)
  }

  if (missingBySlug.size === 0) {
    console.log('Blog index is complete; nothing to update.')
    return
  }

  if (!shouldApply) {
    console.log('\nDry run only. Run `node scripts/test.js --apply` to update the remote index.')
    return
  }

  const updatedIndex = sortPosts([
    ...index,
    ...[...missingBySlug.values()].map(({ coreContent }) => coreContent),
  ])
  await uploadJson(client, PutObjectCommand, bucket, indexKey, updatedIndex)
  console.log(`\nUpdated ${indexKey}: added ${missingBySlug.size}, total ${updatedIndex.length}.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
