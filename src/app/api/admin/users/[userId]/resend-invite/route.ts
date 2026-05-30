import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/supabase/api-helpers'

type Params = { params: Promise<{ userId: string }> }

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

  const { data: existingProfile, error: profileError } = await adminSupabase
    .from('user_profiles')
    .select('email, role, onboarding_status, subscription_status')
    .eq('user_id', userId)
    .maybeSingle()

  if (profileError || !existingProfile?.email) {
    return NextResponse.json({ error: '対象ユーザーが見つかりません' }, { status: 404 })
  }

  if (existingProfile.onboarding_status !== 'pending') {
    return NextResponse.json({ error: '再送できるのは初回確認前のユーザーだけです' }, { status: 400 })
  }

  const { error: deleteAuthError } = await adminSupabase.auth.admin.deleteUser(userId)

  if (deleteAuthError) {
    return NextResponse.json({ error: '古い招待を取り消せませんでした' }, { status: 500 })
  }

  await adminSupabase
    .from('user_profiles')
    .delete()
    .eq('user_id', userId)

  const origin = new URL(request.url).origin
  const { data: inviteData, error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(
    existingProfile.email,
    {
      redirectTo: `${origin}/auth/callback?next=/set-password`,
      data: {
        invited_by: user!.id,
        app: 'cocoria-note',
      },
    },
  )

  if (inviteError || !inviteData.user) {
    return NextResponse.json({ error: '招待メールを再送できませんでした' }, { status: 500 })
  }

  const now = new Date().toISOString()
  const { data: profile, error: upsertError } = await adminSupabase
    .from('user_profiles')
    .upsert({
      user_id: inviteData.user.id,
      email: existingProfile.email,
      role: existingProfile.role,
      onboarding_status: existingProfile.onboarding_status,
      subscription_status: existingProfile.subscription_status,
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
