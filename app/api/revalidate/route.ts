import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import { clearBlogCache, clearBlogPostCache } from '@/lib/blog'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = process.env.REVALIDATE_TOKEN

  if (!token) {
    return NextResponse.json(
      { error: 'Revalidation is not configured (REVALIDATE_TOKEN is missing)' },
      { status: 500 }
    )
  }

  if (authHeader !== `Bearer ${token}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    let slug: string | undefined
    try {
      const body = await request.json()
      if (body && typeof body.slug === 'string' && body.slug.length > 0) {
        slug = body.slug
      }
    } catch {
      // 无 body 或非 JSON：走全量清除兜底
    }

    if (slug) {
      // 精确清除单篇文章的页面缓存与数据缓存，其余页面不受影响
      clearBlogPostCache(slug)
      revalidatePath(`/blog/${slug}`)
      return NextResponse.json({ revalidated: true, slug, now: Date.now() })
    }

    clearBlogCache()
    // 重新验证整个 App Router 的路由树缓存
    revalidatePath('/', 'layout')
    return NextResponse.json({ revalidated: true, now: Date.now() })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
