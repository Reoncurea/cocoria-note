import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Ctx = { params: Promise<{ id: string; activityId: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { activityId } = await params
  const supabase = await createClient()
  const body = await req.json()
  const { data, error } = await supabase
    .from('customer_activities')
    .update(body)
    .eq('id', activityId)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { activityId } = await params
  const supabase = await createClient()
  const { error } = await supabase
    .from('customer_activities')
    .delete()
    .eq('id', activityId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
