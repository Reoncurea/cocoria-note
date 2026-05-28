import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, dbError } from '@/lib/supabase/api-helpers'
import { z } from 'zod'

const patchSchema = z.object({
  type: z.enum(['material', 'municipal', 'other']).optional(),
  activity_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  title: z.string().min(1).max(200).optional(),
  body: z.string().max(2000).nullable().optional(),
  staff_name: z.string().max(100).nullable().optional(),
  municipality_name: z.string().max(100).nullable().optional(),
  contact_person: z.string().max(100).nullable().optional(),
}).strict()

type Ctx = { params: Promise<{ id: string; activityId: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { activityId } = await params
  const { supabase, error: authError } = await requireAuth()
  if (authError) return authError

  const result = patchSchema.safeParse(await req.json())
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('customer_activities')
    .update(result.data)
    .eq('id', activityId)
    .select()
    .single()
  if (error) return dbError(error)
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { activityId } = await params
  const { supabase, error: authError } = await requireAuth()
  if (authError) return authError

  const { error } = await supabase
    .from('customer_activities')
    .delete()
    .eq('id', activityId)
  if (error) return dbError(error)
  return new NextResponse(null, { status: 204 })
}
