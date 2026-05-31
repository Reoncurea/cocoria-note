import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase/api-helpers'

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['user', 'supporter']).default('user'),
  onboarding_status: z.enum(['pending', 'completed']).default('pending'),
  subscription_status: z.enum(['trialing', 'active']).default('trialing'),
}).strict()

function getAppOrigin(request: NextRequest) {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN
  if (configuredOrigin) return configuredOrigin.replace(/\/$/, '')
  return new URL(request.url).origin
}

function getInviteErrorMessage(message: string | undefined, fallback: string) {
  const lower = message?.toLowerCase() ?? ''

  if (lower.includes('already') || lower.includes('registered') || lower.includes('exists')) {
    return 'このメールアドレスはすでに登録済みです。表示中のユーザーが未設定なら「招待メールを再送」を使ってください。'
  }

  if (lower.includes('redirect') || lower.includes('not allowed') || lower.includes('uri')) {
    return '招待リンクの戻り先URLがSupabaseで許可されていません。Redirect URLsに https://note.cocoria.net/auth/callback を追加してください。'
  }

  if (lower.includes('rate') || lower.includes('too many')) {
    return 'Supabaseのメール送信制限にかかっている可能性があります。少し時間をおいて再度お試しください。'
  }

  return message ? `${fallback}（Supabase: ${message}）` : fallback
}

async function findAuthUserByEmail(
  adminSupabase: {
    auth: {
      admin: {
        listUsers: (params: { page: number; perPage: number }) => Promise<{
          data: { users: Array<{ id: string; email?: string | null }> }
          error: { message: string } | null
        }>
      }
    }
  },
  email: string,
) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await adminSupabase.auth.admin.listUsers({
      page,
      perPage: 100,
    })

    if (error) return { userId: null, error }

    const matchedUser = data.users.find((authUser) =>
      authUser.email?.toLowerCase() === email.toLowerCase()
    )

    if (matchedUser) return { userId: matchedUser.id, error: null }
    if (data.users.length < 100) break
  }

  return { userId: null, error: null }
}

async function requireAdmin() {
  const { user, supabase, error } = await requireAuth()
  if (error) return { user, supabase, error }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, onboarding_status, subscription_status')
    .eq('user_id', user!.id)
    .maybeSingle()

  const isAdmin =
    profile?.role === 'admin' &&
    profile.onboarding_status === 'completed' &&
    (profile.subscription_status === 'trialing' || profile.subscription_status === 'active')

  if (!isAdmin) {
    return { user, supabase, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { user, supabase, error: null }
}

export async function GET() {
  const { supabase, error } = await requireAdmin()
  if (error) return error

  const { data, error: fetchError } = await supabase
    .from('user_profiles')
    .select('user_id, email, display_name, role, onboarding_status, subscription_status, invited_at, accepted_at, trial_ends_at, current_period_end, grace_until, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (fetchError) {
    return NextResponse.json({ error: 'User list could not be loaded' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireAdmin()
  if (error) return error

  const result = inviteSchema.safeParse(await request.json())
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: '招待メール送信の環境設定が未完了です' }, { status: 500 })
  }

  const adminSupabase = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const { email, role, onboarding_status, subscription_status } = result.data
  const origin = getAppOrigin(request)

  const { data: existingProfile } = await adminSupabase
    .from('user_profiles')
    .select('user_id, onboarding_status')
    .eq('email', email)
    .maybeSingle()

  if (existingProfile?.onboarding_status === 'pending') {
    return NextResponse.json({
      error: 'このメールアドレスはすでに招待済みです。下のカードの「招待メールを再送」を使ってください。',
    }, { status: 409 })
  }

  if (existingProfile) {
    return NextResponse.json({
      error: 'このメールアドレスはすでに登録済みです。',
    }, { status: 409 })
  }

  const { userId: staleAuthUserId, error: listUsersError } = await findAuthUserByEmail(adminSupabase, email)

  if (listUsersError) {
    return NextResponse.json({
      error: '既存の招待状態を確認できませんでした。SupabaseのAuthenticationを確認してください。',
    }, { status: 500 })
  }

  if (staleAuthUserId) {
    const { error: deleteStaleAuthError } = await adminSupabase.auth.admin.deleteUser(staleAuthUserId)

    if (deleteStaleAuthError) {
      return NextResponse.json({
        error: '古い招待ユーザーがAuthenticationに残っています。SupabaseのAuthenticationで同じメールを削除してから再度招待してください。',
      }, { status: 500 })
    }
  }

  const { data: inviteData, error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/set-password`,
    data: {
      invited_by: user!.id,
      app: 'cocoria-note',
    },
  })

  if (inviteError || !inviteData.user) {
    return NextResponse.json({
      error: getInviteErrorMessage(inviteError?.message, '招待メールを送信できませんでした'),
    }, { status: 500 })
  }

  const { data: profile, error: profileError } = await adminSupabase
    .from('user_profiles')
    .upsert({
      user_id: inviteData.user.id,
      email,
      role,
      onboarding_status,
      subscription_status,
      invited_by: user!.id,
      invited_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select('user_id, email, display_name, role, onboarding_status, subscription_status, invited_at, accepted_at, trial_ends_at, current_period_end, grace_until, created_at, updated_at')
    .single()

  if (profileError) {
    return NextResponse.json({ error: '招待は送信されましたが、利用者設定の保存に失敗しました' }, { status: 500 })
  }

  return NextResponse.json(profile, { status: 201 })
}
