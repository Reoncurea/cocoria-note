import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, dbError } from '@/lib/supabase/api-helpers'
import { z } from 'zod'
import { CHECKLIST_PHASES, normalizeChecklist } from '@/lib/constants/visit-checklist'

/** 定義に無い項目IDは受け付けない */
const KNOWN_ITEM_IDS = new Set(
  CHECKLIST_PHASES.flatMap(phase => phase.items.map(item => item.id)),
)

const patchSchema = z.object({
  entries: z.record(
    z.string(),
    z.object({
      checked: z.boolean().optional(),
      note: z.string().max(2000).nullable().optional(),
      time: z.string().max(10).nullable().optional(),
    }).strict(),
  ),
}).strict()

/**
 * 現在のチェックリストを返す。
 * 画面はサーバー側で描画しているが、一度開いたページはブラウザ側で再利用されるため、
 * 別の画面から戻ってきたときに古い内容が出ることがある。
 * それを避けるため、開いた時点で最新を取り直す用。
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ visitId: string }> }
) {
  const { visitId } = await params
  const { supabase, error: authError } = await requireAuth()
  if (authError) return authError

  const { data, error } = await supabase
    .from('visits')
    .select('checklist')
    .eq('id', visitId)
    .maybeSingle()
  if (error) return dbError(error)
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ checklist: normalizeChecklist(data.checklist) })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ visitId: string }> }
) {
  const { visitId } = await params
  const { supabase, error: authError } = await requireAuth()
  if (authError) return authError

  const result = patchSchema.safeParse(await req.json())
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const unknownIds = Object.keys(result.data.entries).filter(id => !KNOWN_ITEM_IDS.has(id))
  if (unknownIds.length > 0) {
    return NextResponse.json({ error: 'Unknown checklist item' }, { status: 400 })
  }

  // 送られてきた項目だけ差し替える。同時に別の端末で触っていても、
  // 触っていない項目まで巻き戻さないようにするため、現在値に重ねる。
  const { data: current, error: readError } = await supabase
    .from('visits')
    .select('checklist')
    .eq('id', visitId)
    .maybeSingle()
  if (readError) return dbError(readError)
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const merged = normalizeChecklist(current.checklist)
  for (const [id, entry] of Object.entries(result.data.entries)) {
    merged[id] = {
      ...merged[id],
      ...(entry.checked !== undefined ? { checked: entry.checked } : {}),
      ...(entry.note !== undefined ? { note: entry.note ?? undefined } : {}),
      ...(entry.time !== undefined ? { time: entry.time ?? undefined } : {}),
    }
  }

  const { data, error } = await supabase
    .from('visits')
    .update({ checklist: merged })
    .eq('id', visitId)
    .select('id, checklist')
    .single()
  if (error) return dbError(error)

  return NextResponse.json(data)
}
