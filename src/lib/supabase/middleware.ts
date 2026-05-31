import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type UserProfile = {
  role: string
  onboarding_status: string
  subscription_status: string
}

function canEnterApp(profile: UserProfile | null) {
  if (!profile) return false
  if (profile.onboarding_status !== 'completed') return false
  return profile.subscription_status === 'trialing' || profile.subscription_status === 'active'
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://placeholder.supabase.co'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-key'

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  const publicPaths = ['/login', '/privacy', '/terms', '/auth/callback', '/account-status', '/set-password', '/reset-password']
  const isPublicPath = publicPaths.some((p) => pathname.startsWith(p))
  const isApiPath = pathname.startsWith('/api/')

  if (!user && !isPublicPath) {
    if (isApiPath) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    return NextResponse.redirect(redirectUrl)
  }

  if (user && !isPublicPath) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, onboarding_status, subscription_status')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!canEnterApp(profile)) {
      if (isApiPath) {
        return NextResponse.json({ error: 'Account is not active' }, { status: 403 })
      }
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/account-status'
      return NextResponse.redirect(redirectUrl)
    }
  }

  if (user && pathname === '/login') {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/dashboard'
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}
