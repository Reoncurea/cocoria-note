import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  GATE_COOKIE_NAME,
  buildGateCache,
  readGateCache,
  sessionFingerprint,
} from './gate-cache'

type UserProfile = {
  role: string
  onboarding_status: string
  subscription_status: string
  accepted_at: string | null
  trial_ends_at: string | null
}

function addOneMonth(date: Date) {
  const result = new Date(date)
  result.setMonth(result.getMonth() + 1)
  return result
}

function getTrialEndsAt(profile: UserProfile) {
  if (profile.trial_ends_at) return profile.trial_ends_at
  if (profile.accepted_at) return addOneMonth(new Date(profile.accepted_at)).toISOString()
  return null
}

function isTrialExpired(profile: UserProfile) {
  if (profile.subscription_status !== 'trialing') return false
  const trialEndsAt = getTrialEndsAt(profile)
  if (!trialEndsAt) return false
  return new Date(trialEndsAt).getTime() < Date.now()
}

function canEnterApp(profile: UserProfile | null) {
  if (!profile) return false
  if (profile.onboarding_status !== 'completed') return false
  if (isTrialExpired(profile)) return false
  return profile.subscription_status === 'trialing' || profile.subscription_status === 'active'
}

const PUBLIC_PATHS = [
  '/login',
  '/privacy',
  '/terms',
  '/auth/callback',
  '/account-status',
  '/set-password',
  '/reset-password',
  // 定期実行から呼ばれる。ログインセッションが無いので、ここでは通す。
  // 認可は各ルート側で CRON_SECRET を検証して行う。
  '/api/cron',
]

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  const isApiPath = pathname.startsWith('/api/')

  const redirectTo = (target: string) => {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = target
    return NextResponse.redirect(redirectUrl)
  }

  // ログイン中の画面遷移では、直前の判定結果を数十秒だけ使い回す。
  // これが無いと、ページを開くたびにSupabaseへの往復が2回入る。
  const fingerprint = await sessionFingerprint(request.cookies.getAll())
  const cached = await readGateCache(request.cookies.get(GATE_COOKIE_NAME)?.value, fingerprint)

  if (cached) {
    if (!cached.allowed && !isPublicPath) {
      return isApiPath
        ? NextResponse.json({ error: 'Account is not active' }, { status: 403 })
        : redirectTo('/account-status')
    }
    if (cached.allowed && pathname === '/login') {
      return redirectTo('/dashboard')
    }
    return NextResponse.next({ request })
  }

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

  if (!user && !isPublicPath) {
    if (isApiPath) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return redirectTo('/login')
  }

  if (user && !isPublicPath) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, onboarding_status, subscription_status, accepted_at, trial_ends_at')
      .eq('user_id', user.id)
      .maybeSingle()

    const allowed = canEnterApp(profile)
    await cacheGateResult(supabaseResponse, request, { userId: user.id, allowed })

    if (!allowed) {
      if (isApiPath) {
        return NextResponse.json({ error: 'Account is not active' }, { status: 403 })
      }
      return redirectTo('/account-status')
    }
  }

  if (user && pathname === '/login') {
    return redirectTo('/dashboard')
  }

  return supabaseResponse
}

async function cacheGateResult(
  response: NextResponse,
  request: NextRequest,
  value: { userId: string; allowed: boolean },
) {
  // トークン更新でCookieが差し替わった場合は、更新後の値で指紋を取り直す。
  // レスポンス側に出ている値が最新なので、そちらを優先する。
  const merged = new Map<string, string>()
  for (const cookie of request.cookies.getAll()) merged.set(cookie.name, cookie.value)
  for (const cookie of response.cookies.getAll()) merged.set(cookie.name, cookie.value)

  const fingerprint = await sessionFingerprint(
    Array.from(merged, ([name, value]) => ({ name, value })),
  )

  const cookie = await buildGateCache(fingerprint, value)
  if (!cookie) return

  response.cookies.set(cookie.name, cookie.value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: cookie.maxAge,
  })
}
