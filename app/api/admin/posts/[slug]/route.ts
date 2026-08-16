import { NextRequest, NextResponse } from 'next/server'
import { adminApiError, requireAdminApi } from '@/lib/admin/api'
import {
  AdminPostError,
  getManagedPost,
  trashManagedPost,
  updateManagedPost,
  type AdminPostInput,
} from '@/lib/admin/posts'
import { revalidatePublishedBlog } from '@/lib/admin/revalidate'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ slug: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const rejection = requireAdminApi(request)
  if (rejection) return rejection

  try {
    const { slug } = await context.params
    const post = await getManagedPost(slug)
    if (!post) throw new AdminPostError('Article not found', 404)
    return NextResponse.json({ post })
  } catch (error) {
    return adminApiError(error)
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const rejection = requireAdminApi(request, true)
  if (rejection) return rejection

  try {
    const { slug } = await context.params
    const post = await updateManagedPost(slug, (await request.json()) as AdminPostInput)
    revalidatePublishedBlog()
    return NextResponse.json({ post })
  } catch (error) {
    return adminApiError(error)
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const rejection = requireAdminApi(request, true)
  if (rejection) return rejection

  try {
    const { slug } = await context.params
    await trashManagedPost(slug)
    revalidatePublishedBlog()
    return NextResponse.json({ ok: true })
  } catch (error) {
    return adminApiError(error)
  }
}
