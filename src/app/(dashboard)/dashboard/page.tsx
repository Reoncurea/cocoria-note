'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { CocoriaLogo } from '@/components/CocoriaLogo'

interface DashboardData {
  todayVisits: { id: string; customer_id: string; start_time: string | null; customers: { name_kanji: string } | null }[]
  unsentReports: { id: string; customer_id: string; visit_date: string; customers: { name_kanji: string } | null }[]
  unpaidBilling: { customer_id: string; customers: { name_kanji: string } | null }[]
  userEmail: string
}

const MESSAGES = [
  'あなたのケアが、誰かの笑顔を作っています',
  '今日も丁寧に、一歩ずつ',
  'あなたの存在が、家族の安心につながっています',
  '小さな気づきが、大きな支えになる',
  '今日の頑張りは、必ず誰かの力になっています',
  'ケアする心を、今日も大切に',
  'あなたが関わるすべての家族に、温かさを',
  '一つひとつの訪問が、かけがえない時間です',
  '今日もお疲れ様。あなたの仕事に意味があります',
  'やさしさを届けるプロとして、今日も輝いて',
]

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [message] = useState(() => MESSAGES[Math.floor(Math.random() * MESSAGES.length)])
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().split('T')[0]
      const { data: { user } } = await supabase.auth.getUser()

      const [visitRes, unsentRes, unpaidRes] = await Promise.all([
        supabase
          .from('visits')
          .select('id, customer_id, start_time, customers(name_kanji)')
          .eq('visit_date', today)
          .eq('user_id', user?.id ?? '')
          .order('start_time'),
        supabase
          .from('visits')
          .select('id, customer_id, visit_date, customers(name_kanji)')
          .eq('report_sent', false)
          .eq('user_id', user?.id ?? '')
          .order('visit_date', { ascending: false })
          .limit(10),
        supabase
          .from('billing')
          .select('customer_id, customers(name_kanji)')
          .eq('user_id', user?.id ?? '')
          .eq('invoiced', true)
          .eq('paid', false),
      ])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const normalizeCustomer = (c: any) => Array.isArray(c) ? (c[0] ?? null) : (c ?? null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const normVisits = (visitRes.data ?? []).map((v: any) => ({ ...v, customers: normalizeCustomer(v.customers) }))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const normUnsent = (unsentRes.data ?? []).map((v: any) => ({ ...v, customers: normalizeCustomer(v.customers) }))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const normUnpaid = (unpaidRes.data ?? []).map((v: any) => ({ ...v, customers: normalizeCustomer(v.customers) }))

      setData({
        todayVisits: normVisits as DashboardData['todayVisits'],
        unsentReports: normUnsent as DashboardData['unsentReports'],
        unpaidBilling: normUnpaid as DashboardData['unpaidBilling'],
        userEmail: user?.email ?? '',
      })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--color-primary)' }} />
      </div>
    )
  }

  const today = format(new Date(), 'M月d日（E）', { locale: ja })

  return (
    <div className="px-4 pt-6 space-y-5">
      {/* あいさつ */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <CocoriaLogo size={44} />
          </div>
          <h1 className="text-base font-bold leading-snug" style={{ color: 'var(--color-text)' }}>
            {message}
          </h1>
        </div>
        <p className="text-sm mt-1.5 ml-1" style={{ color: 'var(--color-text-muted)' }}>
          {today} · {data?.userEmail}
        </p>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard icon="📅" label="今日の訪問" count={data?.todayVisits.length ?? 0} />
        <SummaryCard icon="💌" label="未送信報告書" count={data?.unsentReports.length ?? 0} warn />
        <SummaryCard icon="💰" label="未入金" count={data?.unpaidBilling.length ?? 0} warn />
      </div>

      {/* 今日の訪問 */}
      <Section title="📅 今日の訪問" empty={data?.todayVisits.length === 0} emptyText="今日の訪問はありません">
        {data?.todayVisits.map(v => (
          <Link key={v.id} href={`/customers/${v.customer_id}`}>
            <ListItem
              name={v.customers?.name_kanji ?? '不明'}
              sub={v.start_time ? `${v.start_time.slice(0, 5)} 〜` : undefined}
            />
          </Link>
        ))}
      </Section>

      {/* 未送信報告書 */}
      {(data?.unsentReports.length ?? 0) > 0 && (
        <Section title="💌 未送信の報告書">
          {data?.unsentReports.map(v => (
            <Link key={v.id} href={`/customers/${v.customer_id}/visits/${v.id}`}>
              <ListItem
                name={v.customers?.name_kanji ?? '不明'}
                sub={format(new Date(v.visit_date), 'M月d日', { locale: ja })}
                badge="要送信"
              />
            </Link>
          ))}
        </Section>
      )}

      {/* 未入金 */}
      {(data?.unpaidBilling.length ?? 0) > 0 && (
        <Section title="💰 未入金の顧客">
          {data?.unpaidBilling.map(b => (
            <Link key={b.customer_id} href={`/customers/${b.customer_id}`}>
              <ListItem name={b.customers?.name_kanji ?? '不明'} badge="未入金" />
            </Link>
          ))}
        </Section>
      )}

      <div className="bottom-nav-spacer" />
    </div>
  )
}

function SummaryCard({ icon, label, count, warn }: { icon: string; label: string; count: number; warn?: boolean }) {
  return (
    <div className="card text-center py-4">
      <div className="text-xl mb-1">{icon}</div>
      <div className="text-2xl font-bold" style={{ color: warn && count > 0 ? 'var(--color-primary-dark)' : 'var(--color-text)' }}>
        {count}
      </div>
      <div className="text-xs mt-0.5 leading-tight" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
    </div>
  )
}

function Section({ title, children, empty, emptyText }: {
  title: string; children?: React.ReactNode; empty?: boolean; emptyText?: string
}) {
  return (
    <div className="card space-y-2">
      <p className="section-label">{title}</p>
      {empty ? (
        <p className="text-sm py-2 text-center" style={{ color: 'var(--color-text-muted)' }}>{emptyText}</p>
      ) : children}
    </div>
  )
}

function ListItem({ name, sub, badge }: { name: string; sub?: string; badge?: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl active:opacity-70 transition-opacity"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <div>
        <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{name}</p>
        {sub && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{sub}</p>}
      </div>
      <div className="flex items-center gap-2">
        {badge && <span className="badge badge-contracted text-xs">{badge}</span>}
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
          style={{ color: 'var(--color-text-muted)' }}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </div>
  )
}
