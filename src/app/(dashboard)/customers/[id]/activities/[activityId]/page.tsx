'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { CustomerActivity } from '@/types/database'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

const TYPE_LABEL: Record<string, string> = {
  material: '資料提供',
  municipal: '自治体連携',
  other: 'その他',
}
const TYPE_COLOR: Record<string, { bg: string; color: string }> = {
  material:  { bg: '#dbeafe', color: '#1e40af' },
  municipal: { bg: '#dcfce7', color: '#166534' },
  other:     { bg: '#f3f4f6', color: '#374151' },
}

const TYPE_OPTIONS = [
  { value: 'material', label: '資料提供' },
  { value: 'municipal', label: '自治体連携' },
  { value: 'other', label: 'その他' },
] as const
type ActivityType = typeof TYPE_OPTIONS[number]['value']

export default function ActivityDetailPage() {
  const { id, activityId } = useParams<{ id: string; activityId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [activity, setActivity] = useState<CustomerActivity | null>(null)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')

  const [type, setType] = useState<ActivityType>('material')
  const [date, setDate] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [staffName, setStaffName] = useState('')
  const [municipalityName, setMunicipalityName] = useState('')
  const [contactPerson, setContactPerson] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('customer_activities')
        .select('*')
        .eq('id', activityId)
        .single()
      setActivity(data)
      if (data) {
        setType(data.type as ActivityType)
        setDate(data.activity_date)
        setTitle(data.title)
        setBody(data.body ?? '')
        setStaffName(data.staff_name ?? '')
        setMunicipalityName(data.municipality_name ?? '')
        setContactPerson(data.contact_person ?? '')
      }
      setLoading(false)
    }
    load()
  }, [activityId])

  async function handleSave() {
    if (!title.trim() || !date) return
    setSaving(true)
    setError('')
    const { data, error: updateError } = await supabase
      .from('customer_activities')
      .update({
        type,
        activity_date: date,
        title: title.trim(),
        body: body.trim() || null,
        staff_name: staffName.trim() || null,
        municipality_name: type === 'municipal' ? (municipalityName.trim() || null) : null,
        contact_person: type === 'municipal' ? (contactPerson.trim() || null) : null,
      })
      .eq('id', activityId)
      .select()
      .single()
    setSaving(false)
    if (updateError) { setError(`保存に失敗しました: ${updateError.message}`); return }
    setActivity(data)
    setEditing(false)
  }

  async function handleDelete() {
    setDeleting(true)
    await supabase.from('customer_activities').delete().eq('id', activityId)
    router.push(`/customers/${id}/activities`)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--color-primary)' }} />
      </div>
    )
  }
  if (!activity) return null

  const colors = TYPE_COLOR[activity.type] ?? TYPE_COLOR.other

  if (editing) {
    return (
      <div className="px-4 pt-6 pb-32 space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setEditing(false)} className="p-2 -ml-2">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
              style={{ color: 'var(--color-text)' }}>
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className="page-title flex-1">対応記録を編集</h1>
        </div>

        {error && (
          <p className="text-sm px-3 py-2 rounded-xl" style={{ background: '#fee2e2', color: '#991b1b' }}>{error}</p>
        )}

        <div className="card space-y-3">
          <p className="section-label">種別</p>
          <div className="flex gap-2">
            {TYPE_OPTIONS.map(opt => (
              <button key={opt.value} type="button" onClick={() => setType(opt.value)}
                className="text-sm py-1.5 px-3 rounded-full transition-colors"
                style={type === opt.value
                  ? { background: 'var(--color-primary)', color: '#fff', border: '1.5px solid var(--color-primary)' }
                  : { background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', color: 'var(--color-text)' }
                }>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card space-y-4">
          <p className="section-label">基本情報</p>
          <div className="space-y-1.5">
            <label className="form-label">日付 <span className="required">*</span></label>
            <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="form-label">タイトル <span className="required">*</span></label>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="form-label">詳細・メモ</label>
            <textarea className="input" style={{ minHeight: 80, resize: 'none' }} value={body}
              onChange={e => setBody(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <label className="form-label">担当者名</label>
            <input className="input" value={staffName} onChange={e => setStaffName(e.target.value)} />
          </div>
        </div>

        {type === 'municipal' && (
          <div className="card space-y-4">
            <p className="section-label">自治体・機関情報</p>
            <div className="space-y-1.5">
              <label className="form-label">機関名</label>
              <input className="input" value={municipalityName} onChange={e => setMunicipalityName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="form-label">連絡先担当者名</label>
              <input className="input" value={contactPerson} onChange={e => setContactPerson(e.target.value)} />
            </div>
          </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 px-4 py-4 border-t"
          style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
          <button onClick={handleSave} disabled={saving} className="btn-primary w-full py-3 disabled:opacity-40">
            {saving ? '保存中...' : '保存する'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pt-6 space-y-4 pb-24">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push(`/customers/${id}/activities`)} className="p-2 -ml-2">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
            style={{ color: 'var(--color-text)' }}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="page-title flex-1">対応記録</h1>
        <button onClick={() => setEditing(true)} className="btn-secondary text-sm px-3 py-2">編集</button>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <span className="badge text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: colors.bg, color: colors.color }}>
            {TYPE_LABEL[activity.type]}
          </span>
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {format(new Date(activity.activity_date), 'yyyy年M月d日（E）', { locale: ja })}
          </span>
        </div>

        <h2 className="font-bold text-base" style={{ color: 'var(--color-text)' }}>{activity.title}</h2>

        {activity.body && (
          <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>{activity.body}</p>
        )}

        {activity.staff_name && (
          <div className="flex justify-between items-center pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>担当者</span>
            <span className="text-sm" style={{ color: 'var(--color-text)' }}>{activity.staff_name}</span>
          </div>
        )}

        {activity.type === 'municipal' && (activity.municipality_name || activity.contact_person) && (
          <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
            <p className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>自治体・機関情報</p>
            {activity.municipality_name && (
              <div className="flex justify-between">
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>機関名</span>
                <span className="text-sm" style={{ color: 'var(--color-text)' }}>{activity.municipality_name}</span>
              </div>
            )}
            {activity.contact_person && (
              <div className="flex justify-between">
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>担当者</span>
                <span className="text-sm" style={{ color: 'var(--color-text)' }}>{activity.contact_person}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="pt-2">
        {confirmDelete ? (
          <div className="card space-y-3">
            <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>この記録を削除しますか？</p>
            <div className="flex gap-2">
              <button onClick={handleDelete} disabled={deleting}
                className="btn-primary text-sm py-2 px-4 disabled:opacity-40"
                style={{ background: '#ef4444' }}>
                {deleting ? '削除中...' : '削除する'}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="btn-secondary text-sm py-2 px-4">
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)}
            className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            この記録を削除
          </button>
        )}
      </div>

      <div className="bottom-nav-spacer" />
    </div>
  )
}
