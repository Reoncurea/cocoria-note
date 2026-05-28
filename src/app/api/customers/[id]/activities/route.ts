import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, dbError } from '@/lib/supabase/api-helpers'
import { z } from 'zod'

const postSchema = z.object({
  type: z.enum(['material', 'municipal', 'other']),
  activity_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1).max(200),
  body: z.string().max(2000).nullable().optional(),
  staff_name: z.string().max(100).nullable().optional(),
  municipality_name: z.string().max(100).nullable().optional(),
  contact_person: z.string().max(100).nullable().optional(),
}).strict()

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { supabase, error: authError } = await requireAuth()
  if (authError) return authError

  const { data, error } = await supabase
    .from('customer_activities')
    .select('*')
    .eq('customer_id', id)
    .order('activity_date', { ascending: false })
  if (error) return dbError(error)
  return NextResponse.json(data)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError

  const result = postSchema.safeParse(await req.json())
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('customer_activities')
    .insert({ ...result.data, customer_id: id, user_id: user!.id })
    .select()
    .single()
  if (error) return dbError(error)
  return NextResponse.json(data, { status: 201 })
}
