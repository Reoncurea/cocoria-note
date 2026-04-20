'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Visit, ServiceRecord, BreathCheck, BreathCheckCell } from '@/types/database'
import Link from 'next/link'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

export default function VisitDetailPage() {
  const { id, visitId } = useParams<{ id: string; visitId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [visit, setVisit] = useState<Visit | null>(null)
  const [serviceRecords, setServiceRecords] = useState<ServiceRecord[]>([])
  const [breathCheck, setBreathCheck] = useState<BreathCheck | null>(null)
  const [breathCells, setBreathCells] = useState<BreathCheckCell[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [addingHour, setAddingHour] = useState('')

  useEffect(() => {
    load()
  }, [visitId])

  async function load() {
    const [vRes, srRes, bcRes, vtRes] = await Promise.all([
      supabase.from('visits').select('*').eq('id', visitId).single(),
      supabase.from('service_records').select('*').eq('visit_id', visitId).order('sort_order'),
      supabase.from('breath_checks').select('*').eq('visit_id', visitId).single(),
      supabase.from('visit_tags').select('tag_id, support_tags(name)').eq('visit_id', visitId),
    ])
    setVisit(vRes.data)
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
    setLoading(false)
  }

  async function toggleCell(hourLabel: string, minute: number) {
    if (!breathCheck) return
    const existing = breathCells.find(c => c.hour_label === hourLabel && c.minute_value === minute)

    if (existing) {
      await supabase.from('breath_check_cells').update({ checked: !existing.checked }).eq('id', existing.id)
      setBreathCells(prev => prev.map(c => c.id === existing.id ? { ...c, checked: !c.checked } : c))
    } else {
      const { data } = await supabase.from('breath_check_cells').insert({
        breath_check_id: breathCheck.id,
        hour_label: hourLabel,
        minute_value: minute,
        checked: true,
      }).select().single()
      if (data) setBreathCells(prev => [...prev, data])
    }
  }

  function getHours(): string[] {
    const hours = new Set(breathCells.map(c => c.hour_label))
    const sorted = Array.from(hours).sort()
    return sorted
  }

  async function addHour() {
    const h = addingHour.trim()
    if (!h || !breathCheck) return
    const label = h.includes('時') ? h : `${h}時`
    if (getHours().includes(label)) { setAddingHour(''); return }

    const inserts = MINUTES.map(m => ({
      breath_check_id: breathCheck.id,
      hour_label: label,
      minute_value: m,
      checked: false,
    }))
    const { data } = await supabase.from('breath_check_cells').insert(inserts).select()
    if (data) setBreathCells(prev => [...prev, ...data])
    setAddingHour('')
  }

  async function updateBreathMemo(memo: string) {
    if (!breathCheck) return
    await supabase.from('breath_checks').update({ memo }).eq('id', breathCheck.id)
    setBreathCheck(prev => prev ? { ...prev, memo } : prev)
  }

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--color-primary)' }} />
    </div>
  }

  if (!visit) return <div className="text-center py-20" style={{ color: 'var(--color-text-muted)' }}>記録が見つかりません</div>

  const hours = getHours()

  return (
    <div className="px-4 pt-6 space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 -ml-2">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ color: 'var(--color-text)' }}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="page-title">
            {format(new Date(visit.visit_date), 'M月d日（E）', { locale: ja })}
          </h1>
          {visit.start_time && (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {visit.start_time.slice(0, 5)}{visit.end_time ? ` ～ ${visit.end_time.slice(0, 5)}` : ''}
            </p>
          )}
        </div>
        <Link href={`/customers/${id}/visits/${visitId}/edit`} className="btn-secondary text-sm px-3 py-2">
          編集
        </Link>
        <Link href={`/customers/${id}/visits/${visitId}/report`} className="btn-primary text-sm px-3 py-2">
          報告書
        </Link>
      </div>

      {/* 呼吸チェック表 */}
      <div className="card space-y-4">
        <p className="section-label">呼吸チェック表</p>

        {hours.length === 0 ? (
          <p className="text-sm text-center py-2" style={{ color: 'var(--color-text-muted)' }}>
            時間帯を追加してください
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left py-1 px-2" style={{ color: 'var(--color-text-muted)', minWidth: '48px' }}>時間</th>
                  {MINUTES.map(m => (
                    <th key={m} className="py-1 px-1 text-center" style={{ color: 'var(--color-text-muted)', minWidth: '28px' }}>
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hours.map(hour => (
                  <tr key={hour}>
                    <td className="py-1 px-2 font-semibold text-xs" style={{ color: 'var(--color-text)' }}>{hour}</td>
                    {MINUTES.map(m => {
                      const cell = breathCells.find(c => c.hour_label === hour && c.minute_value === m)
                      const checked = cell?.checked ?? false
                      return (
                        <td key={m} className="py-1 px-1 text-center">
                          <button
                            type="button"
                            onClick={() => toggleCell(hour, m)}
                            className="w-6 h-6 rounded transition-colors"
                            style={{
                              background: checked ? '#86efac' : 'var(--color-surface)',
                              border: `1px solid ${checked ? '#4ade80' : 'var(--color-border)'}`,
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
        )}

        {/* 時間帯追加 */}
        <div className="flex gap-2">
          <input
            className="input flex-1 text-sm"
            placeholder="例：10（時）"
            value={addingHour}
            onChange={e => setAddingHour(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addHour())}
          />
          <button type="button" onClick={addHour} className="btn-secondary text-sm px-3 flex-shrink-0">
            ＋ 時間帯
          </button>
        </div>

        {/* メモ */}
        <div>
          <label className="form-label">メモ（特記事項）</label>
          <textarea
            className="input"
            rows={2}
            defaultValue={breathCheck?.memo ?? ''}
            onBlur={e => updateBreathMemo(e.target.value)}
            placeholder="特記事項..."
          />
        </div>
      </div>

      {/* サポート内容 */}
      {tags.length > 0 && (
        <div className="card space-y-2">
          <p className="section-label">サポート内容</p>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => <span key={tag} className="tag-chip">{tag}</span>)}
          </div>
        </div>
      )}

      {/* 作業記録 */}
      {serviceRecords.length > 0 && (
        <div className="card space-y-3">
          <p className="section-label">時間ごとの作業記録</p>
          <div className="space-y-2">
            {serviceRecords.map(r => (
              <div key={r.id} className="grid grid-cols-3 gap-2 text-sm py-2"
                style={{ borderBottom: '1px solid var(--color-border)' }}>
                <span className="font-semibold" style={{ color: 'var(--color-primary-dark)' }}>{r.time_label}</span>
                <span style={{ color: 'var(--color-text)' }}>{r.content}</span>
                <span style={{ color: 'var(--color-text-muted)' }}>{r.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* メッセージ */}
      {(visit.staff_message || visit.customer_message) && (
        <div className="card space-y-3">
          <p className="section-label">メッセージ</p>
          {visit.staff_message && (
            <div>
              <p className="form-label">担当者から</p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>{visit.staff_message}</p>
            </div>
          )}
          {visit.customer_message && (
            <div>
              <p className="form-label">ご依頼主から</p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>{visit.customer_message}</p>
            </div>
          )}
        </div>
      )}

      {/* 非公開メモ */}
      {(visit.customer_notes || visit.next_visit_notes) && (
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <p className="section-label mb-0">非公開メモ</p>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#f3f4f6', color: '#6b7280' }}>非公開</span>
          </div>
          {visit.customer_notes && (
            <div>
              <p className="form-label">顧客の様子</p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>{visit.customer_notes}</p>
            </div>
          )}
          {visit.next_visit_notes && (
            <div>
              <p className="form-label">次回の予定・申し引き事項</p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>{visit.next_visit_notes}</p>
            </div>
          )}
        </div>
      )}

      <div className="bottom-nav-spacer" />
    </div>
  )
}
