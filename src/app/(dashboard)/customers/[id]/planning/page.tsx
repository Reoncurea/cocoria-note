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
            <button
              key={s.id}
              onClick={() => router.push(
                s.status === 'completed'
                  ? `/customers/${id}/planning/${s.id}/review`
                  : `/customers/${id}/planning/${s.id}`
              )}
              className="w-full card flex items-center justify-between gap-3 active:opacity-70"
            >
              <div className="text-left">
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
          ))}
        </div>
      )}
      <div className="bottom-nav-spacer" />
    </div>
  )
}
