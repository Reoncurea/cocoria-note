import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { SectionAnswers } from '@/lib/planning/types'

const patchSchema = z.object({
  section_id: z.string().min(1).max(100),
  answers: z.record(z.string(), z.unknown()),
})

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = patchSchema.safeParse(await request.json())
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const { data, error } = await supabase
    .from('planning_answers')
    .upsert(
      { session_id: id, section_id: result.data.section_id, answers: result.data.answers as SectionAnswers },
      { onConflict: 'session_id,section_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
