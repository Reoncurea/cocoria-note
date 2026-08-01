import { createClient } from '@/lib/supabase/server'
import { signedUrlMap } from '@/lib/uploads/signed-urls'
import { normalizeChecklist } from '@/lib/constants/visit-checklist'
import { buildChecklistContext } from '@/lib/visits/checklist-context'
import type { BreathCheck, BreathCheckCell, ServiceRecord, Visit, VisitPhoto } from '@/types/database'
import VisitDetailClient, { type VisitPhotoWithUrl } from './VisitDetailClient'

export const dynamic = 'force-dynamic'

export default async function VisitDetailPage({
  params,
}: {
  params: Promise<{ id: string; visitId: string }>
}) {
  const { id, visitId } = await params
  const supabase = await createClient()

  const [visitRes, recordsRes, breathRes, tagsRes, photosRes, customerRes, sessionRes, billingRes, contractRes] =
    await Promise.all([
      supabase.from('visits').select('*').eq('id', visitId).maybeSingle(),
      supabase.from('service_records').select('*').eq('visit_id', visitId).order('sort_order'),
      supabase.from('breath_checks').select('*').eq('visit_id', visitId).maybeSingle(),
      supabase.from('visit_tags').select('tag_id, support_tags(name)').eq('visit_id', visitId),
      supabase.from('visit_photos').select('*').eq('visit_id', visitId).order('sort_order'),
      supabase
        .from('customers')
        .select('address, nearest_station, route_note, transport_fee, transport, pipeline_stage, is_recurring, recurring_note')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('planning_sessions')
        .select('id, planning_answers(section_id, answers)')
        .eq('customer_id', id)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase.from('billing').select('contracted, invoiced, paid, amount').eq('customer_id', id).maybeSingle(),
      supabase
        .from('customer_contracts')
        .select('title, contracted_date')
        .eq('customer_id', id)
        .order('contracted_date', { ascending: false })
        .limit(1),
    ])

  const visit = visitRes.data as Visit | null
  if (!visit) {
    return (
      <div className="text-center py-20" style={{ color: 'var(--color-text-muted)' }}>
        記録が見つかりません
      </div>
    )
  }

  // 呼吸チェックのマス目は、表があるときだけ取りに行く
  const breathCheck = breathRes.data as BreathCheck | null
  let breathCells: BreathCheckCell[] = []
  if (breathCheck) {
    const { data } = await supabase
      .from('breath_check_cells')
      .select('*')
      .eq('breath_check_id', breathCheck.id)
    breathCells = (data ?? []) as BreathCheckCell[]
  }

  // 今回より前の訪問。前回の申し送りを訪問前チェックに出すために使う
  const { data: previousRows } = await supabase
    .from('visits')
    .select('id, visit_date, start_time, end_time, next_visit_notes, staff_message, customer_notes')
    .eq('customer_id', id)
    .lt('visit_date', visit.visit_date)
    .order('visit_date', { ascending: false })
    .limit(1)
  const lastVisit = previousRows?.[0] ?? null

  let lastVisitRecords: ServiceRecord[] = []
  if (lastVisit) {
    const { data } = await supabase
      .from('service_records')
      .select('*')
      .eq('visit_id', lastVisit.id)
      .order('sort_order')
    lastVisitRecords = (data ?? []) as ServiceRecord[]
  }

  const photoRows = (photosRes.data ?? []) as VisitPhoto[]
  const urls = await signedUrlMap(supabase, 'visit-photos', photoRows.map(p => p.file_path))
  const photos: VisitPhotoWithUrl[] = photoRows.map(photo => ({
    ...photo,
    signedUrl: urls[photo.file_path],
  }))

  const planningAnswers: Record<string, Record<string, unknown>> = {}
  for (const row of sessionRes.data?.[0]?.planning_answers ?? []) {
    planningAnswers[row.section_id] = row.answers as Record<string, unknown>
  }

  const customer = customerRes.data ?? {
    address: null, nearest_station: null, route_note: null, transport_fee: null,
    transport: null, pipeline_stage: null, is_recurring: false, recurring_note: null,
  }

  const checklistContext = buildChecklistContext({
    visit,
    customer,
    planningAnswers,
    billing: billingRes.data ?? null,
    latestContract: contractRes.data?.[0] ?? null,
    lastVisit,
  })

  const tags = (tagsRes.data ?? []).flatMap(row => {
    const supportTags = (row as { support_tags: { name: string } | { name: string }[] | null }).support_tags
    if (Array.isArray(supportTags)) return supportTags.map(t => t.name)
    return supportTags?.name ? [supportTags.name] : []
  })

  return (
    <VisitDetailClient
      customerId={id}
      visit={visit}
      checklistState={normalizeChecklist(visit.checklist)}
      checklistContext={checklistContext}
      serviceRecords={(recordsRes.data ?? []) as ServiceRecord[]}
      breathCheck={breathCheck}
      initialBreathCells={breathCells}
      tags={tags}
      photos={photos}
      customerAddress={customer.address}
      lastVisit={lastVisit ? { ...lastVisit, records: lastVisitRecords } : null}
    />
  )
}
