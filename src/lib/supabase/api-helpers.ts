import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, supabase, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  return { user, supabase, error: null }
}

export function dbError(_error: { message: string }, status = 500) {
  return NextResponse.json({ error: 'Database request failed' }, { status })
}
