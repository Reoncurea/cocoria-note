'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronUp, MapPin, Navigation } from 'lucide-react'
import {
  CHECKLIST_PHASES,
  phaseProgress,
  totalProgress,
  type ChecklistItem,
  type ChecklistState,
} from '@/lib/constants/visit-checklist'
import type { ChecklistContext } from '@/lib/visits/checklist-context'

type PendingEntry = { checked?: boolean; note?: string | null; time?: string | null }

export default function VisitChecklist({
  visitId,
  initialState,
  context,
}: {
  visitId: string
  initialState: ChecklistState
  context: Record<string, ChecklistContext>
}) {
  const [state, setState] = useState<ChecklistState>(initialState)
  const [openPhase, setOpenPhase] = useState<string | null>('pre')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 入力のたびに送らず、少し待ってからまとめて送る
  const pending = useRef<Record<string, PendingEntry>>({})
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(async () => {
    const entries = pending.current
    pending.current = {}
    if (Object.keys(entries).length === 0) return

    setSaving(true)
    const response = await fetch(`/api/visits/${visitId}/checklist`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries }),
    })
    setSaving(false)

    if (!response.ok) {
      setError('チェックリストの保存に失敗しました。通信環境を確認してください。')
      return
    }
    setError(null)
  }, [visitId])

  const queue = useCallback((itemId: string, entry: PendingEntry) => {
    pending.current[itemId] = { ...pending.current[itemId], ...entry }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void flush() }, 700)
  }, [flush])

  // 画面を離れるときに、書きかけを取りこぼさない
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
      void flush()
    }
  }, [flush])

  function toggle(item: ChecklistItem) {
    const next = !state[item.id]?.checked
    setState(prev => ({ ...prev, [item.id]: { ...prev[item.id], checked: next } }))
    queue(item.id, { checked: next })
  }

  function setNote(item: ChecklistItem, note: string) {
    setState(prev => ({ ...prev, [item.id]: { ...prev[item.id], note } }))
    queue(item.id, { note: note || null })
  }

  function setTime(item: ChecklistItem, time: string) {
    setState(prev => ({ ...prev, [item.id]: { ...prev[item.id], time } }))
    queue(item.id, { time: time || null })
  }

  function stampNow(item: ChecklistItem) {
    const now = new Date()
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    setState(prev => ({ ...prev, [item.id]: { ...prev[item.id], time, checked: true } }))
    queue(item.id, { time, checked: true })
  }

  const total = totalProgress(state)

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="section-label mb-0">訪問チェックリスト</p>
        <span className="text-xs" style={{ color: saving ? 'var(--color-primary-dark)' : 'var(--color-text-muted)' }}>
          {saving ? '保存中...' : `${total.done} / ${total.total}`}
        </span>
      </div>

      <div className="rounded-full overflow-hidden" style={{ height: '6px', background: 'var(--color-border)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: total.total > 0 ? `${(total.done / total.total) * 100}%` : '0%',
            background: 'var(--color-primary)',
          }}
        />
      </div>

      {error && (
        <p className="text-xs px-3 py-2 rounded-lg" style={{ background: '#fef2f2', color: '#dc2626' }}>{error}</p>
      )}

      <div className="space-y-2">
        {CHECKLIST_PHASES.map(phase => {
          const open = openPhase === phase.id
          const progress = phaseProgress(phase, state)
          const complete = progress.done === progress.total

          return (
            <div
              key={phase.id}
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid var(--color-border)' }}
            >
              <button
                type="button"
                onClick={() => setOpenPhase(open ? null : phase.id)}
                className="w-full flex items-center justify-between gap-3 px-3 py-3 text-left"
                style={{ background: complete ? '#f0fdf4' : 'var(--color-surface)' }}
              >
                <div className="min-w-0">
                  <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
                    {phase.title}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {progress.done} / {progress.total}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {complete && <Check size={16} style={{ color: '#16a34a' }} />}
                  {open
                    ? <ChevronUp size={18} style={{ color: 'var(--color-text-muted)' }} />
                    : <ChevronDown size={18} style={{ color: 'var(--color-text-muted)' }} />}
                </div>
              </button>

              {open && (
                <div className="px-3 py-3 space-y-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                    {phase.description}
                  </p>

                  {phase.items.map(item => (
                    <ChecklistRow
                      key={item.id}
                      item={item}
                      entry={state[item.id] ?? {}}
                      context={context[item.id]}
                      onToggle={() => toggle(item)}
                      onNote={value => setNote(item, value)}
                      onTime={value => setTime(item, value)}
                      onStampNow={() => stampNow(item)}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ChecklistRow({
  item,
  entry,
  context,
  onToggle,
  onNote,
  onTime,
  onStampNow,
}: {
  item: ChecklistItem
  entry: { checked?: boolean; note?: string; time?: string }
  context?: ChecklistContext
  onToggle: () => void
  onNote: (value: string) => void
  onTime: (value: string) => void
  onStampNow: () => void
}) {
  const checked = entry.checked === true

  return (
    <div className="space-y-2 pb-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start gap-2.5 text-left"
      >
        <span
          className="flex items-center justify-center flex-shrink-0 rounded-md"
          style={{
            width: '22px',
            height: '22px',
            marginTop: '1px',
            background: checked ? 'var(--color-primary)' : 'var(--color-surface)',
            border: `1.5px solid ${checked ? 'var(--color-primary)' : 'var(--color-border)'}`,
          }}
        >
          {checked && <Check size={14} color="#fff" strokeWidth={3} />}
        </span>
        <span
          className="text-sm"
          style={{
            color: checked ? 'var(--color-text-muted)' : 'var(--color-text)',
            textDecoration: checked ? 'line-through' : 'none',
          }}
        >
          {item.label}
        </span>
      </button>

      {/* カルテ・プランニングから拾った参照情報 */}
      {context && (context.lines.length > 0 || context.mapUrl) && (
        <div className="ml-8 rounded-lg px-3 py-2 space-y-1" style={{ background: 'var(--color-surface)' }}>
          {context.lines.map((line, index) => (
            <div key={index} className="flex gap-2 text-xs">
              <span className="flex-shrink-0" style={{ color: 'var(--color-text-muted)', minWidth: '5rem' }}>
                {line.label}
              </span>
              <span className="whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>{line.value}</span>
            </div>
          ))}
          {(context.mapUrl || context.directionsUrl) && (
            <div className="flex gap-2 pt-1">
              {context.mapUrl && (
                <a href={context.mapUrl} target="_blank" rel="noreferrer"
                  className="btn-secondary text-xs px-3 py-1.5">
                  <MapPin size={12} className="inline mr-1" />
                  地図
                </a>
              )}
              {context.directionsUrl && (
                <a href={context.directionsUrl} target="_blank" rel="noreferrer"
                  className="btn-secondary text-xs px-3 py-1.5">
                  <Navigation size={12} className="inline mr-1" />
                  経路
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {item.time && (
        <div className="ml-8 flex items-center gap-2">
          <input
            type="time"
            className="input text-sm"
            style={{ maxWidth: '9rem' }}
            value={entry.time ?? ''}
            onChange={event => onTime(event.target.value)}
          />
          <button type="button" onClick={onStampNow} className="btn-secondary text-xs px-3 py-2">
            現在時刻
          </button>
        </div>
      )}

      {item.note && (
        <textarea
          className="input text-sm ml-8"
          style={{ width: 'calc(100% - 2rem)' }}
          rows={2}
          placeholder={item.placeholder ?? 'メモ'}
          defaultValue={entry.note ?? ''}
          onBlur={event => onNote(event.target.value)}
        />
      )}
    </div>
  )
}
