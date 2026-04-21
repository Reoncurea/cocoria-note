'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

interface PlanningSession {
  id: string
  status: 'in_progress' | 'completed' | 'archived'
  created_at: string
  completed_at: string | null
}

const STATUS_LABEL: Record<string, string> = {
  in_progress: '入力中',
  completed: '完了',
  archived: 'アーカイブ',
}

export default function PlanningListPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [sessions, setSessions] = useState<PlanningSession[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/planning/sessions?customer_id=${id}`)
      .then(r => r.json())
      .then(data => {
        setSessions(data)
        setLoading(false)
      })
  }, [id])

  async function startNew() {
    setCreating(true)
    const res = await fetch('/api/planning/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: id }),
    })
    const data = await res.json() as PlanningSession
    router.push(`/customers/${id}/planning/${data.id}`)
  }

  async function deleteSession(sessionId: string) {
    setDeletingId(sessionId)
    await fetch(`/api/planning/sessions/${sessionId}`, { method: 'DELETE' })
    setSessions(prev => prev.filter(s => s.id !== sessionId))
    setConfirmId(null)
    setDeletingId(null)
  }

  return (
    <div className="px-4 pt-5 space-y-4 pb-8">
      <button
        onClick={startNew}
        disabled={creating}
        className="btn-primary w-full py-3 disabled:opacity-40"
      >
        {creating ? '作成中...' : '＋ 新規プランニング開始'}
      </button>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--color-primary)' }} />
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-center py-12 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          プランニング履歴がありません
        </p>
      ) : (
        <div className="space-y-2">
          {sessions.map(s => (
            <div key={s.id} className="card flex items-center gap-3">
              {/* メインボタン */}
              <button
                onClick={() => router.push(
                  s.status === 'completed'
                    ? `/customers/${id}/planning/${s.id}/review`
                    : `/customers/${id}/planning/${s.id}`
                )}
                className="flex-1 flex items-center justify-between gap-3 active:opacity-70 text-left"
              >
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    {format(new Date(s.created_at), 'yyyy年M月d日（E）', { locale: ja })}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {s.status === 'in_progress' ? '続きから入力' : s.completed_at
                      ? `完了: ${format(new Date(s.completed_at), 'M月d日', { locale: ja })}`
                      : STATUS_LABEL[s.status]}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="badge text-xs"
                    style={s.status === 'in_progress'
                      ? { background: '#fef9c3', color: '#854d0e' }
                      : { background: '#dcfce7', color: '#166534' }}
                  >
                    {STATUS_LABEL[s.status]}
                  </span>
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                    style={{ color: 'var(--color-text-muted)' }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </button>

              {/* 削除ボタン */}
              {confirmId === s.id ? (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => deleteSession(s.id)}
                    disabled={deletingId === s.id}
                    className="text-xs px-2.5 py-1.5 rounded-lg font-medium disabled:opacity-40"
                    style={{ background: '#fca5a5', color: '#991b1b' }}
                  >
                    {deletingId === s.id ? '削除中' : '削除する'}
                  </button>
                  <button
                    onClick={() => setConfirmId(null)}
                    className="text-xs px-2 py-1.5 rounded-lg"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    戻る
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmId(s.id)}
                  className="flex-shrink-0 p-1.5 rounded-lg"
                  title="削除"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="bottom-nav-spacer" />
    </div>
  )
}
