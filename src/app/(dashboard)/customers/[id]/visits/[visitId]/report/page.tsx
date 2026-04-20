'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Visit, Customer, ServiceRecord, BreathCheck, BreathCheckCell } from '@/types/database'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

export default function ReportPage() {
  const { id, visitId } = useParams<{ id: string; visitId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [visit, setVisit] = useState<Visit | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [serviceRecords, setServiceRecords] = useState<ServiceRecord[]>([])
  const [breathCheck, setBreathCheck] = useState<BreathCheck | null>(null)
  const [breathCells, setBreathCells] = useState<BreathCheckCell[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    async function load() {
      const [vRes, cRes, srRes, bcRes, vtRes] = await Promise.all([
        supabase.from('visits').select('*').eq('id', visitId).single(),
        supabase.from('customers').select('*').eq('id', id).single(),
        supabase.from('service_records').select('*').eq('visit_id', visitId).order('sort_order'),
        supabase.from('breath_checks').select('*').eq('visit_id', visitId).single(),
        supabase.from('visit_tags').select('tag_id, support_tags(name)').eq('visit_id', visitId),
      ])
      setVisit(vRes.data)
      setCustomer(cRes.data)
      setServiceRecords(srRes.data ?? [])
      setBreathCheck(bcRes.data)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setTags((vtRes.data ?? []).map((vt: any) => {
        const st = vt.support_tags
        if (Array.isArray(st)) return st[0]?.name ?? ''
        return st?.name ?? ''
      }).filter(Boolean))

      if (bcRes.data) {
        const { data: cells } = await supabase
          .from('breath_check_cells')
          .select('*')
          .eq('breath_check_id', bcRes.data.id)
        setBreathCells(cells ?? [])
      }
      if (vRes.data?.report_sent) setSent(true)

      const name = cRes.data?.name_kanji ?? ''
      const date = vRes.data?.visit_date?.replace(/-/g, '') ?? new Date().toISOString().slice(0, 10).replace(/-/g, '')
      document.title = `${name}_報告書_${date}`

      setLoading(false)
    }
    load()
    return () => { document.title = 'cocorianote' }
  }, [visitId])

  async function handlePrint() {
    window.print()
  }

  async function markAsSent() {
    setSending(true)
    await supabase.from('visits').update({ report_sent: true, report_sent_at: new Date().toISOString() }).eq('id', visitId)
    setSent(true)
    setSending(false)
  }

  const hours = Array.from(new Set(breathCells.map(c => c.hour_label))).sort()

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--color-primary)' }} />
    </div>
  }

  if (!visit || !customer) return null

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      {/* 操作バー（印刷時は非表示） */}
      <div className="print:hidden px-4 py-4 flex items-center gap-3 sticky top-0 z-10"
        style={{ background: 'white', borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => router.back()} className="p-2 -ml-2">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ color: 'var(--color-text)' }}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="flex-1 font-bold" style={{ color: 'var(--color-text)' }}>報告書プレビュー</span>

        <div className="flex gap-2">
          <button onClick={handlePrint} className="btn-secondary text-sm px-3 py-2">
            🖨️ 印刷
          </button>
          {!sent ? (
            <button onClick={markAsSent} disabled={sending} className="btn-primary text-sm px-3 py-2 disabled:opacity-60">
              {sending ? '処理中...' : '✓ 送信済みにする'}
            </button>
          ) : (
            <span className="badge badge-active px-3 py-2">送信済み</span>
          )}
        </div>
      </div>

      {/* 送信方法の案内（v1は手動） */}
      {!sent && (
        <div className="print:hidden mx-4 mt-4 p-3 rounded-xl text-sm"
          style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)' }}>
          💡 印刷後、メールまたはLINEで顧客に送付してください。送付後は「送信済みにする」ボタンを押してください。
        </div>
      )}

      {/* 報告書本体（印刷対象） */}
      <div className="mx-4 my-4 space-y-4 print:mx-0 print:my-0">

        {/* === 1ページ目：報告書 === */}
        <div className="card print:shadow-none print:border-none">
          {/* タイトル */}
          <div className="text-center mb-6 print:mb-8">
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
              サービス報告書
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
              {format(new Date(visit.visit_date), 'yyyy年M月d日（E）', { locale: ja })}
            </p>
          </div>

          {/* 基本情報 */}
          <table className="w-full text-sm mb-6" style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <ReportRow label="お名前" value={`${customer.name_kanji} 様`} />
              <ReportRow label="訪問日時"
                value={`${format(new Date(visit.visit_date), 'yyyy年M月d日', { locale: ja })} ${visit.start_time?.slice(0, 5) ?? ''}${visit.end_time ? ` ～ ${visit.end_time.slice(0, 5)}` : ''}`} />
              {visit.transport && <ReportRow label="訪問手段" value={visit.transport} />}
              {visit.has_break && visit.break_start && (
                <ReportRow label="休憩"
                  value={`${visit.break_start.slice(0, 5)} ～ ${visit.break_end?.slice(0, 5) ?? ''}`} />
              )}
            </tbody>
          </table>

          {/* サポート内容 */}
          {tags.length > 0 && (
            <div className="mb-5">
              <h3 className="font-bold text-sm mb-2" style={{ color: 'var(--color-text)' }}>サポート内容</h3>
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => <span key={tag} className="tag-chip">{tag}</span>)}
              </div>
            </div>
          )}

          {/* 時間ごとの作業記録 */}
          {serviceRecords.length > 0 && (
            <div className="mb-5">
              <h3 className="font-bold text-sm mb-2" style={{ color: 'var(--color-text)' }}>作業記録</h3>
              <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--color-primary-light)' }}>
                    <th className="text-left p-2 text-xs" style={{ color: 'var(--color-primary-dark)', width: '20%' }}>時間</th>
                    <th className="text-left p-2 text-xs" style={{ color: 'var(--color-primary-dark)', width: '35%' }}>内容</th>
                    <th className="text-left p-2 text-xs" style={{ color: 'var(--color-primary-dark)', width: '45%' }}>詳細</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceRecords.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td className="p-2" style={{ color: 'var(--color-text)' }}>{r.time_label}</td>
                      <td className="p-2" style={{ color: 'var(--color-text)' }}>{r.content}</td>
                      <td className="p-2" style={{ color: 'var(--color-text-muted)' }}>{r.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 担当者からのメッセージ */}
          {visit.staff_message && (
            <div className="mb-4 p-3 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <p className="text-xs font-bold mb-1" style={{ color: 'var(--color-text-muted)' }}>担当者からのメッセージ</p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>{visit.staff_message}</p>
            </div>
          )}

          {/* ご依頼主からのメッセージ */}
          {visit.customer_message && (
            <div className="p-3 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <p className="text-xs font-bold mb-1" style={{ color: 'var(--color-text-muted)' }}>ご依頼主からのメッセージ</p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>{visit.customer_message}</p>
            </div>
          )}
        </div>

        {/* === 2ページ目：呼吸チェック表 === */}
        {breathCheck && hours.length > 0 && (
          <div className="card print:shadow-none print:border-none" style={{ pageBreakBefore: 'always', breakBefore: 'page' }}>
            <div className="text-center mb-4">
              <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>呼吸チェック表</h2>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {format(new Date(visit.visit_date), 'yyyy年M月d日', { locale: ja })} · {customer.name_kanji} 様
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--color-primary-light)' }}>
                    <th className="p-2 text-left" style={{ color: 'var(--color-primary-dark)', minWidth: '48px' }}>時間</th>
                    {MINUTES.map(m => (
                      <th key={m} className="p-2 text-center" style={{ color: 'var(--color-primary-dark)', minWidth: '28px' }}>
                        {m === 0 ? '00' : m}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hours.map(hour => (
                    <tr key={hour} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td className="p-2 font-semibold" style={{ color: 'var(--color-text)' }}>{hour}</td>
                      {MINUTES.map(m => {
                        const cell = breathCells.find(c => c.hour_label === hour && c.minute_value === m)
                        return (
                          <td key={m} className="p-1 text-center">
                            <div className="w-5 h-5 rounded mx-auto"
                              style={{
                                background: cell?.checked ? '#86efac' : 'var(--color-surface)',
                                border: `1px solid ${cell?.checked ? '#4ade80' : 'var(--color-border)'}`,
                              }}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {breathCheck.memo && (
              <div className="mt-4 p-3 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <p className="text-xs font-bold mb-1" style={{ color: 'var(--color-text-muted)' }}>特記事項</p>
                <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>{breathCheck.memo}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="print:hidden bottom-nav-spacer" />
    </div>
  )
}

function ReportRow({ label, value }: { label: string; value: string }) {
  return (
    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
      <td className="py-2 pr-4 font-semibold text-xs w-24" style={{ color: 'var(--color-text-muted)' }}>{label}</td>
      <td className="py-2" style={{ color: 'var(--color-text)' }}>{value}</td>
    </tr>
  )
}
