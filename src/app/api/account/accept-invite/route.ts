import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/supabase/api-helpers'

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

  const now = new Date().toISOString()
  const { data, error: updateError } = await adminSupabase
    .from('user_profiles')
    .update({
      accepted_at: now,
      onboarding_status: 'completed',
      updated_at: now,
    })
    .eq('user_id', user!.id)
    .select('user_id, accepted_at, onboarding_status')
    .maybeSingle()

  if (updateError) {
    return NextResponse.json({ error: 'Account setup could not be recorded' }, { status: 500 })
  }

  return NextResponse.json({
    accepted_at: data?.accepted_at ?? now,
    onboarding_status: data?.onboarding_status ?? 'completed',
  })
}
