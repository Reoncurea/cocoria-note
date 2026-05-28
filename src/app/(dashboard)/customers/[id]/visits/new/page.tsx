'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { SupportTag } from '@/types/database'
import { useForm, useFieldArray } from 'react-hook-form'

interface ServiceRow { time_label: string; content: string; detail: string }

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
  service_records: ServiceRow[]
}

const RECORD_CATEGORIES = [
  { group: '赤ちゃんのお世話', items: ['ミルク', 'オムツ(うんち)', 'オムツ(おしっこ)', '沐浴', '抱っこ・あやし', '寝かしつけ'] },
  { group: '家事', items: ['料理', '掃除', '洗濯', '片付け'] },
  { group: '対話・ケア', items: ['ママと対話', '兄弟と対話', '授乳サポート'] },
]

export default function VisitNewPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<1 | 2>(1)
  const [tags, setTags] = useState<SupportTag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quickTime, setQuickTime] = useState('')
  const [quickDetail, setQuickDetail] = useState('')

  const { register, control, handleSubmit, watch, setValue } = useForm<FormValues>({
    shouldUnregister: false,
    defaultValues: {
      visit_date: new Date().toISOString().split('T')[0],
      has_break: false,
      service_records: [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'service_records' })
  const hasBreak = watch('has_break')

  function getNowTime() {
    const now = new Date()
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  }

  function setNow(field: 'start_time' | 'end_time' | 'break_start' | 'break_end') {
    const now = new Date()
    setValue(field, `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
  }

  function setQuickNow() { setQuickTime(getNowTime()) }

  function addRecord(category: string) {
    const time = quickTime || getNowTime()
    if (!quickTime) setQuickTime(time)
    append({ time_label: time, content: category, detail: quickDetail })
    setQuickDetail('')
  }

  useEffect(() => {
    async function loadTags() {
      const { data } = await supabase.from('support_tags').select('*').order('sort_order')
      setTags(data ?? [])
    }
    loadTags()
  }, [])

  function toggleTag(tagId: string) {
    setSelectedTagIds(prev => prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId])
  }

  async function onSubmit(values: FormValues) {
    setSaving(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('ログインが必要です'); setSaving(false); return }

    const { data: visit, error: visitErr } = await supabase
      .from('visits')
      .insert({
        customer_id: id,
        user_id: user.id,
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
        report_sent: false,
      })
      .select()
      .single()

    if (visitErr || !visit) {
      setError('保存に失敗しました: ' + visitErr?.message)
      setSaving(false)
      return
    }

    if (selectedTagIds.length > 0) {
      await supabase.from('visit_tags').insert(
        selectedTagIds.map(tag_id => ({ visit_id: visit.id, tag_id }))
      )
    }

    const records = values.service_records.filter(r => r.time_label || r.content)
    if (records.length > 0) {
      await supabase.from('service_records').insert(
        records.map((r, i) => ({
          visit_id: visit.id,
          time_label: r.time_label,
          content: r.content,
          detail: r.detail,
          sort_order: i,
        }))
      )
    }

    await supabase.from('breath_checks').insert({ visit_id: visit.id })
    router.push(`/customers/${id}/visits/${visit.id}`)
  }

  return (
    <div className="px-4 pt-6">

      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => step === 1 ? router.back() : setStep(1)}
          className="p-2 -ml-2">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
            style={{ color: 'var(--color-text)' }}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="page-title flex-1">対応履歴を記録</h1>
      </div>

      {/* ステップインジケーター */}
      <div className="flex items-center gap-2 mb-6">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="flex items-center gap-1.5 text-sm font-semibold transition-colors"
          style={{ color: step === 1 ? 'var(--color-primary-dark)' : 'var(--color-text-muted)' }}>
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
            style={{
              background: step === 1 ? 'var(--color-primary)' : 'var(--color-border)',
              color: step === 1 ? 'white' : 'var(--color-text-muted)',
            }}>1</span>
          訪問情報
        </button>
        <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
        <button
          type="button"
          onClick={() => setStep(2)}
          className="flex items-center gap-1.5 text-sm font-semibold transition-colors"
          style={{ color: step === 2 ? 'var(--color-primary-dark)' : 'var(--color-text-muted)' }}>
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
            style={{
              background: step === 2 ? 'var(--color-primary)' : 'var(--color-border)',
              color: step === 2 ? 'white' : 'var(--color-text-muted)',
            }}>2</span>
          記録・メモ
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* ===== STEP 1 ===== */}
        <div style={{ display: step === 1 ? 'block' : 'none' }} className="space-y-5">

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

          {/* サポート内容タグ */}
          <div className="card space-y-3">
            <p className="section-label">サポート内容</p>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`tag-chip ${selectedTagIds.includes(tag.id) ? 'tag-chip-selected' : ''}`}>
                  {tag.name}
                </button>
              ))}
            </div>
          </div>

          {/* 次へボタン */}
          <button
            type="button"
            onClick={() => setStep(2)}
            className="btn-primary w-full">
            次へ →
          </button>

          <div className="bottom-nav-spacer" />
        </div>

        {/* ===== STEP 2 ===== */}
        <div style={{ display: step === 2 ? 'block' : 'none' }} className="space-y-5">

          {/* 作業記録 */}
          <div className="card space-y-4">
            <p className="section-label">作業記録</p>

            {fields.length > 0 && (
              <div className="space-y-2">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
                    style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                    <span className="font-semibold w-12 flex-shrink-0" style={{ color: 'var(--color-primary-dark)' }}>
                      {field.time_label}
                    </span>
                    <span className="flex-1" style={{ color: 'var(--color-text)' }}>{field.content}</span>
                    {field.detail && (
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{field.detail}</span>
                    )}
                    <button type="button" onClick={() => remove(index)}
                      className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-xs"
                      style={{ background: '#fef2f2', color: '#dc2626' }}>✕</button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3 p-3 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold flex-shrink-0" style={{ color: 'var(--color-text)' }}>時刻</span>
                <input
                  className="input flex-1 text-sm"
                  type="time"
                  value={quickTime}
                  onChange={e => setQuickTime(e.target.value)}
                />
                <button type="button" onClick={setQuickNow} className="btn-secondary text-xs px-3 flex-shrink-0">今すぐ</button>
              </div>

              {RECORD_CATEGORIES.map(cat => (
                <div key={cat.group}>
                  <p className="text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>{cat.group}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {cat.items.map(item => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => addRecord(item)}
                        className="text-xs px-3 py-1.5 rounded-full font-medium transition-colors"
                        style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)' }}>
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <input
                className="input text-sm"
                placeholder="メモ（任意）— 入力後にカテゴリーをタップ"
                value={quickDetail}
                onChange={e => setQuickDetail(e.target.value)}
              />
            </div>
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
        </div>

      </form>
    </div>
  )
}
