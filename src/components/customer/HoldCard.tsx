'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PauseCircle, PlayCircle } from 'lucide-react'
import {
  HOLD_DESCRIPTION,
  HOLD_LABEL,
  HOLD_TONE_STYLE,
  isHoldExpired,
  isOnHold,
  toHoldState,
  type HoldState,
} from '@/lib/constants/pipeline'

// 進行ステータスとは別に「いま追わない」を切り替える。
// ステータスは触らないので、解除すれば元の段階からそのまま再開できる。

export default function HoldCard({
  customerId,
  holdState,
  holdReason,
  holdUntil,
}: {
  customerId: string
  holdState: string | null
  holdReason: string | null
  holdUntil: string | null
}) {
  const router = useRouter()
  const current = toHoldState(holdState)
  const held = isOnHold({ hold_state: holdState, hold_until: holdUntil })
  const expired = isHoldExpired({ hold_state: holdState, hold_until: holdUntil })

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draftState, setDraftState] = useState<HoldState>(current === 'active' ? 'paused' : current)
  const [reason, setReason] = useState(holdReason ?? '')
  const [until, setUntil] = useState(holdUntil ?? '')

  async function save(state: HoldState) {
    setSaving(true)
    setError(null)

    const response = await fetch(`/api/customers/${customerId}/hold`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hold_state: state,
        hold_reason: state === 'active' ? null : (reason || null),
        hold_until: state === 'active' ? null : (until || null),
      }),
    })

    setSaving(false)
    if (!response.ok) {
      setError('保存に失敗しました。時間をおいて再度お試しください。')
      return
    }

    setOpen(false)
    router.refresh()
  }

  // 止めていない・設定画面も開いていないときは、小さく出すだけにする
  if (!held && !open) {
    return (
      <div className="card py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          {expired ? (
            <>
              <p className="text-sm font-semibold" style={{ color: '#c2410c' }}>
                {HOLD_LABEL[current]}の期限が来ました
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {holdUntil} を過ぎたので、通常の対応に戻っています。
              </p>
            </>
          ) : (
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              いまは通常どおり追いかけています
            </p>
          )}
        </div>
        <button type="button" onClick={() => setOpen(true)} className="btn-secondary text-xs px-3 py-2 flex-shrink-0">
          <PauseCircle size={14} className="inline mr-1" />
          一旦止める
        </button>
      </div>
    )
  }

  const tone = HOLD_TONE_STYLE[current]

  return (
    <div className="card space-y-3" style={held ? { borderColor: tone.color } : undefined}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="section-label mb-1.5">追跡状態</p>
          {held ? (
            <>
              <span className="badge" style={tone}>{HOLD_LABEL[current]}</span>
              {holdReason && (
                <p className="text-xs mt-1.5" style={{ color: 'var(--color-text)' }}>{holdReason}</p>
              )}
              <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                {holdUntil
                  ? `${holdUntil} まで通知しません。その日が来たら自動で戻ります。`
                  : '解除するまで通知しません。'}
              </p>
            </>
          ) : (
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              いつから止めるかを決めます。進行ステータスはそのまま残ります。
            </p>
          )}
        </div>

        {held && (
          <button
            type="button"
            onClick={() => save('active')}
            disabled={saving}
            className="btn-primary text-xs px-3 py-2 flex-shrink-0 disabled:opacity-60"
          >
            <PlayCircle size={14} className="inline mr-1" />
            {saving ? '更新中' : '再開'}
          </button>
        )}
      </div>

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn-secondary w-full text-sm py-2">
          止め方を変える
        </button>
      ) : (
        <div className="space-y-3 pt-1" style={{ borderTop: '1px solid var(--color-border)' }}>
          <div className="space-y-1.5">
            {(['waiting', 'paused'] as HoldState[]).map(state => {
              const active = draftState === state
              const stateTone = HOLD_TONE_STYLE[state]
              return (
                <button
                  key={state}
                  type="button"
                  onClick={() => setDraftState(state)}
                  className="w-full text-left px-3 py-2.5 rounded-xl"
                  style={{
                    background: active ? stateTone.background : 'var(--color-surface)',
                    border: `1px solid ${active ? stateTone.color : 'var(--color-border)'}`,
                  }}
                >
                  <p className="text-sm font-semibold" style={{ color: active ? stateTone.color : 'var(--color-text)' }}>
                    {HOLD_LABEL[state]}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {HOLD_DESCRIPTION[state]}
                  </p>
                </button>
              )
            })}
          </div>

          <div>
            <label className="form-label">理由（任意）</label>
            <input
              className="input text-sm"
              value={reason}
              onChange={event => setReason(event.target.value)}
              placeholder="例：出産の連絡待ち / 返信なし・様子見"
            />
          </div>

          <div>
            <label className="form-label">再開予定日（任意）</label>
            <input
              className="input text-sm"
              type="date"
              value={until}
              onChange={event => setUntil(event.target.value)}
            />
            <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
              入れておくと、その日が来た時点で自動的に通常へ戻ります。
              空のままなら、解除するまで通知は出ません。
            </p>
          </div>

          {error && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ background: '#fef2f2', color: '#dc2626' }}>{error}</p>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary text-sm py-2.5 flex-1">
              取消
            </button>
            <button
              type="button"
              onClick={() => save(draftState)}
              disabled={saving}
              className="btn-primary text-sm py-2.5 flex-1 disabled:opacity-60"
            >
              {saving ? '保存中...' : `${HOLD_LABEL[draftState]}にする`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
