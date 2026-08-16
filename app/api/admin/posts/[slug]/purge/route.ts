import { NextRequest, NextResponse } from 'next/server'
import { adminApiError, requireAdminApi } from '@/lib/admin/api'
import { permanentlyDeleteManagedPost } from '@/lib/admin/posts'

type RouteContext = { params: Promise<{ slug: string }> }

export async function DELETE(request: NextRequest, context: RouteContext) {
  const rejection = requireAdminApi(request, true)
  if (rejection) return rejection

  try {
    const { slug } = await context.params
    await permanentlyDeleteManagedPost(slug)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return adminApiError(error)
  }
}
