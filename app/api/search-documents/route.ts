import { GetObjectCommand } from '@aws-sdk/client-s3'
import { NextResponse } from 'next/server'
import {
  createMinioClient,
  getRuntimeContentSource,
  hasMinioObjectConfig,
} from '@/lib/runtime-content-source.mjs'

const basePath = process.env.BASE_PATH || ''
const localSearchUrl = `${basePath}/search.json`
const remoteSearchUrl = process.env.SEARCH_INDEX_URL
const minioBucket = process.env.MINIO_BUCKET
const minioSearchIndexKey = process.env.MINIO_SEARCH_INDEX_KEY

const resolveSearchUrl = (requestUrl: string) => {
  if (!remoteSearchUrl) {
    return new URL(localSearchUrl, requestUrl)
  }

  try {
    return new URL(remoteSearchUrl)
  } catch (error) {
    console.error('[search] Invalid SEARCH_INDEX_URL, fallback to local search index.', error)
    return new URL(localSearchUrl, requestUrl)
  }
}

const hasMinioSearchConfig = () =>
  hasMinioObjectConfig({ minioKeyEnvName: 'MINIO_SEARCH_INDEX_KEY' })

const createSearchMinioClient = () => {
  if (!hasMinioSearchConfig()) {
    throw new Error('MinIO search runtime config is incomplete')
  }

  return createMinioClient(process.env)
}

const loadSearchIndexFromMinio = async () => {
  const client = createSearchMinioClient()
  const response = await client.send(
    new GetObjectCommand({
      Bucket: minioBucket,
      Key: minioSearchIndexKey,
    })
  )

  if (!response.Body) {
    throw new Error('MinIO returned an empty search index body')
  }

  const raw = await response.Body.transformToString()
  const payload = JSON.parse(raw)

  if (!Array.isArray(payload)) {
    throw new Error('Invalid search index payload: expected a top-level array')
  }

  return payload
}

export async function GET(request: Request) {
  const searchSource = getRuntimeContentSource({
    remoteUrlEnvName: 'SEARCH_INDEX_URL',
    minioKeyEnvName: 'MINIO_SEARCH_INDEX_KEY',
  })
  const targetUrl = resolveSearchUrl(request.url)

  try {
    if (searchSource === 'minio') {
      const documents = await loadSearchIndexFromMinio()

      return NextResponse.json(documents, {
        status: 200,
        headers: { 'x-search-status': 'ok' },
      })
    }

    const response = await fetch(targetUrl, {
      next: { revalidate: 60 },
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      console.error('[search] Failed to load search index.', {
        status: response.status,
        statusText: response.statusText,
        url: targetUrl.toString(),
      })

      return NextResponse.json([], {
        status: 200,
        headers: { 'x-search-status': 'degraded' },
      })
    }

    const payload = await response.json()
    const documents = Array.isArray(payload) ? payload : []

    if (!Array.isArray(payload)) {
      console.error('[search] Search index payload is not an array, fallback to empty array.', {
        url: targetUrl.toString(),
      })
    }

    return NextResponse.json(documents, {
      status: 200,
      headers: { 'x-search-status': 'ok' },
    })
  } catch (error) {
    console.error('[search] Search index request failed, fallback to empty array.', error)

    return NextResponse.json([], {
      status: 200,
      headers: { 'x-search-status': 'degraded' },
    })
  }
}
