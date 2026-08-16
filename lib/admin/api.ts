import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { isAdminApiRequest, isSameOriginMutation } from './auth'
import { AdminPostError } from './posts'

export function requireAdminApi(request: NextRequest, mutation = false) {
  if (!isAdminApiRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (mutation && !isSameOriginMutation(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }
  return null
}

export function adminApiError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unexpected admin API error'
  const status = error instanceof AdminPostError ? error.status : 500
  if (status >= 500) console.error('[admin-api]', error)
  return NextResponse.json({ error: message }, { status })
}
