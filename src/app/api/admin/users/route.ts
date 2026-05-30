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
  const origin = new URL(request.url).origin

  const { data: inviteData, error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/account-status`,
    data: {
      invited_by: user!.id,
      app: 'cocoria-note',
    },
  })

  if (inviteError || !inviteData.user) {
    return NextResponse.json({ error: '招待メールを送信できませんでした' }, { status: 500 })
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
