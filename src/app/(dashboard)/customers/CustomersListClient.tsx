'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import {
  HOLD_LABEL,
  HOLD_TONE_STYLE,
  STAGE_LIST,
  STAGE_TONE_STYLE,
  daysSince,
  getStage,
  isOnHold,
  needsFollowUp,
  nextTaskFor,
  toHoldState,
} from '@/lib/constants/pipeline'

export type CustomerListItem = {
  id: string
  name_kanji: string
  name_kana: string
  inquiry_date: string | null
  pipeline_stage: string | null
  stage_updated_at: string | null
  is_recurring: boolean | null
  hold_state: string | null
  hold_reason: string | null
  hold_until: string | null
}

type SortKey = 'stale' | 'stage' | 'recent'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'stale', label: '要対応順' },
  { key: 'stage', label: '進行順' },
  { key: 'recent', label: '新着順' },
]

export default function CustomersListClient({ customers }: { customers: CustomerListItem[] }) {
  const [query, setQuery] = useState('')
  const [stageFilter, setStageFilter] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('stale')
  const [recurringOnly, setRecurringOnly] = useState(false)
  /** 保留・待ちの顧客を一覧に出すか。既定では隠す */
  const [showHeld, setShowHeld] = useState(false)

  const staleCount = useMemo(
    () => customers.filter(c => needsFollowUp(c)).length,
    [customers],
  )

  const heldCount = useMemo(
    () => customers.filter(c => isOnHold(c)).length,
    [customers],
  )

  // ステージごとの件数。0件のステージは絞り込みチップに出さない
  const stageCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const customer of customers) {
      const key = getStage(customer.pipeline_stage).key
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [customers])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()

    const filtered = customers.filter(c => {
      // 止めている顧客は、探しているときだけ出す
      if (!showHeld && isOnHold(c)) return false
      if (showHeld && !isOnHold(c)) return false
      if (recurringOnly && !c.is_recurring) return false
      if (stageFilter && getStage(c.pipeline_stage).key !== stageFilter) return false
      if (!q) return true
      return c.name_kanji.toLowerCase().includes(q) || c.name_kana.toLowerCase().includes(q)
    })

    return [...filtered].sort((a, b) => {
      if (sortKey === 'stage') {
        return getStage(a.pipeline_stage).step - getStage(b.pipeline_stage).step
      }
      if (sortKey === 'stale') {
        const aStale = needsFollowUp(a)
        const bStale = needsFollowUp(b)
        if (aStale !== bStale) return aStale ? -1 : 1
        return (daysSince(b.stage_updated_at) ?? 0) - (daysSince(a.stage_updated_at) ?? 0)
      }
      return 0 // recent: サーバー側で created_at 降順に並んでいる
    })
  }, [customers, query, stageFilter, sortKey, recurringOnly, showHeld])

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title">顧客一覧</h1>
        <Link href="/customers/new" className="btn-primary text-sm px-4 py-2">
          ＋ 登録
        </Link>
      </div>

      {staleCount > 0 && (
        <div className="card py-3 mb-4 flex items-center gap-2" style={{ borderColor: '#fb923c', background: '#fff7ed' }}>
          <span className="text-lg">🔔</span>
          <p className="text-sm" style={{ color: '#9a3412' }}>
            <span className="font-semibold">{staleCount}件</span>が同じステータスのまま止まっています
          </p>
        </div>
      )}

      {/* 検索バー */}
      <div className="relative mb-3">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-muted)' }}
          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="search"
          className="input"
          style={{ paddingLeft: '2.25rem' }}
          placeholder="名前で検索..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      {/* 並び替え・定期利用 */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {SORT_OPTIONS.map(option => (
          <button
            key={option.key}
            type="button"
            onClick={() => setSortKey(option.key)}
            className="text-xs px-3 py-1.5 rounded-full font-medium"
            style={sortKey === option.key
              ? { background: 'var(--color-primary)', color: 'white' }
              : { background: 'var(--color-surface)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
          >
            {option.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setRecurringOnly(v => !v)}
          className="text-xs px-3 py-1.5 rounded-full font-medium"
          style={recurringOnly
            ? { background: 'var(--color-primary-dark)', color: 'white' }
            : { background: 'var(--color-surface)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
        >
          定期利用のみ
        </button>
        {heldCount > 0 && (
          <button
            type="button"
            onClick={() => setShowHeld(v => !v)}
            className="text-xs px-3 py-1.5 rounded-full font-medium"
            style={showHeld
              ? { background: '#4b5563', color: 'white' }
              : { background: 'var(--color-surface)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
          >
            保留・待ち {heldCount}
          </button>
        )}
      </div>

      {showHeld && (
        <p className="text-xs mb-3 px-1" style={{ color: 'var(--color-text-muted)' }}>
          止めている顧客だけを表示しています。通知やアラートには出ません。
        </p>
      )}

      {/* ステータス絞り込み */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
        <button
          type="button"
          onClick={() => setStageFilter(null)}
          className="text-xs px-3 py-1.5 rounded-full whitespace-nowrap font-medium flex-shrink-0"
          style={stageFilter === null
            ? { background: 'var(--color-primary)', color: 'white' }
            : { background: 'var(--color-surface)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
        >
          すべて {customers.length}
        </button>
        {STAGE_LIST.filter(stage => (stageCounts.get(stage.key) ?? 0) > 0).map(stage => {
          const active = stageFilter === stage.key
          const tone = STAGE_TONE_STYLE[stage.tone]
          return (
            <button
              key={stage.key}
              type="button"
              onClick={() => setStageFilter(active ? null : stage.key)}
              className="text-xs px-3 py-1.5 rounded-full whitespace-nowrap font-medium flex-shrink-0"
              style={active
                ? { background: tone.color, color: 'white' }
                : { background: tone.background, color: tone.color }}
            >
              {stage.step}. {stage.label} {stageCounts.get(stage.key)}
            </button>
          )
        })}
      </div>

      {/* リスト */}
      {visible.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--color-text-muted)' }}>
          {customers.length === 0 ? (
            <div>
              <div className="text-4xl mb-3">🌸</div>
              <p className="font-medium">まだ顧客が登録されていません</p>
              <p className="text-sm mt-1">「＋ 登録」ボタンから追加してください</p>
            </div>
          ) : '条件に合う顧客がいません'}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(c => (
            <CustomerCard key={c.id} customer={c} />
          ))}
        </div>
      )}

      <div className="bottom-nav-spacer" />
    </div>
  )
}

function CustomerCard({ customer }: { customer: CustomerListItem }) {
  const stage = getStage(customer.pipeline_stage)
  const tone = STAGE_TONE_STYLE[stage.tone]
  const stale = needsFollowUp(customer)
  const days = daysSince(customer.stage_updated_at)
  const held = isOnHold(customer)
  const holdState = toHoldState(customer.hold_state)

  return (
    <Link href={`/customers/${customer.id}`}>
      <div
        className="card space-y-2 active:opacity-80 transition-opacity"
        style={stale ? { borderColor: '#fb923c' } : undefined}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg font-bold"
            style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)' }}>
            {customer.name_kanji[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                {customer.name_kanji}
              </span>
              {customer.is_recurring && (
                <span className="badge text-xs" style={{ background: '#e0f2fe', color: '#075985' }}>定期</span>
              )}
              {held && (
                <span className="badge text-xs" style={HOLD_TONE_STYLE[holdState]}>
                  {HOLD_LABEL[holdState]}
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {customer.name_kana}
              {customer.inquiry_date && (
                <> · 問い合わせ: {format(new Date(customer.inquiry_date), 'M月d日', { locale: ja })}</>
              )}
            </p>
          </div>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
            style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>

        <div className="flex items-center gap-2 flex-wrap" style={{ paddingLeft: '3.25rem' }}>
          <span className="badge text-xs" style={tone}>
            {stage.step}. {stage.label}
          </span>
          {days !== null && !held && (
            <span className="text-[11px]" style={{ color: stale ? '#c2410c' : 'var(--color-text-muted)' }}>
              {stale ? `⚠ ${days}日 動きなし` : days === 0 ? '本日更新' : `${days}日前に更新`}
            </span>
          )}
          {held && (
            <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
              {customer.hold_reason ?? '対応を止めています'}
              {customer.hold_until && `（${customer.hold_until} に再開）`}
            </span>
          )}
        </div>

        {stage.key !== 'completed' && !held && (
          <div className="text-xs rounded-lg px-3 py-2" style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>次のタスク: </span>
            {nextTaskFor(customer.pipeline_stage, customer.is_recurring).task}
          </div>
        )}
      </div>
    </Link>
  )
}
