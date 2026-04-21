'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { CustomerActivity } from '@/types/database'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

const TYPE_COLOR: Record<string, { bg: string; color: string; label: string }> = {
  material:  { bg: '#dbeafe', color: '#1e40af', label: '資料提供' },
  municipal: { bg: '#dcfce7', color: '#166534', label: '自治体連携' },
  other:     { bg: '#f3f4f6', color: '#374151', label: 'その他' },
}

export default function ActivitiesPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()
  const [activities, setActivities] = useState<CustomerActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchActivities = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    const { data } = await supabase
      .from('customer_activities')
      .select('*')
      .eq('customer_id', id)
      .order('activity_date', { ascending: false })
    setActivities(data ?? [])
    setLoading(false)
    setRefreshing(false)
  }, [id])

  useEffect(() => { fetchActivities() }, [fetchActivities])

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--color-primary)' }} />
      </div>
    )
  }

  return (
    <div className="px-4 pt-5 space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="section-label mb-0">対応記録</p>
          <button
            onClick={() => fetchActivities(true)}
            disabled={refreshing}
            className="p-1 rounded-full disabled:opacity-40"
            title="更新"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
              style={{ color: 'var(--color-text-muted)' }}
              className={refreshing ? 'animate-spin' : ''}>
              <path d="M3 12a9 9 0 1 1 2.636 6.364" />
              <polyline points="3 18 3 12 9 12" />
            </svg>
          </button>
        </div>
        <Link href={`/customers/${id}/activities/new`} className="btn-primary text-sm px-3 py-2">
          ＋ 記録
        </Link>
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>対応記録がありません</p>
          <Link href={`/customers/${id}/activities/new`} className="btn-primary text-sm px-5 py-2.5">
            ＋ 最初の記録を追加
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {activities.map(a => {
            const c = TYPE_COLOR[a.type] ?? TYPE_COLOR.other
            return (
              <Link key={a.id} href={`/customers/${id}/activities/${a.id}`}>
                <div className="card flex items-center justify-between gap-3 active:opacity-70 py-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="badge flex-shrink-0 mt-0.5 text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: c.bg, color: c.color }}>
                      {c.label}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--color-text)' }}>
                        {a.title}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        {format(new Date(a.activity_date), 'yyyy年M月d日（E）', { locale: ja })}
                        {a.staff_name ? `　${a.staff_name}` : ''}
                      </p>
                      {a.type === 'municipal' && (a.municipality_name || a.contact_person) && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                          {[a.municipality_name, a.contact_person].filter(Boolean).join('　')}
                        </p>
                      )}
                    </div>
                  </div>
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                    className="flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <div className="bottom-nav-spacer" />
    </div>
  )
}
