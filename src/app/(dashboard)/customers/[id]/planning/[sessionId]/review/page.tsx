'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import SuggestionCard from '../../_components/SuggestionCard'

interface Suggestion {
  id: string
  priority: 'high' | 'medium' | 'low'
  category: string
  title: string
  body: string
  is_custom: boolean
  is_dismissed: boolean
  display_order: number
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

export default function ReviewPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>()
  const router = useRouter()
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [addingCustom, setAddingCustom] = useState(false)
  const [customTitle, setCustomTitle] = useState('')
  const [customBody, setCustomBody] = useState('')

  useEffect(() => {
    async function load() {
      // 提案を生成（冪等: 毎回再生成）
      setGenerating(true)
      await fetch(`/api/planning/sessions/${sessionId}/generate`, { method: 'POST' })
      setGenerating(false)

      const res = await fetch(`/api/planning/sessions/${sessionId}`)
      const data = await res.json()
      setSuggestions((data.suggestions as Suggestion[]).sort(
        (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.display_order - b.display_order
      ))
      setLoading(false)
    }
    load()
  }, [sessionId])

  async function updateSuggestion(suggId: string, patch: Partial<Suggestion>) {
    setSuggestions(prev => prev.map(s => s.id === suggId ? { ...s, ...patch } : s))
    await fetch(`/api/planning/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: suggId, ...patch }),
    })
  }

  async function deleteSuggestion(suggId: string) {
    setSuggestions(prev => prev.filter(s => s.id !== suggId))
  }

  async function addCustom() {
    if (!customTitle.trim()) return
    const res = await fetch(`/api/planning/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        custom_suggestion: {
          priority: 'medium',
          category: 'カスタム',
          title: customTitle.trim(),
          body: customBody.trim(),
          is_custom: true,
        },
      }),
    })
    const data = await res.json()
    if (data.suggestion) {
      setSuggestions(prev => [...prev, data.suggestion as Suggestion])
    }
    setCustomTitle('')
    setCustomBody('')
    setAddingCustom(false)
  }

  // カテゴリ別にグループ化
  const groups = suggestions
    .filter(s => !s.is_dismissed)
    .reduce<Record<string, Suggestion[]>>((acc, s) => {
      acc[s.category] = [...(acc[s.category] ?? []), s]
      return acc
    }, {})

  if (loading || generating) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--color-primary)' }} />
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {generating ? 'プラン生成中...' : '読み込み中...'}
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-6 space-y-4 pb-48">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push(`/customers/${id}`)} className="p-2 -ml-2">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
            style={{ color: 'var(--color-text)' }}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="page-title flex-1">プラン提案</h1>
        <button
          onClick={() => router.push(`/customers/${id}/planning/${sessionId}/edit`)}
          className="btn-secondary text-sm px-3 py-2 flex-shrink-0"
        >
          回答を修正
        </button>
      </div>

      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
        回答内容をもとに提案を生成しました。編集・除外してから PDF で出力できます。
      </p>

      {Object.keys(groups).length === 0 ? (
        <p className="text-center py-12 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          条件に合う提案がありませんでした
        </p>
      ) : (
        Object.entries(groups).map(([category, items]) => (
          <div key={category} className="space-y-2">
            <p className="section-label">{category}</p>
            {items.map(s => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                onUpdate={updateSuggestion}
                onDelete={deleteSuggestion}
              />
            ))}
          </div>
        ))
      )}

      {/* カスタム提案追加 */}
      {addingCustom ? (
        <div className="card space-y-3">
          <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>カスタム提案を追加</p>
          <input
            className="input w-full text-sm"
            placeholder="タイトル"
            value={customTitle}
            onChange={e => setCustomTitle(e.target.value)}
          />
          <textarea
            className="input w-full text-sm"
            style={{ minHeight: 72, resize: 'none' }}
            placeholder="詳細（任意）"
            value={customBody}
            onChange={e => setCustomBody(e.target.value)}
            rows={3}
          />
          <div className="flex gap-2">
            <button onClick={addCustom} disabled={!customTitle.trim()} className="btn-primary text-sm py-2 px-4 disabled:opacity-40">追加</button>
            <button onClick={() => setAddingCustom(false)} className="btn-secondary text-sm py-2 px-4">キャンセル</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddingCustom(true)}
          className="btn-secondary w-full py-3 text-sm"
        >
          ＋ カスタム提案を追加
        </button>
      )}

      {/* 固定フッター */}
      <div className="fixed bottom-20 left-0 right-0 px-4 py-3 border-t"
        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', zIndex: 10 }}>
        <button
          onClick={() => router.push(`/customers/${id}/planning/${sessionId}/export`)}
          className="btn-primary w-full py-3"
        >
          PDF で出力
        </button>
      </div>
    </div>
  )
}
