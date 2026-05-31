import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase/api-helpers'

type Params = { params: Promise<{ userId: string }> }

const resendSchema = z.object({
  email: z.string().email().nullable().optional(),
  role: z.enum(['user', 'supporter']).optional(),
  onboarding_status: z.enum(['pending', 'completed']).optional(),
  subscription_status: z.enum(['trialing', 'active', 'past_due', 'canceled']).optional(),
}).strict()

function getAppOrigin(request: NextRequest) {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN
  if (configuredOrigin) return configuredOrigin.replace(/\/$/, '')
  return new URL(request.url).origin
}

function getInviteErrorMessage(message: string | undefined, fallback: string) {
  const lower = message?.toLowerCase() ?? ''

  if (lower.includes('already') || lower.includes('registered') || lower.includes('exists')) {
    return 'このメールアドレスはすでに登録済みです。SupabaseのAuthenticationで同じメールの古いユーザーが残っていないか確認してください。'
  }

  if (lower.includes('redirect') || lower.includes('not allowed') || lower.includes('uri')) {
    return '招待リンクの戻り先URLがSupabaseで許可されていません。Redirect URLsに https://note.cocoria.net/auth/callback を追加してください。'
  }

  if (lower.includes('rate') || lower.includes('too many')) {
    return 'Supabaseのメール送信制限にかかっている可能性があります。少し時間をおいて再度お試しください。'
  }

  return message ? `${fallback}（Supabase: ${message}）` : fallback
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

export async function POST(request: NextRequest, { params }: Params) {
  const { userId } = await params
  const { user, error } = await requireAdmin()
  if (error) return error

  if (userId === user!.id) {
    return NextResponse.json({ error: '自分自身には再送できません' }, { status: 400 })
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

  const requestBody = await request.json().catch(() => ({}))
  const parsedBody = resendSchema.safeParse(requestBody)
  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.flatten() }, { status: 400 })
  }

  const { data: existingProfile, error: profileError } = await adminSupabase
    .from('user_profiles')
    .select('email, role, onboarding_status, subscription_status')
    .eq('user_id', userId)
    .maybeSingle()

  if (profileError) {
    return NextResponse.json({ error: '対象ユーザーを確認できませんでした' }, { status: 500 })
  }

  const email = existingProfile?.email ?? parsedBody.data.email
  const role = existingProfile?.role ?? parsedBody.data.role ?? 'user'
  const onboardingStatus = existingProfile?.onboarding_status ?? parsedBody.data.onboarding_status
  const subscriptionStatus = existingProfile?.subscription_status ?? parsedBody.data.subscription_status ?? 'trialing'

  if (!email) {
    return NextResponse.json({ error: '対象メールアドレスが見つかりません' }, { status: 404 })
  }

  if (onboardingStatus !== 'pending') {
    return NextResponse.json({ error: '再送できるのは未設定のユーザーだけです' }, { status: 400 })
  }

  const { error: deleteAuthError } = await adminSupabase.auth.admin.deleteUser(userId)

  if (deleteAuthError && !deleteAuthError.message.toLowerCase().includes('not found')) {
    return NextResponse.json({ error: '古い招待を取り消せませんでした' }, { status: 500 })
  }

  await adminSupabase
    .from('user_profiles')
    .delete()
    .eq('user_id', userId)

  const origin = getAppOrigin(request)
  const { data: inviteData, error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(
    email,
    {
      redirectTo: `${origin}/auth/callback?next=/set-password`,
      data: {
        invited_by: user!.id,
        app: 'cocoria-note',
      },
    },
  )

  if (inviteError || !inviteData.user) {
    return NextResponse.json({
      error: getInviteErrorMessage(inviteError?.message, '招待メールを再送できませんでした'),
    }, { status: 500 })
  }

  const now = new Date().toISOString()
  const { data: profile, error: upsertError } = await adminSupabase
    .from('user_profiles')
    .upsert({
      user_id: inviteData.user.id,
      email,
      role,
      onboarding_status: onboardingStatus,
      subscription_status: subscriptionStatus,
      invited_by: user!.id,
      invited_at: now,
      updated_at: now,
    }, { onConflict: 'user_id' })
    .select('user_id, email, display_name, role, onboarding_status, subscription_status, invited_at, accepted_at, trial_ends_at, current_period_end, grace_until, created_at, updated_at')
    .single()

  if (upsertError) {
    return NextResponse.json({ error: '招待は再送されましたが、利用者設定の保存に失敗しました' }, { status: 500 })
  }

  return NextResponse.json(profile)
}
