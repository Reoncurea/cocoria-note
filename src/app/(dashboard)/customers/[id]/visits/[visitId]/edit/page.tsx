'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { VisitPhoto } from '@/types/database'
import { useForm, useFieldArray } from 'react-hook-form'
import { createVisitPhotoPath, validatePhotoFile } from '@/lib/uploads/photos'

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
  drive_link: string
  service_records: ServiceRow[]
}

type VisitPhotoWithUrl = VisitPhoto & { signedUrl?: string }
type PhotoUsage = { enabled: boolean; count: number; limit: number; remaining: number }

const RECORD_CATEGORIES = [
  { group: '赤ちゃんのお世話', items: ['ミルク', 'オムツ(うんち)', 'オムツ(おしっこ)', '沐浴', '抱っこ・あやし', '寝かしつけ'] },
  { group: '家事', items: ['料理', '掃除', '洗濯', '片付け'] },
  { group: '対話・ケア', items: ['ママと対話', '兄弟と対話', '授乳サポート'] },
]

export default function VisitEditPage() {
  const { id, visitId } = useParams<{ id: string; visitId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [quickTime, setQuickTime] = useState('')
  const [quickDetail, setQuickDetail] = useState('')
  const [photos, setPhotos] = useState<VisitPhotoWithUrl[]>([])
  const [photoCaption, setPhotoCaption] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoUsage, setPhotoUsage] = useState<PhotoUsage | null>(null)

  const { register, control, handleSubmit, watch, setValue, reset } = useForm<FormValues>({
    shouldUnregister: false,
    defaultValues: { has_break: false, service_records: [] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'service_records' })
  const hasBreak = watch('has_break')

  function setNow(field: 'start_time' | 'end_time' | 'break_start' | 'break_end') {
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    setValue(field, `${hh}:${mm}`)
  }

  function getNowTime() {
    const now = new Date()
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  }

  function setQuickNow() { setQuickTime(getNowTime()) }

  function addRecord(category: string) {
    const time = quickTime || getNowTime()
    if (!quickTime) setQuickTime(time)
    append({ time_label: time, content: category, detail: quickDetail })
    setQuickDetail('')
  }

  async function withSignedUrls(photoRows: VisitPhoto[]): Promise<VisitPhotoWithUrl[]> {
    return Promise.all(photoRows.map(async photo => {
      const { data } = await supabase.storage.from('visit-photos').createSignedUrl(photo.file_path, 60 * 60)
      return { ...photo, signedUrl: data?.signedUrl }
    }))
  }

  useEffect(() => {
    async function load() {
      const [{ data }, { data: records }, { data: photoRows }, usageResponse] = await Promise.all([
        supabase.from('visits').select('*').eq('id', visitId).single(),
        supabase.from('service_records').select('*').eq('visit_id', visitId).order('sort_order'),
        supabase.from('visit_photos').select('*').eq('visit_id', visitId).order('sort_order'),
        fetch(`/api/customers/${id}/photo-usage`, { cache: 'no-store' }),
      ])
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
        drive_link: data.drive_link ?? '',
        service_records: (records ?? []).map(r => ({
          time_label: r.time_label ?? '',
          content: r.content ?? '',
          detail: r.detail ?? '',
        })),
      })
      setPhotos(await withSignedUrls((photoRows ?? []) as VisitPhoto[]))
      if (usageResponse.ok) {
        setPhotoUsage(await usageResponse.json() as PhotoUsage)
      }
      setLoading(false)
    }
    load()
  }, [visitId])

  async function uploadPhoto(file: File | null) {
    if (!file) return
    const validationError = validatePhotoFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setPhotoUploading(true)
    setError(null)
    if (photoUsage && !photoUsage.enabled) {
      setError('写真アップロードはオプション機能です。')
      setPhotoUploading(false)
      return
    }
    if (photoUsage && photoUsage.remaining <= 0) {
      setError(`写真は1顧客につき${photoUsage.limit}枚まで保存できます。`)
      setPhotoUploading(false)
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    if (photoCaption) formData.append('caption', photoCaption)

    const response = await fetch(`/api/visits/${visitId}/photos`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string } | null
      setError(body?.error ?? '写真のアップロードに失敗しました。')
      setPhotoUploading(false)
      return
    }

    const uploadedPhoto = await response.json() as VisitPhotoWithUrl
    setPhotos(prev => [...prev, uploadedPhoto])
    setPhotoUsage(prev => prev
      ? { ...prev, count: prev.count + 1, remaining: Math.max(prev.remaining - 1, 0) }
      : prev)
    setPhotoCaption('')
    setPhotoUploading(false)
    return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('ログインが必要です')
      setPhotoUploading(false)
      return
    }

    const filePath = createVisitPhotoPath(user!.id, visitId, file!)
    const { error: uploadErr } = await supabase.storage.from('visit-photos').upload(filePath, file!, {
      contentType: file!.type,
      upsert: false,
    })
    if (uploadErr) {
      setError('写真のアップロードに失敗しました。時間をおいて再度お試しください。')
      setPhotoUploading(false)
      return
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('visit_photos')
      .insert({
        visit_id: visitId,
        user_id: user!.id,
        file_path: filePath,
        caption: photoCaption || null,
        sort_order: photos.length,
      })
      .select()
      .single()

    if (insertErr || !inserted) {
      await supabase.storage.from('visit-photos').remove([filePath])
      setError('写真情報の保存に失敗しました。時間をおいて再度お試しください。')
      setPhotoUploading(false)
      return
    }

    const [photo] = await withSignedUrls([inserted as VisitPhoto])
    setPhotos(prev => [...prev, photo])
    setPhotoCaption('')
    setPhotoUploading(false)
  }

  async function updatePhotoCaption(photoId: string, caption: string) {
    setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, caption } : p))
    await supabase.from('visit_photos').update({ caption: caption || null }).eq('id', photoId)
  }

  async function deletePhoto(photo: VisitPhotoWithUrl) {
    const ok = window.confirm('この写真を削除しますか？')
    if (!ok) return
    await supabase.from('visit_photos').delete().eq('id', photo.id)
    await supabase.storage.from('visit-photos').remove([photo.file_path])
    setPhotos(prev => prev.filter(p => p.id !== photo.id))
    setPhotoUsage(prev => prev
      ? { ...prev, count: Math.max(prev.count - 1, 0), remaining: Math.min(prev.remaining + 1, prev.limit) }
      : prev)
  }

  async function saveVisit(values: FormValues, returnToBreathCheck: boolean) {
    setSaving(true)
    setError(null)
    setSavedMessage(null)

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
        drive_link: values.drive_link || null,
      })
      .eq('id', visitId)

    if (err) {
      setError('保存に失敗しました: ' + err.message)
      setSaving(false)
      return
    }

    const { error: deleteErr } = await supabase.from('service_records').delete().eq('visit_id', visitId)
    if (deleteErr) {
      setError('作業記録の保存に失敗しました: ' + deleteErr.message)
      setSaving(false)
      return
    }

    const records = values.service_records.filter(r => r.time_label || r.content)
    if (records.length > 0) {
      const { error: recordErr } = await supabase.from('service_records').insert(
        records.map((r, i) => ({
          visit_id: visitId,
          time_label: r.time_label,
          content: r.content,
          detail: r.detail,
          sort_order: i,
        }))
      )
      if (recordErr) {
        setError('作業記録の保存に失敗しました: ' + recordErr.message)
        setSaving(false)
        return
      }
    }

    setSaving(false)

    if (returnToBreathCheck) {
      router.push(`/customers/${id}/visits/${visitId}`)
      return
    }

    setSavedMessage('保存しました')
  }

  async function onSubmit(values: FormValues) {
    await saveVisit(values, false)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--color-primary)' }} />
      </div>
    )
  }

  const photoUploadDisabled =
    photoUploading ||
    photoUsage?.enabled === false ||
    (photoUsage?.remaining ?? 1) <= 0

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 -ml-2">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
            style={{ color: 'var(--color-text)' }}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="page-title flex-1">対応履歴を入力</h1>
        <button
          type="button"
          onClick={handleSubmit(values => saveVisit(values, true))}
          disabled={saving}
          className="btn-secondary text-sm px-3 py-2 flex-shrink-0 disabled:opacity-60"
        >
          呼吸チェックに戻る
        </button>
        <button
          type="button"
          onClick={handleSubmit(values => saveVisit(values, false))}
          disabled={saving}
          className="btn-primary text-sm px-3 py-2 flex-shrink-0 disabled:opacity-60"
        >
          {saving ? '保存中...' : '保存'}
        </button>
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

        {/* 作業記録 */}
        <div className="card space-y-4">
          <p className="section-label">時間ごとの作業記録</p>

          {fields.length > 0 && (
            <div className="space-y-2">
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-[90px_1fr_auto] gap-2 items-start p-3 rounded-xl"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                  <input
                    className="input text-sm"
                    type="text"
                    placeholder="10:00"
                    inputMode="text"
                    {...register(`service_records.${index}.time_label`)}
                  />
                  <div className="space-y-2">
                    <input
                      className="input text-sm"
                      placeholder="作業内容"
                      {...register(`service_records.${index}.content`)}
                    />
                    <input
                      className="input text-sm"
                      placeholder="メモ（任意）"
                      {...register(`service_records.${index}.detail`)}
                    />
                  </div>
                  <button type="button" onClick={() => remove(index)}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-sm"
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

            <button
              type="button"
              onClick={() => append({ time_label: quickTime || getNowTime(), content: '', detail: quickDetail })}
              className="btn-secondary w-full text-sm py-2"
            >
              空の記録を追加
            </button>
          </div>
        </div>

        {/* 写真共有 */}
        <div className="card space-y-4">
          <p className="section-label">写真共有</p>

          {photos.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {photos.map(photo => (
                <div key={photo.id} className="space-y-2 rounded-xl p-3"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                  {photo.signedUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.signedUrl}
                      alt={photo.caption ?? '訪問写真'}
                      className="w-full rounded-lg object-cover"
                      style={{ aspectRatio: '4 / 3' }}
                    />
                  )}
                  <textarea
                    className="input text-sm"
                    rows={3}
                    defaultValue={photo.caption ?? ''}
                    placeholder="写真の内容、作った料理、保存期間など"
                    onBlur={e => updatePhotoCaption(photo.id, e.target.value)}
                  />
                  <button type="button" onClick={() => deletePhoto(photo)} className="btn-secondary w-full text-sm py-2">
                    写真を削除
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3 p-3 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            {photoUsage && (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {photoUsage.enabled
                  ? `写真 ${photoUsage.count} / ${photoUsage.limit}枚`
                  : '写真アップロードはオプション機能です。'}
              </p>
            )}
            <textarea
              className="input text-sm"
              rows={3}
              placeholder="例：肉じゃが、冷蔵で2日以内。温め直して召し上がってください。"
              value={photoCaption}
              onChange={e => setPhotoCaption(e.target.value)}
            />
            <label className={`btn-primary block text-center text-sm py-3 ${photoUploadDisabled ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}`}>
              {photoUploading ? 'アップロード中...' : '写真をアップロード'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={photoUploadDisabled}
                onChange={e => {
                  void uploadPhoto(e.target.files?.[0] ?? null)
                  e.currentTarget.value = ''
                }}
              />
            </label>
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
          <div>
            <label className="form-label">Googleドライブ等の共有リンク</label>
            <input className="input" type="url" placeholder="https://..." {...register('drive_link')} />
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl text-sm" style={{ background: '#fef2f2', color: '#dc2626' }}>
            {error}
          </div>
        )}
        {savedMessage && (
          <div className="px-4 py-3 rounded-xl text-sm" style={{ background: '#ecfdf5', color: '#047857' }}>
            {savedMessage}
          </div>
        )}

        <button type="submit" disabled={saving} className="btn-primary w-full disabled:opacity-60">
          {saving ? '保存中...' : '保存'}
        </button>

        <div className="bottom-nav-spacer" />
      </form>
    </div>
  )
}
