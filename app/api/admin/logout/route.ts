import { NextRequest, NextResponse } from 'next/server'
import { clearAdminSessionCookie, isSameOriginMutation } from '@/lib/admin/auth'

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }
  const response = NextResponse.json({ ok: true })
  clearAdminSessionCookie(response)
  return response
}
