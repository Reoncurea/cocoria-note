'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { getStage, STAGE_TONE_STYLE } from '@/lib/constants/pipeline'
import { normalizeChecklist, totalProgress } from '@/lib/constants/visit-checklist'
import type { Json } from '@/types/database'

export type ScheduleVisit = {
  id: string
  customer_id: string
  visit_date: string
  start_time: string | null
  end_time: string | null
  report_sent: boolean
  checklist: Json
  customers: { name_kanji: string; is_recurring: boolean | null } | null
}

export type RecurringCustomer = {
  id: string
  name_kanji: string
  recurring_note: string | null
  pipeline_stage: string | null
}

type Range = 'upcoming' | 'past'

export default function ScheduleClient({
  visits,
  recurringCustomers,
  today,
}: {
  visits: ScheduleVisit[]
  recurringCustomers: RecurringCustomer[]
  today: string
}) {
  const [range, setRange] = useState<Range>('upcoming')
  const [recurringOnly, setRecurringOnly] = useState(false)

  const filtered = useMemo(() => {
    const base = visits.filter(v => range === 'upcoming' ? v.visit_date >= today : v.visit_date < today)
    const scoped = recurringOnly ? base.filter(v => v.customers?.is_recurring) : base
    return range === 'past' ? [...scoped].reverse() : scoped
  }, [visits, range, recurringOnly, today])

  // 日付ごとにまとめる
  const groups = useMemo(() => {
    const map = new Map<string, ScheduleVisit[]>()
    for (const visit of filtered) {
      const list = map.get(visit.visit_date) ?? []
      list.push(visit)
      map.set(visit.visit_date, list)
    }
    return Array.from(map, ([date, items]) => ({ date, items }))
  }, [filtered])

  return (
    <div className="px-4 pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">訪問予定</h1>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {filtered.length}件
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Toggle active={range === 'upcoming'} onClick={() => setRange('upcoming')}>これから</Toggle>
        <Toggle active={range === 'past'} onClick={() => setRange('past')}>過去</Toggle>
        <Toggle active={recurringOnly} onClick={() => setRecurringOnly(v => !v)}>定期利用のみ</Toggle>
      </div>

      {/* 定期利用者 */}
      {recurringCustomers.length > 0 && (
        <div className="card space-y-2">
          <p className="section-label mb-0">定期利用の方</p>
          <div className="space-y-2">
            {recurringCustomers.map(customer => {
              const stage = getStage(customer.pipeline_stage)
              return (
                <Link key={customer.id} href={`/customers/${customer.id}`}>
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl active:opacity-70"
                    style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
                        {customer.name_kanji}
                      </p>
                      {customer.recurring_note && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                          {customer.recurring_note}
                        </p>
                      )}
                    </div>
                    <span className="badge text-xs flex-shrink-0" style={STAGE_TONE_STYLE[stage.tone]}>
                      {stage.label}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--color-text-muted)' }}>
          <div className="text-4xl mb-3">📅</div>
          <p className="text-sm">
            {range === 'upcoming' ? 'これからの訪問予定はありません' : '過去の訪問はありません'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(group => (
            <div key={group.date} className="space-y-2">
              <p className="text-xs font-bold px-1" style={{ color: 'var(--color-primary-dark)' }}>
                {format(new Date(group.date), 'M月d日（E）', { locale: ja })}
                {group.date === today && <span className="ml-2">今日</span>}
              </p>
              {group.items.map(visit => {
                const { done, total } = totalProgress(normalizeChecklist(visit.checklist))
                return (
                  <Link key={visit.id} href={`/customers/${visit.customer_id}/visits/${visit.id}`}>
                    <div className="card flex items-center justify-between gap-3 py-3 active:opacity-70">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
                            {visit.customers?.name_kanji ?? '不明'}
                          </p>
                          {visit.customers?.is_recurring && (
                            <span className="badge text-xs" style={{ background: '#e0f2fe', color: '#075985' }}>定期</span>
                          )}
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                          {visit.start_time
                            ? `${visit.start_time.slice(0, 5)}${visit.end_time ? ` 〜 ${visit.end_time.slice(0, 5)}` : ''}`
                            : '時間未設定'}
                          {done > 0 && ` · チェック ${done}/${total}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {visit.visit_date < today && !visit.report_sent && (
                          <span className="badge text-xs" style={{ background: '#fce7f3', color: '#9d174d' }}>報告書未</span>
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
          ))}
        </div>
      )}

      <div className="bottom-nav-spacer" />
    </div>
  )
}

function Toggle({ active, onClick, children }: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs px-3 py-1.5 rounded-full font-medium"
      style={active
        ? { background: 'var(--color-primary)', color: 'white' }
        : { background: 'var(--color-surface)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
    >
      {children}
    </button>
  )
}
