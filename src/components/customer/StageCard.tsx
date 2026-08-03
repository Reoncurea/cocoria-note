'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown } from 'lucide-react'
import {
  RECURRING_RESTING_STAGE,
  STAGE_LIST,
  STAGE_TONE_STYLE,
  daysSince,
  getStage,
  isStale,
  nextStage,
  nextTaskFor,
  type PipelineStage,
} from '@/lib/constants/pipeline'

export default function StageCard({
  customerId,
  stage,
  stageUpdatedAt,
  stageNote,
  isRecurring,
  onHold,
}: {
  customerId: string
  stage: string | null
  stageUpdatedAt: string | null
  stageNote: string | null
  /** 定期利用の顧客では請求・入金の段階を飛ばす */
  isRecurring: boolean | null
  /** 保留・待ちのあいだは放置の警告を出さない */
  onHold?: boolean
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [note, setNote] = useState(stageNote ?? '')

  const current = getStage(stage)
  const tone = STAGE_TONE_STYLE[current.tone]
  const stale = !onHold && isStale(stage, stageUpdatedAt)
  const days = daysSince(stageUpdatedAt)
  const forward = nextStage(stage, isRecurring)
  const task = nextTaskFor(stage, isRecurring)

  async function changeStage(target: PipelineStage, nextNote?: string) {
    setSaving(true)
    setError(null)

    const response = await fetch(`/api/customers/${customerId}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: target, note: (nextNote ?? note) || null }),
    })

    setSaving(false)
    if (!response.ok) {
      setError('ステータスの更新に失敗しました。時間をおいて再度お試しください。')
      return
    }

    setPickerOpen(false)
    router.refresh()
  }

  const taskHref = current.href ? `/customers/${customerId}${current.href}` : null

  return (
    <div className="card space-y-3" style={stale ? { borderColor: '#fb923c' } : undefined}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="section-label mb-1.5">進行ステータス</p>
          <span className="badge" style={tone}>
            {current.step}. {current.label}
          </span>
          {days !== null && (
            <p className="text-[11px] mt-1.5" style={{ color: stale ? '#c2410c' : 'var(--color-text-muted)' }}>
              {stale ? `⚠ ${days}日 動きがありません` : days === 0 ? '本日更新' : `${days}日前に更新`}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setPickerOpen(open => !open)}
          className="btn-secondary text-xs px-3 py-2 flex-shrink-0"
        >
          変更
          <ChevronDown size={14} className="inline ml-1" />
        </button>
      </div>

      {/* 進捗バー */}
      <div className="flex gap-0.5">
        {STAGE_LIST.map(item => (
          <div
            key={item.key}
            className="flex-1 rounded-full"
            style={{
              height: '4px',
              background: item.step <= current.step ? tone.color : 'var(--color-border)',
            }}
          />
        ))}
      </div>
      <p className="text-[11px] text-right" style={{ color: 'var(--color-text-muted)' }}>
        {current.step} / {STAGE_LIST.length}
      </p>

      {/* 次のタスク */}
      <div className="rounded-xl p-3 space-y-1.5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <p className="text-xs font-bold" style={{ color: 'var(--color-primary-dark)' }}>次のタスク</p>
        <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{task.task}</p>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          {task.detail}
        </p>
        {taskHref && (
          <Link href={taskHref} className="btn-secondary text-xs px-3 py-1.5 inline-block mt-1">
            この作業を開く
          </Link>
        )}
      </div>

      {/*
        定期利用の方は毎回この段階を回さない運用。
        進捗は訪問チェックリストと訪問予定で見る。
      */}
      {isRecurring && (
        <div className="rounded-xl p-3 space-y-2" style={{ background: '#e0f2fe' }}>
          <p className="text-xs leading-relaxed" style={{ color: '#075985' }}>
            定期利用の方です。毎回の進捗は<strong>訪問チェックリスト</strong>と
            <strong>訪問予定</strong>で管理するので、この段階を毎回回す必要はありません。
            ステータスは「{getStage(RECURRING_RESTING_STAGE).label}」のままで構いません。
            請求は月末にまとめて行います。
          </p>
          {current.key !== RECURRING_RESTING_STAGE && (
            <button
              type="button"
              onClick={() => changeStage(RECURRING_RESTING_STAGE)}
              disabled={saving}
              className="btn-secondary w-full text-xs py-2 disabled:opacity-60"
            >
              {saving ? '更新中...' : `「${getStage(RECURRING_RESTING_STAGE).label}」に戻す`}
            </button>
          )}
        </div>
      )}

      {stageNote && !pickerOpen && (
        <p className="text-xs px-3 py-2 rounded-lg" style={{ background: '#fffbeb', color: '#92400e' }}>
          メモ: {stageNote}
        </p>
      )}

      {error && (
        <p className="text-xs px-3 py-2 rounded-lg" style={{ background: '#fef2f2', color: '#dc2626' }}>{error}</p>
      )}

      {forward && !pickerOpen && (
        <button
          type="button"
          onClick={() => changeStage(forward)}
          disabled={saving}
          className="btn-primary w-full text-sm py-2.5 disabled:opacity-60"
        >
          <Check size={15} className="inline mr-1" />
          {saving ? '更新中...' : `完了して「${getStage(forward).label}」へ進む`}
        </button>
      )}

      {pickerOpen && (
        <div className="space-y-3 pt-1">
          <div>
            <label className="form-label">メモ（任意）</label>
            <input
              className="input text-sm"
              value={note}
              onChange={event => setNote(event.target.value)}
              placeholder="例：先方の返信待ち"
            />
          </div>

          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {STAGE_LIST.map(item => {
              const active = item.key === current.key
              const itemTone = STAGE_TONE_STYLE[item.tone]
              // 定期利用は月末にまとめて請求するので、訪問ごとの流れでは通らない
              const skipped = Boolean(isRecurring && item.spotOnly)
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => changeStage(item.key)}
                  disabled={saving}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left text-sm disabled:opacity-50"
                  style={{
                    background: active ? itemTone.background : 'var(--color-surface)',
                    border: `1px solid ${active ? itemTone.color : 'var(--color-border)'}`,
                    color: active ? itemTone.color : skipped ? 'var(--color-text-muted)' : 'var(--color-text)',
                    fontWeight: active ? 600 : 400,
                    opacity: skipped && !active ? 0.6 : 1,
                  }}
                >
                  <span className="text-xs w-5 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                    {item.step}
                  </span>
                  {item.label}
                  {skipped && (
                    <span className="text-[10px] ml-1" style={{ color: 'var(--color-text-muted)' }}>
                      月末請求のため通常は使いません
                    </span>
                  )}
                  {active && <Check size={15} className="ml-auto flex-shrink-0" />}
                </button>
              )
            })}
          </div>

          <button type="button" onClick={() => setPickerOpen(false)} className="btn-secondary w-full text-sm py-2">
            閉じる
          </button>
        </div>
      )}
    </div>
  )
}
