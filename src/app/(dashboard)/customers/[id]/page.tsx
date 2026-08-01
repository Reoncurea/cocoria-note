import { createClient } from '@/lib/supabase/server'
import { CUSTOMER_PHOTO_LIMIT, getCustomerPhotoUsage, getPhotoUploadEnabled } from '@/lib/uploads/photo-usage'
import { signedUrlMap } from '@/lib/uploads/signed-urls'
import type { Baby, Customer, CustomerContract, PlanningPhoto } from '@/types/database'
import CustomerDetailClient, {
  type LastVisitSummary,
  type PlanningAnswerMap,
  type PlanningPhotoWithUrl,
} from './CustomerDetailClient'

export const dynamic = 'force-dynamic'

type SessionWithChildren = {
  id: string
  created_at: string
  status: string
  planning_answers: { section_id: string; answers: PlanningAnswerMap[string] }[] | null
  planning_photos: PlanningPhoto[] | null
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // 画面に必要なものを一度に取りに行く。
  // 以前は「顧客→セッション一覧→セッション詳細→写真→署名URL」と直列に並んでいた。
  const [
    customerRes,
    babiesRes,
    sessionRes,
    contractsRes,
    billingRes,
    lastVisitRes,
    nextVisitRes,
    photoEnabled,
    photoUsed,
  ] = await Promise.all([
    supabase.from('customers').select('*').eq('id', id).maybeSingle(),
    supabase.from('babies').select('*').eq('customer_id', id).order('sort_order'),
    supabase
      .from('planning_sessions')
      .select('id, created_at, status, planning_answers(section_id, answers), planning_photos(*)')
      .eq('customer_id', id)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('customer_contracts')
      .select('*')
      .eq('customer_id', id)
      .order('contracted_date', { ascending: false }),
    supabase.from('billing').select('contracted, invoiced, paid, amount').eq('customer_id', id).maybeSingle(),
    supabase
      .from('visits')
      .select('id, visit_date, start_time, end_time, staff_message, next_visit_notes, customer_notes, report_sent')
      .eq('customer_id', id)
      .lte('visit_date', new Date().toISOString().split('T')[0])
      .order('visit_date', { ascending: false })
      .limit(1),
    supabase
      .from('visits')
      .select('id, visit_date, start_time, end_time')
      .eq('customer_id', id)
      .gt('visit_date', new Date().toISOString().split('T')[0])
      .order('visit_date', { ascending: true })
      .limit(1),
    user ? getPhotoUploadEnabled(supabase, user.id) : Promise.resolve({ enabled: false, error: null }),
    getCustomerPhotoUsage(supabase, id),
  ])

  const customer = customerRes.data as Customer | null
  if (!customer) {
    return (
      <div className="text-center py-20" style={{ color: 'var(--color-text-muted)' }}>
        顧客が見つかりません
      </div>
    )
  }

  const session = (sessionRes.data?.[0] ?? null) as SessionWithChildren | null

  const planningAnswers: PlanningAnswerMap = {}
  for (const row of session?.planning_answers ?? []) {
    planningAnswers[row.section_id] = row.answers
  }

  const photoRows = [...(session?.planning_photos ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  const urls = await signedUrlMap(supabase, 'planning-photos', photoRows.map(p => p.file_path))
  const planningPhotos: PlanningPhotoWithUrl[] = photoRows.map(photo => ({
    ...photo,
    signedUrl: urls[photo.file_path],
  }))

  const lastVisit = (lastVisitRes.data?.[0] ?? null) as LastVisitSummary | null
  let lastVisitRecords: { time_label: string; content: string | null }[] = []
  if (lastVisit) {
    const { data } = await supabase
      .from('service_records')
      .select('time_label, content')
      .eq('visit_id', lastVisit.id)
      .order('sort_order')
    lastVisitRecords = data ?? []
  }

  const photoCount = photoUsed.count
  const enabled = photoEnabled.enabled

  return (
    <CustomerDetailClient
      customer={customer}
      babies={(babiesRes.data ?? []) as Baby[]}
      sessionId={session?.id ?? null}
      initialAnswers={planningAnswers}
      initialPhotos={planningPhotos}
      photoUsage={{
        enabled,
        count: photoCount,
        limit: CUSTOMER_PHOTO_LIMIT,
        remaining: Math.max(CUSTOMER_PHOTO_LIMIT - photoCount, 0),
      }}
      contracts={(contractsRes.data ?? []) as CustomerContract[]}
      billing={billingRes.data ?? null}
      lastVisit={lastVisit ? { ...lastVisit, records: lastVisitRecords } : null}
      nextVisit={nextVisitRes.data?.[0] ?? null}
    />
  )
}
