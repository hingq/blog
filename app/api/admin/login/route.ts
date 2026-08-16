import { NextRequest, NextResponse } from 'next/server'
import {
  createAdminSessionToken,
  isAdminAuthConfigured,
  isSameOriginMutation,
  setAdminSessionCookie,
  verifyAdminPassword,
} from '@/lib/admin/auth'

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }
  if (!isAdminAuthConfigured()) {
    return NextResponse.json(
      { error: 'Set ADMIN_PASSWORD and ADMIN_SESSION_SECRET before using the admin area' },
      { status: 503 }
    )
  }

  try {
    const body = (await request.json()) as { password?: unknown }
    if (typeof body.password !== 'string' || !verifyAdminPassword(body.password)) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    const response = NextResponse.json({ ok: true })
    setAdminSessionCookie(response, createAdminSessionToken())
    return response
  } catch {
    return NextResponse.json({ error: 'Invalid login request' }, { status: 400 })
  }
}
