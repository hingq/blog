import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { NextRequest, NextResponse } from 'next/server'

export const ADMIN_SESSION_COOKIE = 'blog_admin_session'
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 12

type SessionPayload = {
  expiresAt: number
}

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || ''
}

function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || ''
}

function encode(value: string) {
  return Buffer.from(value).toString('base64url')
}

function decode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function sign(payload: string) {
  return createHmac('sha256', getSessionSecret()).update(payload).digest('base64url')
}

function safeEqual(left: string, right: string) {
  const leftHash = createHash('sha256').update(left).digest()
  const rightHash = createHash('sha256').update(right).digest()
  return timingSafeEqual(leftHash, rightHash)
}

export function isAdminAuthConfigured() {
  return Boolean(getAdminPassword() && getSessionSecret())
}

export function verifyAdminPassword(candidate: string) {
  const configuredPassword = getAdminPassword()
  return Boolean(configuredPassword) && safeEqual(candidate, configuredPassword)
}

export function createAdminSessionToken(now = Date.now()) {
  if (!isAdminAuthConfigured()) {
    throw new Error('Admin authentication is not configured')
  }

  const payload = encode(
    JSON.stringify({ expiresAt: now + ADMIN_SESSION_MAX_AGE * 1000 } satisfies SessionPayload)
  )
  return `${payload}.${sign(payload)}`
}

export function verifyAdminSessionToken(token: string | undefined, now = Date.now()) {
  if (!token || !isAdminAuthConfigured()) return false

  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra || !safeEqual(signature, sign(payload))) return false

  try {
    const parsed = JSON.parse(decode(payload)) as SessionPayload
    return typeof parsed.expiresAt === 'number' && parsed.expiresAt > now
  } catch {
    return false
  }
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies()
  return verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)
}

export async function requireAdminPage() {
  if (!(await isAdminAuthenticated())) {
    redirect('/admin/login')
  }
}

export function isAdminApiRequest(request: NextRequest) {
  return verifyAdminSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value)
}

export function isSameOriginMutation(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (!origin) return false

  try {
    const requestUrl = new URL(request.url)
    const forwardedHost = request.headers.get('x-forwarded-host')
    const forwardedProto = request.headers.get('x-forwarded-proto')
    const expectedOrigin = forwardedHost
      ? `${forwardedProto || requestUrl.protocol.replace(':', '')}://${forwardedHost}`
      : requestUrl.origin
    return new URL(origin).origin === expectedOrigin
  } catch {
    return false
  }
}

export function setAdminSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    maxAge: ADMIN_SESSION_MAX_AGE,
    path: '/',
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  })
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set(ADMIN_SESSION_COOKIE, '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  })
}
