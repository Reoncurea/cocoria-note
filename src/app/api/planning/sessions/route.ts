import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: 顧客IDで絞り込んだセッション一覧
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const customerId = request.nextUrl.searchParams.get('customer_id')

  let query = supabase
    .from('planning_sessions')
    .select('*')
    .order('created_at', { ascending: false })

  if (customerId) {
    query = query.eq('customer_id', customerId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST: 新規セッション作成
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { customer_id: string }
  if (!body.customer_id) {
    return NextResponse.json({ error: 'customer_id is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('planning_sessions')
    .insert({ customer_id: body.customer_id, staff_id: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
