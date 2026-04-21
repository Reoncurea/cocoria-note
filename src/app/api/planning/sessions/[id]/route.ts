import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const patchSchema = z.object({
  status: z.enum(['in_progress', 'completed', 'archived']).optional(),
  current_section: z.string().max(100).nullable().optional(),
  completed_at: z.string().datetime().nullable().optional(),
}).strict()

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [sessionRes, answersRes, suggestionsRes] = await Promise.all([
    supabase.from('planning_sessions').select('*').eq('id', id).single(),
    supabase.from('planning_answers').select('*').eq('session_id', id),
    supabase.from('planning_suggestions').select('*').eq('session_id', id).order('display_order'),
  ])

  if (sessionRes.error) {
    return NextResponse.json({ error: sessionRes.error.message }, { status: 404 })
  }

  return NextResponse.json({
    session: sessionRes.data,
    answers: answersRes.data ?? [],
    suggestions: suggestionsRes.data ?? [],
  })
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = patchSchema.safeParse(await request.json())
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const { data, error } = await supabase
    .from('planning_sessions')
    .update(result.data)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('planning_sessions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
