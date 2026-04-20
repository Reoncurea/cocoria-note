'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const TYPE_OPTIONS = [
  { value: 'material', label: '資料提供' },
  { value: 'municipal', label: '自治体連携' },
  { value: 'other', label: 'その他' },
] as const

type ActivityType = typeof TYPE_OPTIONS[number]['value']

export default function ActivityNewPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const today = new Date().toISOString().slice(0, 10)
  const [type, setType] = useState<ActivityType>('material')
  const [date, setDate] = useState(today)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [staffName, setStaffName] = useState('')
  const [municipalityName, setMunicipalityName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function changeType(newType: ActivityType) {
    setType(newType)
    setTitle('')
    setBody('')
    setStaffName('')
    setMunicipalityName('')
    setContactPerson('')
  }

  async function handleSave() {
    if (!title.trim() || !date) { setError('日付とタイトルは必須です'); return }
    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('ログインが必要です'); setSaving(false); return }

    const { error: insertError } = await supabase.from('customer_activities').insert({
      customer_id: id,
      user_id: user.id,
      type,
      activity_date: date,
      title: title.trim(),
      body: body.trim() || null,
      staff_name: staffName.trim() || null,
      municipality_name: type === 'municipal' ? (municipalityName.trim() || null) : null,
      contact_person: type === 'municipal' ? (contactPerson.trim() || null) : null,
    })

    if (insertError) {
      setError(`保存に失敗しました: ${insertError.message}`)
      setSaving(false)
      return
    }

    router.push(`/customers/${id}/activities`)
  }

  return (
    <div className="px-4 pt-6 pb-32 space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 -ml-2">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
            style={{ color: 'var(--color-text)' }}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="page-title flex-1">対応記録を追加</h1>
      </div>

      {/* 種別 */}
      <div className="card space-y-3">
        <p className="section-label">種別</p>
        <div className="flex gap-2">
          {TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => changeType(opt.value)}
              className="text-sm py-1.5 px-3 rounded-full transition-colors"
              style={
                type === opt.value
                  ? { background: 'var(--color-primary)', color: '#fff', border: '1.5px solid var(--color-primary)' }
                  : { background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', color: 'var(--color-text)' }
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 基本情報 */}
      <div className="card space-y-4">
        <p className="section-label">基本情報</p>

        <div className="space-y-1.5">
          <label className="form-label">日付 <span className="required">*</span></label>
          <input
            className="input"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label className="form-label">
            {type === 'material' ? '資料名・対応内容' : type === 'municipal' ? '対応内容' : 'タイトル'}
            <span className="required"> *</span>
          </label>
          <input
            className="input"
            placeholder={
              type === 'material' ? '例：産後うつ自己チェックシート提供' :
              type === 'municipal' ? '例：産後うつ傾向のご連絡' :
              '例：LINE でフォロー連絡'
            }
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label className="form-label">詳細・メモ</label>
          <textarea
            className="input"
            style={{ minHeight: 80, resize: 'none' }}
            placeholder="詳細を入力"
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={3}
          />
        </div>

        <div className="space-y-1.5">
          <label className="form-label">担当者名</label>
          <input
            className="input"
            placeholder="例：山田"
            value={staffName}
            onChange={e => setStaffName(e.target.value)}
          />
        </div>
      </div>

      {/* 自治体連携 追加フィールド */}
      {type === 'municipal' && (
        <div className="card space-y-4">
          <p className="section-label">自治体・機関情報</p>
          <div className="space-y-1.5">
            <label className="form-label">機関名</label>
            <input
              className="input"
              placeholder="例：〇〇市健康福祉課"
              value={municipalityName}
              onChange={e => setMunicipalityName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="form-label">連絡先担当者名</label>
            <input
              className="input"
              placeholder="例：田中 様"
              value={contactPerson}
              onChange={e => setContactPerson(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* 固定フッター */}
      <div className="fixed bottom-20 left-0 right-0 px-4 py-4 border-t space-y-2"
        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
        {error && (
          <p className="text-sm px-3 py-2 rounded-xl text-center" style={{ background: '#fee2e2', color: '#991b1b' }}>{error}</p>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary w-full py-3 disabled:opacity-40"
        >
          {saving ? '保存中...' : '保存する'}
        </button>
      </div>
    </div>
  )
}
