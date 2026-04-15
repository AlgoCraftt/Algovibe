import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('vercel_access_token')?.value
  const tokenClientId = cookieStore.get('vercel_oauth_client_id')?.value
  const currentClientId = process.env.VERCEL_OAUTH_CLIENT_ID

  if (token && !tokenClientId) {
    cookieStore.set('vercel_access_token', '', { maxAge: 0, path: '/' })
    cookieStore.set('vercel_refresh_token', '', { maxAge: 0, path: '/' })
    return NextResponse.json({ connected: false, reason: 'oauth_session_refresh_required' })
  }

  if (token && tokenClientId && currentClientId && tokenClientId !== currentClientId) {
    cookieStore.set('vercel_access_token', '', { maxAge: 0, path: '/' })
    cookieStore.set('vercel_refresh_token', '', { maxAge: 0, path: '/' })
    cookieStore.set('vercel_oauth_client_id', '', { maxAge: 0, path: '/' })
    return NextResponse.json({ connected: false, reason: 'oauth_client_changed' })
  }

  return NextResponse.json({ connected: !!token })
}

