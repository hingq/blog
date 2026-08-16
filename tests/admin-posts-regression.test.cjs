const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { pathToFileURL } = require('node:url')

const projectRoot = path.join(__dirname, '..')

function source(relativePath) {
  return readFileSync(path.join(projectRoot, relativePath), 'utf8')
}

test('admin post and preview APIs require an authenticated same-origin request', () => {
  const mutationRoutes = [
    'app/api/admin/posts/route.ts',
    'app/api/admin/posts/[slug]/route.ts',
    'app/api/admin/posts/[slug]/restore/route.ts',
    'app/api/admin/posts/[slug]/purge/route.ts',
    'app/api/admin/preview/route.ts',
  ]

  for (const route of mutationRoutes) {
    const routeSource = source(route)
    assert.match(routeSource, /requireAdminApi/)
    assert.match(routeSource, /requireAdminApi\(request, true\)/)
  }
})

test('drafts and deleted posts use private MinIO indexes and prefixes', () => {
  const postSource = source('lib/admin/posts.ts')

  assert.match(postSource, /MINIO_ADMIN_POSTS_INDEX_KEY/)
  assert.match(postSource, /MINIO_ADMIN_DRAFTS_PREFIX/)
  assert.match(postSource, /MINIO_ADMIN_TRASH_PREFIX/)
  assert.match(postSource, /private, no-store/)
  assert.match(postSource, /runMutation/)
  assert.match(postSource, /roll back MinIO mutation/)
})

test('public post loading rejects draft objects even when addressed by slug', () => {
  const blogSource = source('lib/blog.ts')
  assert.match(blogSource, /return post\?\.draft === true \? undefined : post/)
})

test('S3 client sends signed DELETE requests for object removal', async () => {
  const moduleUrl = pathToFileURL(path.join(projectRoot, 'lib', 's3-client.mjs')).href
  const { DeleteObjectCommand, S3Client } = await import(moduleUrl)
  const originalFetch = global.fetch
  let captured

  global.fetch = async (url, options) => {
    captured = { url: String(url), options }
    return new Response(null, { status: 204 })
  }

  try {
    const client = new S3Client({
      endpoint: 'http://minio.example:9000',
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId: 'access', secretAccessKey: 'secret' },
    })
    await client.send(new DeleteObjectCommand({ Bucket: 'blog', Key: 'posts/example.json' }))

    assert.equal(captured.options.method, 'DELETE')
    assert.equal(captured.url, 'http://minio.example:9000/blog/posts/example.json')
    assert.match(captured.options.headers.authorization, /^AWS4-HMAC-SHA256 /)
    assert.equal(captured.options.body, undefined)
  } finally {
    global.fetch = originalFetch
  }
})

test('content Image falls back when Markdown does not provide dimensions', () => {
  const imageSource = source('components/Image.tsx')
  assert.match(imageSource, /height !== undefined && width !== undefined/)
  assert.match(imageSource, /<img/)
  assert.match(imageSource, /startsWith\('\/'\)/)
})
