import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/api-helpers'

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
