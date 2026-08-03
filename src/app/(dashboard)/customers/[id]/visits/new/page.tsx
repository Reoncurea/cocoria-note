'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { SupportTag } from '@/types/database'
import { useForm } from 'react-hook-form'

// 訪問記録は「作業のあとに書くもの」ではなく「訪問より先に作るもの」。
// ここでは日時などの枠だけ作り、チェックリスト・呼吸チェック・作業記録は
// 保存後の作業画面（訪問詳細）で、訪問しながら記録していく。

interface FormValues {
  visit_date: string
  start_time: string
  end_time: string
  transport: string
  has_break: boolean
  break_start: string
  break_end: string
}

export default function VisitNewPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [tags, setTags] = useState<SupportTag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, watch, setValue } = useForm<FormValues>({
    shouldUnregister: false,
    defaultValues: {
      visit_date: new Date().toISOString().split('T')[0],
      has_break: false,
    },
  })

  const hasBreak = watch('has_break')

  function setNow(field: 'start_time' | 'end_time' | 'break_start' | 'break_end') {
    const now = new Date()
    setValue(field, `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
  }

  useEffect(() => {
    async function loadTags() {
      const { data } = await supabase.from('support_tags').select('*').order('sort_order')
      setTags(data ?? [])
    }
    loadTags()
    // supabase クライアントは毎回作り直されるので依存に入れない
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // 呼吸チェック表は訪問中に使うので、この時点で用意しておく
    await supabase.from('breath_checks').insert({ visit_id: visit.id })

    router.push(`/customers/${id}/visits/${visit.id}`)
  }

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center gap-3 mb-4">
        <button type="button" onClick={() => router.back()} className="p-2 -ml-2">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
            style={{ color: 'var(--color-text)' }}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="page-title flex-1">訪問を登録</h1>
      </div>

      <p className="text-xs leading-relaxed mb-5 px-1" style={{ color: 'var(--color-text-muted)' }}>
        まず日時だけ登録します。訪問前チェック・呼吸チェック・作業記録は、
        このあとの作業画面で訪問しながら記録できます。
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            あとから変更できます。
          </p>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl text-sm" style={{ background: '#fef2f2', color: '#dc2626' }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={saving} className="btn-primary w-full disabled:opacity-60">
          {saving ? '登録中...' : '登録して訪問前チェックへ →'}
        </button>

        <div className="bottom-nav-spacer" />
      </form>
    </div>
  )
}
