import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SectionAnswers } from '@/lib/planning/types'

type Params = { params: Promise<{ id: string }> }

// PATCH: セクション回答を upsert（セクション単位の自動保存）
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()

  const body = await request.json() as { section_id: string; answers: SectionAnswers }
  if (!body.section_id) {
    return NextResponse.json({ error: 'section_id is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('planning_answers')
    .upsert(
      { session_id: id, section_id: body.section_id, answers: body.answers },
      { onConflict: 'session_id,section_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
