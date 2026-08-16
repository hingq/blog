import { NextRequest, NextResponse } from 'next/server'
import { adminApiError, requireAdminApi } from '@/lib/admin/api'
import { createManagedPost, listManagedPosts, type AdminPostInput } from '@/lib/admin/posts'
import { revalidatePublishedBlog } from '@/lib/admin/revalidate'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const rejection = requireAdminApi(request)
  if (rejection) return rejection

  try {
    return NextResponse.json(await listManagedPosts())
  } catch (error) {
    return adminApiError(error)
  }
}

export async function POST(request: NextRequest) {
  const rejection = requireAdminApi(request, true)
  if (rejection) return rejection

  try {
    const post = await createManagedPost((await request.json()) as AdminPostInput)
    revalidatePublishedBlog()
    return NextResponse.json({ post }, { status: 201 })
  } catch (error) {
    return adminApiError(error)
  }
}
