const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { pathToFileURL } = require('node:url')

test('prefers MinIO over public URL for search content when both are configured', async () => {
  const { getRuntimeContentSource } = await loadRuntimeContentSource()
  const source = getRuntimeContentSource({
    env: {
      MINIO_ENDPOINT: 'http://host.docker.internal:9000',
      MINIO_BUCKET: 'blog',
      MINIO_SEARCH_INDEX_KEY: 'search.json',
      MINIO_ACCESS_KEY_ID: 'minioadmin',
      MINIO_SECRET_ACCESS_KEY: 'minioadmin123',
      SEARCH_INDEX_URL: 'http://host.docker.internal:9000/blog/search.json',
    },
    remoteUrlEnvName: 'SEARCH_INDEX_URL',
    minioKeyEnvName: 'MINIO_SEARCH_INDEX_KEY',
  })

  assert.equal(source, 'minio')
})

test('falls back to public URL for search content when MinIO is absent', async () => {
  const { getRuntimeContentSource } = await loadRuntimeContentSource()
  const source = getRuntimeContentSource({
    env: {
      SEARCH_INDEX_URL: 'https://example.com/search.json',
    },
    remoteUrlEnvName: 'SEARCH_INDEX_URL',
    minioKeyEnvName: 'MINIO_SEARCH_INDEX_KEY',
  })

  assert.equal(source, 'remote')
})

test('supports blog index source selection with the same helper', async () => {
  const { getRuntimeContentSource } = await loadRuntimeContentSource()
  const source = getRuntimeContentSource({
    env: {
      MINIO_ENDPOINT: 'http://host.docker.internal:9000',
      MINIO_BUCKET: 'blog',
      MINIO_BLOG_INDEX_KEY: 'blog-index.json',
      MINIO_ACCESS_KEY_ID: 'minioadmin',
      MINIO_SECRET_ACCESS_KEY: 'minioadmin123',
      BLOG_INDEX_URL: 'http://host.docker.internal:9000/blog/blog-index.json',
    },
    remoteUrlEnvName: 'BLOG_INDEX_URL',
    minioKeyEnvName: 'MINIO_BLOG_INDEX_KEY',
  })

  assert.equal(source, 'minio')
})

test('search route uses shared runtime content helper', () => {
  const routeSource = readFileSync(
    path.join(__dirname, '..', 'app', 'api', 'search-documents', 'route.ts'),
    'utf8'
  )

  assert.match(routeSource, /getRuntimeContentSource/)
})

test('blog loader uses shared runtime content helper', () => {
  const blogSource = readFileSync(path.join(__dirname, '..', 'lib', 'blog.ts'), 'utf8')

  assert.match(blogSource, /getRuntimeContentSource/)
})

function loadRuntimeContentSource() {
  const moduleUrl = pathToFileURL(path.join(__dirname, '..', 'lib', 'runtime-content-source.mjs')).href
  return import(moduleUrl)
}
