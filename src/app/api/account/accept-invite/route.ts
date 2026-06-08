import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/supabase/api-helpers'

function addOneMonth(date: Date) {
  const result = new Date(date)
  result.setMonth(result.getMonth() + 1)
  return result
}

export async function POST() {
  const { user, error } = await requireAuth()
  if (error) return error

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: 'Account setup is not configured' }, { status: 500 })
  }

  const adminSupabase = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const { data: currentProfile, error: fetchError } = await adminSupabase
    .from('user_profiles')
    .select('accepted_at, invited_by, onboarding_status, trial_ends_at')
    .eq('user_id', user!.id)
    .maybeSingle()

  if (fetchError) {
    return NextResponse.json({ error: 'Account setup could not be loaded' }, { status: 500 })
  }

  if (!currentProfile || currentProfile.invited_by === null) {
    return NextResponse.json({ error: 'This account has not been invited' }, { status: 403 })
  }

  if (currentProfile.onboarding_status !== 'pending' && currentProfile.accepted_at) {
    return NextResponse.json({ error: 'Account setup has already been completed' }, { status: 409 })
  }

  const now = new Date()
  const acceptedAt = currentProfile?.accepted_at ?? now.toISOString()
  const trialEndsAt = currentProfile?.trial_ends_at ?? addOneMonth(new Date(acceptedAt)).toISOString()

  const { data, error: updateError } = await adminSupabase
    .from('user_profiles')
    .update({
      accepted_at: acceptedAt,
      onboarding_status: 'completed',
      trial_ends_at: trialEndsAt,
      updated_at: now.toISOString(),
    })
    .eq('user_id', user!.id)
    .select('user_id, accepted_at, onboarding_status, trial_ends_at')
    .maybeSingle()

  if (updateError) {
    return NextResponse.json({ error: 'Account setup could not be recorded' }, { status: 500 })
  }

  return NextResponse.json({
    accepted_at: data?.accepted_at ?? acceptedAt,
    onboarding_status: data?.onboarding_status ?? 'completed',
    trial_ends_at: data?.trial_ends_at ?? trialEndsAt,
  })
}
