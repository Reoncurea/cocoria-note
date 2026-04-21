'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Visit } from '@/types/database'
import Link from 'next/link'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

export default function VisitsPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('visits')
      .select('*')
      .eq('customer_id', id)
      .order('visit_date', { ascending: false })
      .then(({ data }) => {
        setVisits(data ?? [])
        setLoading(false)
      })
  }, [id])

  return (
    <div className="px-4 pt-5 space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <p className="section-label mb-0">訪問履歴</p>
        <Link href={`/customers/${id}/visits/new`} className="btn-primary text-sm px-3 py-2">
          ＋ 記録
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--color-primary)' }} />
        </div>
      ) : visits.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>訪問履歴がありません</p>
          <Link href={`/customers/${id}/visits/new`} className="btn-primary text-sm px-5 py-2.5">
            ＋ 最初の訪問を記録
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {visits.map(v => (
            <Link key={v.id} href={`/customers/${id}/visits/${v.id}`}>
              <div className="card flex items-center justify-between gap-3 active:opacity-70 py-3">
                <div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
                    {format(new Date(v.visit_date), 'yyyy年M月d日（E）', { locale: ja })}
                  </p>
                  {v.start_time && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                      {v.start_time.slice(0, 5)}{v.end_time ? ` ～ ${v.end_time.slice(0, 5)}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {v.report_sent && (
                    <span className="badge" style={{ background: '#dcfce7', color: '#166534' }}>送信済み</span>
                  )}
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                    style={{ color: 'var(--color-text-muted)' }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="bottom-nav-spacer" />
    </div>
  )
}
