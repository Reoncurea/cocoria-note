import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase/api-helpers'

type Params = { params: Promise<{ userId: string }> }

const patchSchema = z.object({
  role: z.enum(['admin', 'user', 'supporter']).optional(),
  onboarding_status: z.enum(['pending', 'completed']).optional(),
  subscription_status: z.enum(['trialing', 'active', 'past_due', 'canceled']).optional(),
}).strict()

const deleteSchema = z.object({
  email: z.string().email().nullable().optional(),
  onboarding_status: z.enum(['pending', 'completed']).optional(),
}).strict()

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

export async function PATCH(request: NextRequest, { params }: Params) {
  const { userId } = await params
  const { user, supabase, error } = await requireAdmin()
  if (error) return error

  if (userId === user!.id) {
    return NextResponse.json({ error: '自分自身の管理権限はこの画面では変更できません' }, { status: 400 })
  }

  const result = patchSchema.safeParse(await request.json())
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const update = {
    ...result.data,
    updated_at: new Date().toISOString(),
  }

  const { data, error: updateError } = await supabase
    .from('user_profiles')
    .update(update)
    .eq('user_id', userId)
    .select('user_id, email, display_name, role, onboarding_status, subscription_status, invited_at, accepted_at, trial_ends_at, current_period_end, grace_until, created_at, updated_at')
    .single()

  if (updateError) {
    return NextResponse.json({ error: 'User profile could not be updated' }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { userId } = await params
  const { user, error } = await requireAdmin()
  if (error) return error

  if (userId === user!.id) {
    return NextResponse.json({ error: '自分自身は削除できません' }, { status: 400 })
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: '管理用の環境設定が未完了です' }, { status: 500 })
  }

  const adminSupabase = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const requestBody = await _request.json().catch(() => ({}))
  const parsedBody = deleteSchema.safeParse(requestBody)
  const requestedStatus = parsedBody.success ? parsedBody.data.onboarding_status : undefined

  const { data: profile, error: profileError } = await adminSupabase
    .from('user_profiles')
    .select('user_id, onboarding_status')
    .eq('user_id', userId)
    .maybeSingle()

  if (profileError) {
    return NextResponse.json({ error: '対象ユーザーを確認できませんでした' }, { status: 500 })
  }

  const onboardingStatus = profile?.onboarding_status ?? requestedStatus
  if (onboardingStatus !== 'pending') {
    return NextResponse.json({ error: '削除できるのは未設定の招待だけです' }, { status: 400 })
  }

  const { error: deleteAuthError } = await adminSupabase.auth.admin.deleteUser(userId)

  if (deleteAuthError) {
    return NextResponse.json({ error: '招待を削除できませんでした' }, { status: 500 })
  }

  await adminSupabase
    .from('user_profiles')
    .delete()
    .eq('user_id', userId)

  return NextResponse.json({ ok: true })
}
