import { NextRequest, NextResponse } from 'next/server'
import { adminApiError, requireAdminApi } from '@/lib/admin/api'
import { compileMdx } from '@/lib/compile-mdx.mjs'

const MAX_PREVIEW_LENGTH = 1_000_000

export async function POST(request: NextRequest) {
  const rejection = requireAdminApi(request, true)
  if (rejection) return rejection

  try {
    const body = (await request.json()) as { source?: unknown }
    if (typeof body.source !== 'string') {
      return NextResponse.json({ error: 'Preview source must be a string' }, { status: 400 })
    }
    if (body.source.length > MAX_PREVIEW_LENGTH) {
      return NextResponse.json({ error: 'Preview source is too large' }, { status: 413 })
    }
    return NextResponse.json({ code: await compileMdx(body.source) })
  } catch (error) {
    return adminApiError(error)
  }
}
