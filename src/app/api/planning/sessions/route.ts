import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, dbError } from '@/lib/supabase/api-helpers'
import { z } from 'zod'

const createSessionSchema = z.object({
  customer_id: z.string().uuid(),
}).strict()

export async function GET(request: NextRequest) {
  const { supabase, error: authError } = await requireAuth()
  if (authError) return authError

  const customerId = request.nextUrl.searchParams.get('customer_id')
  if (customerId && !z.string().uuid().safeParse(customerId).success) {
    return NextResponse.json({ error: 'Invalid customer_id' }, { status: 400 })
  }

  let query = supabase
    .from('planning_sessions')
    .select('*')
    .order('created_at', { ascending: false })

  if (customerId) {
    query = query.eq('customer_id', customerId)
  }

  const { data, error } = await query
  if (error) return dbError(error)
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError

  const result = createSessionSchema.safeParse(await request.json())
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('planning_sessions')
    .insert({ customer_id: result.data.customer_id, staff_id: user!.id })
    .select()
    .single()

  if (error) return dbError(error)
  return NextResponse.json(data, { status: 201 })
}
