'use client'

import { useState } from 'react'

interface Suggestion {
  id: string
  priority: 'high' | 'medium' | 'low'
  category: string
  title: string
  body: string
  is_custom: boolean
  is_dismissed: boolean
}

interface Props {
  suggestion: Suggestion
  onUpdate: (id: string, patch: Partial<Suggestion>) => void
  onDelete: (id: string) => void
}

const PRIORITY_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  high:   { bg: '#fee2e2', text: '#991b1b', label: '重要' },
  medium: { bg: '#fef9c3', text: '#854d0e', label: '推奨' },
  low:    { bg: '#dcfce7', text: '#166534', label: '参考' },
}

export default function SuggestionCard({ suggestion, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(suggestion.title)
  const [body, setBody] = useState(suggestion.body)

  const p = PRIORITY_STYLE[suggestion.priority]

  function saveEdit() {
    onUpdate(suggestion.id, { title, body })
    setEditing(false)
  }

  if (suggestion.is_dismissed) return null

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: '1.5px solid var(--color-border)', background: 'var(--color-bg)' }}
    >
      <div
        className="px-4 py-1.5 flex items-center justify-between"
        style={{ background: p.bg }}
      >
        <span className="text-xs font-bold" style={{ color: p.text }}>{p.label} · {suggestion.category}</span>
        {suggestion.is_custom && (
          <span className="text-xs" style={{ color: p.text }}>カスタム</span>
        )}
      </div>

      <div className="p-4 space-y-2">
        {editing ? (
          <>
            <input
              className="input w-full text-sm"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
            <textarea
              className="input w-full text-sm"
              style={{ minHeight: 72, resize: 'none' }}
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2">
              <button onClick={saveEdit} className="btn-primary text-sm py-2 px-4">保存</button>
              <button onClick={() => setEditing(false)} className="btn-secondary text-sm py-2 px-4">キャンセル</button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>{suggestion.title}</p>
            <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text-muted)' }}>{suggestion.body}</p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setEditing(true)}
                className="text-xs flex items-center gap-1"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                編集
              </button>
              <button
                onClick={() => onUpdate(suggestion.id, { is_dismissed: true })}
                className="text-xs flex items-center gap-1"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M17 12H7" />
                </svg>
                除外
              </button>
              {suggestion.is_custom && (
                <button
                  onClick={() => onDelete(suggestion.id)}
                  className="text-xs flex items-center gap-1"
                  style={{ color: '#ef4444' }}
                >
                  削除
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
