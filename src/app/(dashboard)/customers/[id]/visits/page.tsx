import Link from 'next/link'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/server'
import { normalizeChecklist, totalProgress } from '@/lib/constants/visit-checklist'
import type { Json } from '@/types/database'

export const dynamic = 'force-dynamic'

type VisitListRow = {
  id: string
  visit_date: string
  start_time: string | null
  end_time: string | null
  report_sent: boolean
  checklist: Json
}

export default async function VisitsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data } = await supabase
    .from('visits')
    .select('id, visit_date, start_time, end_time, report_sent, checklist')
    .eq('customer_id', id)
    .order('visit_date', { ascending: false })

  const visits = (data ?? []) as VisitListRow[]
  const today = format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="px-4 pt-5 space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <p className="section-label mb-0">訪問履歴</p>
        <Link href={`/customers/${id}/visits/new`} className="btn-primary text-sm px-3 py-2">
          ＋ 記録
        </Link>
      </div>

      {visits.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>訪問履歴がありません</p>
          <Link href={`/customers/${id}/visits/new`} className="btn-primary text-sm px-5 py-2.5">
            ＋ 最初の訪問を記録
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {visits.map(v => {
            const { done, total } = totalProgress(normalizeChecklist(v.checklist))
            const upcoming = v.visit_date >= today

            return (
              <Link key={v.id} href={`/customers/${id}/visits/${v.id}`}>
                <div className="card flex items-center justify-between gap-3 active:opacity-70 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
                        {format(new Date(v.visit_date), 'yyyy年M月d日（E）', { locale: ja })}
                      </p>
                      {upcoming && (
                        <span className="badge text-xs" style={{ background: '#dbeafe', color: '#1e40af' }}>予定</span>
                      )}
                    </div>
                    {v.start_time && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        {v.start_time.slice(0, 5)}{v.end_time ? ` ～ ${v.end_time.slice(0, 5)}` : ''}
                      </p>
                    )}
                    {done > 0 && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-primary-dark)' }}>
                        チェックリスト {done}/{total}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {v.report_sent && (
                      <span className="badge" style={{ background: '#dcfce7', color: '#166534' }}>送信済み</span>
                    )}
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                      style={{ color: 'var(--color-text-muted)' }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <div className="bottom-nav-spacer" />
    </div>
  )
}
