'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Customer } from '@/types/database'
import Link from 'next/link'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

const STATUS_LABELS: Record<string, string> = {
  '活動中': 'active',
  '契約済み': 'contracted',
  '終了': 'ended',
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filtered, setFiltered] = useState<Customer[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })
      setCustomers(data ?? [])
      setFiltered(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    const q = query.trim().toLowerCase()
    if (!q) { setFiltered(customers); return }
    setFiltered(customers.filter(c =>
      c.name_kanji.toLowerCase().includes(q) ||
      c.name_kana.toLowerCase().includes(q)
    ))
  }, [query, customers])

  return (
    <div className="px-4 pt-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title">顧客一覧</h1>
        <Link href="/customers/new" className="btn-primary text-sm px-4 py-2">
          ＋ 登録
        </Link>
      </div>

      {/* 検索バー */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-muted)' }}
          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="search"
          className="input pl-9"
          placeholder="名前で検索..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      {/* リスト */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--color-primary)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--color-text-muted)' }}>
          {query ? '検索結果がありません' : (
            <div>
              <div className="text-4xl mb-3">🌸</div>
              <p className="font-medium">まだ顧客が登録されていません</p>
              <p className="text-sm mt-1">「＋ 登録」ボタンから追加してください</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <Link key={c.id} href={`/customers/${c.id}`}>
              <div className="card flex items-center gap-3 active:opacity-80 transition-opacity">
                {/* アバター */}
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg font-bold"
                  style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)' }}>
                  {c.name_kanji[0]}
                </div>
                {/* 情報 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                      {c.name_kanji}
                    </span>
                    <span className={`badge badge-${STATUS_LABELS[c.status] ?? 'active'}`}>
                      {c.status}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {c.name_kana}
                    {c.inquiry_date && (
                      <> · 問い合わせ: {format(new Date(c.inquiry_date), 'M月d日', { locale: ja })}</>
                    )}
                  </p>
                </div>
                {/* 矢印 */}
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                  style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="bottom-nav-spacer" />
    </div>
  )
}
