import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import { clearBlogCache } from '@/lib/blog'

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
    clearBlogCache()
    // 重新验证整个 App Router 的路由树缓存
    revalidatePath('/', 'layout')
    return NextResponse.json({ revalidated: true, now: Date.now() })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
