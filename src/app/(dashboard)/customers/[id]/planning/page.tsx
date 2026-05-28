'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { CustomerContract } from '@/types/database'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

interface PlanningSession {
  id: string
  contract_id: string | null
  status: 'in_progress' | 'completed' | 'archived'
  created_at: string
  completed_at: string | null
  customer_contracts?: Pick<CustomerContract, 'title' | 'contracted_date'> | null
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
  const [contracts, setContracts] = useState<CustomerContract[]>([])
  const [loading, setLoading] = useState(true)
  const [creatingId, setCreatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/planning/sessions?customer_id=${id}`).then(r => r.json()),
      fetchContracts(id),
    ]).then(([sessionData, contractData]) => {
      setSessions(Array.isArray(sessionData) ? sessionData : [])
      setContracts(contractData)
      setLoading(false)
    })
  }, [id])

  const sessionsByContract = useMemo(() => {
    const map = new Map<string, PlanningSession>()
    for (const session of sessions) {
      if (session.contract_id) map.set(session.contract_id, session)
    }
    return map
  }, [sessions])

  const legacySessions = sessions.filter(s => !s.contract_id)

  async function startNew(contractId: string) {
    setCreatingId(contractId)
    const res = await fetch('/api/planning/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: id, contract_id: contractId }),
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
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--color-primary)' }} />
        </div>
      ) : contracts.length === 0 && legacySessions.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>契約履歴がまだありません</p>
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
            基本情報タブの契約履歴を登録してから、契約ごとにプランニングを開始してください。
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {contracts.map(contract => {
            const session = sessionsByContract.get(contract.id)
            return (
              <div key={contract.id} className="card flex items-center gap-3">
                <button
                  onClick={() => session
                    ? router.push(session.status === 'completed'
                      ? `/customers/${id}/planning/${session.id}/review`
                      : `/customers/${id}/planning/${session.id}`)
                    : startNew(contract.id)}
                  disabled={creatingId === contract.id}
                  className="flex-1 flex items-center justify-between gap-3 active:opacity-70 text-left disabled:opacity-40"
                >
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                      {contract.title}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                      契約日: {formatDate(contract.contracted_date)}
                    </p>
                    {session && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        {session.status === 'in_progress' ? '続きから入力' : session.completed_at
                          ? `完了 ${format(new Date(session.completed_at), 'M月d日', { locale: ja })}`
                          : STATUS_LABEL[session.status]}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="badge text-xs"
                      style={!session
                        ? { background: '#fce7f3', color: '#9d174d' }
                        : session.status === 'in_progress'
                          ? { background: '#fef9c3', color: '#854d0e' }
                          : { background: '#dcfce7', color: '#166534' }}
                    >
                      {!session ? '未作成' : STATUS_LABEL[session.status]}
                    </span>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                      style={{ color: 'var(--color-text-muted)' }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </button>

                {session && <DeleteControl
                  sessionId={session.id}
                  confirmId={confirmId}
                  deletingId={deletingId}
                  onConfirm={setConfirmId}
                  onDelete={deleteSession}
                />}
              </div>
            )
          })}

          {legacySessions.length > 0 && (
            <div className="space-y-2">
              <p className="section-label">契約未設定のプランニング</p>
              {legacySessions.map(session => (
                <div key={session.id} className="card flex items-center gap-3">
                  <button
                    onClick={() => router.push(session.status === 'completed'
                      ? `/customers/${id}/planning/${session.id}/review`
                      : `/customers/${id}/planning/${session.id}`)}
                    className="flex-1 flex items-center justify-between gap-3 active:opacity-70 text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                        {format(new Date(session.created_at), 'yyyy年M月d日', { locale: ja })}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        既存データ
                      </p>
                    </div>
                    <span className="badge text-xs" style={{ background: '#f3f4f6', color: '#374151' }}>
                      {STATUS_LABEL[session.status]}
                    </span>
                  </button>
                  <DeleteControl
                    sessionId={session.id}
                    confirmId={confirmId}
                    deletingId={deletingId}
                    onConfirm={setConfirmId}
                    onDelete={deleteSession}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="bottom-nav-spacer" />
    </div>
  )
}

function DeleteControl({ sessionId, confirmId, deletingId, onConfirm, onDelete }: {
  sessionId: string
  confirmId: string | null
  deletingId: string | null
  onConfirm: (id: string | null) => void
  onDelete: (id: string) => void
}) {
  if (confirmId === sessionId) {
    return (
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onDelete(sessionId)}
          disabled={deletingId === sessionId}
          className="text-xs px-2.5 py-1.5 rounded-lg font-medium disabled:opacity-40"
          style={{ background: '#fca5a5', color: '#991b1b' }}
        >
          {deletingId === sessionId ? '削除中' : '削除する'}
        </button>
        <button
          onClick={() => onConfirm(null)}
          className="text-xs px-2 py-1.5 rounded-lg"
          style={{ color: 'var(--color-text-muted)' }}
        >
          戻る
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => onConfirm(sessionId)}
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
  )
}

async function fetchContracts(customerId: string): Promise<CustomerContract[]> {
  const { createClient } = await import('@/lib/supabase/client')
  const supabase = createClient()
  const { data } = await supabase
    .from('customer_contracts')
    .select('*')
    .eq('customer_id', customerId)
    .order('contracted_date', { ascending: false })
  return data ?? []
}

function formatDate(date: string) {
  return format(new Date(date), 'yyyy年M月d日', { locale: ja })
}
