import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, dbError } from '@/lib/supabase/api-helpers'
import { z } from 'zod'
import { PIPELINE_STAGES } from '@/lib/constants/pipeline'

const patchSchema = z.object({
  stage: z.enum(PIPELINE_STAGES),
  note: z.string().max(500).nullable().optional(),
}).strict()

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError

  const result = patchSchema.safeParse(await req.json())
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  // 変更前の段階を履歴に残したいので、先に読む。
  // RLSが効いているので、他人の顧客はここで見つからない。
  const { data: before, error: readError } = await supabase
    .from('customers')
    .select('pipeline_stage')
    .eq('id', id)
    .maybeSingle()
  if (readError) return dbError(readError)
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('customers')
    .update({
      pipeline_stage: result.data.stage,
      stage_note: result.data.note ?? null,
    })
    .eq('id', id)
    .select('id, pipeline_stage, stage_updated_at, stage_note')
    .single()
  if (error) return dbError(error)

  if (before.pipeline_stage !== result.data.stage) {
    // 履歴の記録に失敗しても、ステータス自体の更新は成立させる
    await supabase.from('customer_stage_events').insert({
      customer_id: id,
      user_id: user!.id,
      from_stage: before.pipeline_stage,
      to_stage: result.data.stage,
      note: result.data.note ?? null,
    })
  }

  return NextResponse.json(data)
}
