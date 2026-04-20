'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useForm } from 'react-hook-form'

interface FormValues {
  visit_date: string
  start_time: string
  end_time: string
  transport: string
  has_break: boolean
  break_start: string
  break_end: string
  staff_message: string
  customer_message: string
  customer_notes: string
  next_visit_notes: string
}

export default function VisitEditPage() {
  const { id, visitId } = useParams<{ id: string; visitId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, watch, setValue, reset } = useForm<FormValues>({
    defaultValues: { has_break: false },
  })
  const hasBreak = watch('has_break')

  function setNow(field: 'start_time' | 'end_time' | 'break_start' | 'break_end') {
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    setValue(field, `${hh}:${mm}`)
  }

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('visits').select('*').eq('id', visitId).single()
      if (!data) { router.push(`/customers/${id}`); return }
      reset({
        visit_date: data.visit_date ?? '',
        start_time: data.start_time?.slice(0, 5) ?? '',
        end_time: data.end_time?.slice(0, 5) ?? '',
        transport: data.transport ?? '',
        has_break: data.has_break ?? false,
        break_start: data.break_start?.slice(0, 5) ?? '',
        break_end: data.break_end?.slice(0, 5) ?? '',
        staff_message: data.staff_message ?? '',
        customer_message: data.customer_message ?? '',
        customer_notes: data.customer_notes ?? '',
        next_visit_notes: data.next_visit_notes ?? '',
      })
      setLoading(false)
    }
    load()
  }, [visitId])

  async function onSubmit(values: FormValues) {
    setSaving(true)
    setError(null)

    const { error: err } = await supabase
      .from('visits')
      .update({
        visit_date: values.visit_date,
        start_time: values.start_time || null,
        end_time: values.end_time || null,
        transport: values.transport || null,
        has_break: values.has_break,
        break_start: values.has_break ? (values.break_start || null) : null,
        break_end: values.has_break ? (values.break_end || null) : null,
        staff_message: values.staff_message || null,
        customer_message: values.customer_message || null,
        customer_notes: values.customer_notes || null,
        next_visit_notes: values.next_visit_notes || null,
      })
      .eq('id', visitId)

    if (err) {
      setError('保存に失敗しました: ' + err.message)
      setSaving(false)
      return
    }

    router.push(`/customers/${id}/visits/${visitId}`)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--color-primary)' }} />
      </div>
    )
  }

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 -ml-2">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
            style={{ color: 'var(--color-text)' }}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="page-title">対応履歴を編集</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* 訪問情報 */}
        <div className="card space-y-4">
          <p className="section-label">訪問情報</p>

          <div>
            <label className="form-label">訪問日<span className="required">*</span></label>
            <input className="input" type="date" {...register('visit_date', { required: true })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">開始時刻</label>
              <div className="flex gap-2">
                <input className="input flex-1" type="time" {...register('start_time')} />
                <button type="button" onClick={() => setNow('start_time')} className="btn-secondary text-xs px-2 flex-shrink-0">今すぐ</button>
              </div>
            </div>
            <div>
              <label className="form-label">終了時刻</label>
              <div className="flex gap-2">
                <input className="input flex-1" type="time" {...register('end_time')} />
                <button type="button" onClick={() => setNow('end_time')} className="btn-secondary text-xs px-2 flex-shrink-0">今すぐ</button>
              </div>
            </div>
          </div>

          <div>
            <label className="form-label">訪問手段</label>
            <select className="input" {...register('transport')}>
              <option value="">選択</option>
              <option value="車">車</option>
              <option value="電車">電車</option>
              <option value="その他">その他</option>
            </select>
          </div>

          {/* 休憩 */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>休憩</p>
            <label className="toggle">
              <input type="checkbox" {...register('has_break')} />
              <div className="toggle-track" />
              <div className="toggle-thumb" />
            </label>
          </div>

          {hasBreak && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <div>
                <label className="form-label">休憩開始</label>
                <div className="flex gap-2">
                  <input className="input flex-1" type="time" {...register('break_start')} />
                  <button type="button" onClick={() => setNow('break_start')} className="btn-secondary text-xs px-2 flex-shrink-0">今すぐ</button>
                </div>
              </div>
              <div>
                <label className="form-label">休憩終了</label>
                <div className="flex gap-2">
                  <input className="input flex-1" type="time" {...register('break_end')} />
                  <button type="button" onClick={() => setNow('break_end')} className="btn-secondary text-xs px-2 flex-shrink-0">今すぐ</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* メッセージ */}
        <div className="card space-y-4">
          <p className="section-label">メッセージ</p>
          <div>
            <label className="form-label">担当者からのメッセージ（報告書に掲載）</label>
            <textarea className="input" rows={3} placeholder="お疲れ様でした..." {...register('staff_message')} />
          </div>
          <div>
            <label className="form-label">ご依頼主からのメッセージ（報告書に掲載）</label>
            <textarea className="input" rows={2} placeholder="顧客からのコメント..." {...register('customer_message')} />
          </div>
        </div>

        {/* 非公開メモ */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <p className="section-label mb-0">非公開メモ</p>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: '#f3f4f6', color: '#6b7280' }}>報告書に含まれません</span>
          </div>
          <div>
            <label className="form-label">顧客の様子・コメント</label>
            <textarea className="input" rows={3} placeholder="気になった点など..." {...register('customer_notes')} />
          </div>
          <div>
            <label className="form-label">次回の予定・申し引き事項</label>
            <textarea className="input" rows={2} placeholder="次回持参するもの、注意点など..." {...register('next_visit_notes')} />
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl text-sm" style={{ background: '#fef2f2', color: '#dc2626' }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={saving} className="btn-primary w-full disabled:opacity-60">
          {saving ? '保存中...' : '保存する'}
        </button>

        <div className="bottom-nav-spacer" />
      </form>
    </div>
  )
}
