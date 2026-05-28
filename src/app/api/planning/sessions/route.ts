import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, dbError } from '@/lib/supabase/api-helpers'
import { z } from 'zod'

const createSessionSchema = z.object({
  customer_id: z.string().uuid(),
  contract_id: z.string().uuid().nullable().optional(),
}).strict()

function today() {
  return new Date().toISOString().split('T')[0]
}

export async function GET(request: NextRequest) {
  const { supabase, error: authError } = await requireAuth()
  if (authError) return authError

  const customerId = request.nextUrl.searchParams.get('customer_id')
  if (customerId && !z.string().uuid().safeParse(customerId).success) {
    return NextResponse.json({ error: 'Invalid customer_id' }, { status: 400 })
  }

  let query = supabase
    .from('planning_sessions')
    .select('*, customer_contracts(title, contracted_date)')
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

  const { customer_id, contract_id } = result.data

  const { data, error } = await supabase
    .from('planning_sessions')
    .insert({ customer_id, contract_id: contract_id ?? null, staff_id: user!.id })
    .select()
    .single()

  if (error) return dbError(error)

  const [customerRes, babyRes] = await Promise.all([
    supabase.from('customers').select('name_kanji, name_kana, address, phone, email').eq('id', customer_id).single(),
    supabase.from('babies').select('due_date, birth_date').eq('customer_id', customer_id).order('sort_order').limit(1),
  ])

  const customer = customerRes.data
  const baby = babyRes.data?.[0]
  const basicAnswers = {
    name: customer?.name_kanji ?? '',
    name_kana: customer?.name_kana ?? '',
    address: customer?.address ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    due_date: baby?.due_date ?? baby?.birth_date ?? '',
    record_date: today(),
  }

  await supabase
    .from('planning_answers')
    .upsert(
      { session_id: data.id, section_id: 'basic', answers: basicAnswers },
      { onConflict: 'session_id,section_id' }
    )

  return NextResponse.json(data, { status: 201 })
}
