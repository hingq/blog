import { NextRequest, NextResponse } from 'next/server'
import { adminApiError, requireAdminApi } from '@/lib/admin/api'
import { restoreManagedPost } from '@/lib/admin/posts'
import { revalidatePublishedBlog } from '@/lib/admin/revalidate'

type RouteContext = { params: Promise<{ slug: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  const rejection = requireAdminApi(request, true)
  if (rejection) return rejection

  try {
    const { slug } = await context.params
    const post = await restoreManagedPost(slug)
    revalidatePublishedBlog()
    return NextResponse.json({ post })
  } catch (error) {
    return adminApiError(error)
  }
}
