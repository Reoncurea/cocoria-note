import { NextRequest, NextResponse } from 'next/server'
import type { SectionAnswers } from '@/lib/planning/types'
import { requireAuth, dbError } from '@/lib/supabase/api-helpers'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  section_id: z.string().min(1),
  answers: z.record(z.string(), z.unknown()),
}).strict()

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  const { supabase, error: authError } = await requireAuth()
  if (authError) return authError

  const result = patchSchema.safeParse(await request.json())
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }
  const body = result.data as { section_id: string; answers: SectionAnswers }

  const { data, error } = await supabase
    .from('planning_answers')
    .upsert(
      { session_id: id, section_id: body.section_id, answers: body.answers },
      { onConflict: 'session_id,section_id' }
    )
    .select()
    .single()

  if (error) return dbError(error)
  return NextResponse.json(data)
}
