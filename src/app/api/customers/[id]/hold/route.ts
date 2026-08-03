import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, dbError } from '@/lib/supabase/api-helpers'
import { z } from 'zod'
import { HOLD_STATES } from '@/lib/constants/pipeline'

// 顧客を「いま追わない」状態にする／戻す。
// 進行ステータスは触らないので、解除すれば元の段階から再開できる。

const patchSchema = z.object({
  hold_state: z.enum(HOLD_STATES),
  hold_reason: z.string().max(200).nullable().optional(),
  // 再開予定日。空なら手動で解除するまで止めたまま
  hold_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
}).strict()

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { supabase, error: authError } = await requireAuth()
  if (authError) return authError

  const result = patchSchema.safeParse(await req.json())
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const { hold_state, hold_reason, hold_until } = result.data

  const patch: Record<string, unknown> = {
    hold_state,
    hold_reason: hold_state === 'active' ? null : (hold_reason ?? null),
    hold_until: hold_state === 'active' ? null : (hold_until ?? null),
  }

  // 通常へ戻すときは、滞留日数の数え直しをここから始める。
  // そうしないと、止めていた期間の分だけ即座に「放置」と判定されてしまう。
  if (hold_state === 'active') {
    patch.stage_updated_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('customers')
    .update(patch)
    .eq('id', id)
    .select('id, hold_state, hold_reason, hold_until, stage_updated_at')
    .maybeSingle()
  if (error) return dbError(error)
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(data)
}
