import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

// GET: セッション詳細（回答・提案も含む）
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()

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

// PATCH: ステータス・current_section 更新
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()

  const body = await request.json() as {
    status?: 'in_progress' | 'completed' | 'archived'
    current_section?: string
    completed_at?: string
  }

  const { data, error } = await supabase
    .from('planning_sessions')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE: セッション削除
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()

  const { error } = await supabase.from('planning_sessions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
