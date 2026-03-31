import { NextResponse } from 'next/server'

const basePath = process.env.BASE_PATH || ''
const localSearchUrl = `${basePath}/search.json`
const remoteSearchUrl = process.env.SEARCH_INDEX_URL

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

export async function GET(request: Request) {
  const targetUrl = resolveSearchUrl(request.url)

  try {
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
