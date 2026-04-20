'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useForm, useFieldArray } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const babySchema = z.object({
  id: z.string().optional(),       // 既存レコードのID（新規はundefined）
  name: z.string().optional(),
  birth_date: z.string().optional(),
  due_date: z.string().optional(),
})

const schema = z.object({
  name_kanji: z.string().min(1, '氏名（漢字）は必須です'),
  name_kana: z.string().min(1, 'フリガナは必須です'),
  age: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('正しいメールアドレスを入力してください').optional().or(z.literal('')),
  line_id: z.string().optional(),
  address: z.string().optional(),
  transport: z.string().optional(),
  inquiry_date: z.string().optional(),
  status: z.string().default('活動中'),
  notes: z.string().optional(),
  babies: z.array(babySchema).default([]),
})

type FormValues = z.infer<typeof schema>

export default function CustomerEditPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [originalBabyIds, setOriginalBabyIds] = useState<string[]>([])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: { status: '活動中', babies: [] },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'babies' })

  // 既存データを読み込む
  useEffect(() => {
    async function load() {
      const [cRes, bRes] = await Promise.all([
        supabase.from('customers').select('*').eq('id', id).single(),
        supabase.from('babies').select('*').eq('customer_id', id).order('sort_order'),
      ])

      if (!cRes.data) { router.push('/customers'); return }

      const c = cRes.data
      const babies = bRes.data ?? []

      setOriginalBabyIds(babies.map((b: { id: string }) => b.id))

      reset({
        name_kanji: c.name_kanji,
        name_kana: c.name_kana,
        age: c.age?.toString() ?? '',
        phone: c.phone ?? '',
        email: c.email ?? '',
        line_id: c.line_id ?? '',
        address: c.address ?? '',
        transport: c.transport ?? '',
        inquiry_date: c.inquiry_date ?? '',
        status: c.status,
        notes: c.notes ?? '',
        babies: babies.map((b: { id: string; name: string | null; birth_date: string | null; due_date: string | null }) => ({
          id: b.id,
          name: b.name ?? '',
          birth_date: b.birth_date ?? '',
          due_date: b.due_date ?? '',
        })),
      })
      setLoading(false)
    }
    load()
  }, [id])

  async function onSubmit(values: FormValues) {
    setSaving(true)
    setError(null)

    // 顧客情報を更新
    const { error: custErr } = await supabase
      .from('customers')
      .update({
        name_kanji: values.name_kanji,
        name_kana: values.name_kana,
        age: values.age ? parseInt(values.age) : null,
        phone: values.phone || null,
        email: values.email || null,
        line_id: values.line_id || null,
        address: values.address || null,
        transport: values.transport || null,
        inquiry_date: values.inquiry_date || null,
        status: values.status,
        notes: values.notes || null,
      })
      .eq('id', id)

    if (custErr) {
      setError('更新に失敗しました: ' + custErr.message)
      setSaving(false)
      return
    }

    // 赤ちゃん情報の同期
    const currentIds = values.babies.filter(b => b.id).map(b => b.id!)
    const deletedIds = originalBabyIds.filter(oid => !currentIds.includes(oid))

    // 削除されたレコードを消す
    if (deletedIds.length > 0) {
      await supabase.from('babies').delete().in('id', deletedIds)
    }

    for (let i = 0; i < values.babies.length; i++) {
      const b = values.babies[i]
      if (b.id) {
        // 既存レコードを更新
        await supabase.from('babies').update({
          name: b.name || null,
          birth_date: b.birth_date || null,
          due_date: b.due_date || null,
          sort_order: i,
        }).eq('id', b.id)
      } else {
        // 新規レコードを追加
        await supabase.from('babies').insert({
          customer_id: id,
          name: b.name || null,
          birth_date: b.birth_date || null,
          due_date: b.due_date || null,
          sort_order: i,
        })
      }
    }

    router.push(`/customers/${id}`)
  }

  async function handleDelete() {
    if (!confirm('この顧客を削除してもよいですか？\n対応履歴・請求情報もすべて削除されます。')) return
    setDeleting(true)
    await supabase.from('customers').delete().eq('id', id)
    router.push('/customers')
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
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 -ml-2">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
            style={{ color: 'var(--color-text)' }}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="page-title">カルテを編集</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* お母さん情報 */}
        <div className="card space-y-4">
          <p className="section-label">お母さん情報</p>

          <div>
            <label className="form-label">氏名（漢字）<span className="required">*</span></label>
            <input className="input" placeholder="例：山田 花子" {...register('name_kanji')} />
            {errors.name_kanji && <p className="text-xs mt-1" style={{ color: 'var(--color-primary-dark)' }}>{errors.name_kanji.message}</p>}
          </div>

          <div>
            <label className="form-label">フリガナ<span className="required">*</span></label>
            <input className="input" placeholder="例：ヤマダ ハナコ" {...register('name_kana')} />
            {errors.name_kana && <p className="text-xs mt-1" style={{ color: 'var(--color-primary-dark)' }}>{errors.name_kana.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">年齢</label>
              <input className="input" type="number" placeholder="30" {...register('age')} />
            </div>
            <div>
              <label className="form-label">電話番号</label>
              <input className="input" type="tel" placeholder="090-xxxx-xxxx" {...register('phone')} />
            </div>
          </div>

          <div>
            <label className="form-label">メールアドレス</label>
            <input className="input" type="email" placeholder="example@gmail.com" {...register('email')} />
            {errors.email && <p className="text-xs mt-1" style={{ color: 'var(--color-primary-dark)' }}>{errors.email.message}</p>}
          </div>

          <div>
            <label className="form-label">LINE ID</label>
            <input className="input" placeholder="@line_id" {...register('line_id')} />
          </div>

          <div>
            <label className="form-label">住所</label>
            <input className="input" placeholder="東京都..." {...register('address')} />
          </div>
        </div>

        {/* 赤ちゃん情報 */}
        <div className="card space-y-4">
          <p className="section-label">赤ちゃん情報</p>

          {fields.map((field, index) => (
            <div key={field.id} className="p-3 rounded-xl space-y-3"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                  赤ちゃん {index + 1}
                </span>
                <button type="button" onClick={() => remove(index)}
                  className="text-xs px-2 py-1 rounded-lg"
                  style={{ color: 'var(--color-primary-dark)', background: 'var(--color-primary-light)' }}>
                  削除
                </button>
              </div>
              <div>
                <label className="form-label">名前</label>
                <input className="input" placeholder="〇〇ちゃん" {...register(`babies.${index}.name`)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">出産日</label>
                  <input className="input" type="date" {...register(`babies.${index}.birth_date`)} />
                </div>
                <div>
                  <label className="form-label">出産予定日</label>
                  <input className="input" type="date" {...register(`babies.${index}.due_date`)} />
                </div>
              </div>
            </div>
          ))}

          <button type="button"
            onClick={() => append({ id: undefined, name: '', birth_date: '', due_date: '' })}
            className="btn-secondary w-full text-sm">
            ＋ 赤ちゃん情報を追加
          </button>
        </div>

        {/* サポート情報 */}
        <div className="card space-y-4">
          <p className="section-label">サポート情報</p>

          <div>
            <label className="form-label">訪問手段</label>
            <select className="input" {...register('transport')}>
              <option value="">選択してください</option>
              <option value="車">車</option>
              <option value="電車">電車</option>
              <option value="その他">その他</option>
            </select>
          </div>

          <div>
            <label className="form-label">問い合わせ日</label>
            <input className="input" type="date" {...register('inquiry_date')} />
          </div>

          <div>
            <label className="form-label">ステータス</label>
            <select className="input" {...register('status')}>
              <option value="活動中">活動中</option>
              <option value="契約済み">契約済み</option>
              <option value="終了">終了</option>
            </select>
          </div>
        </div>

        {/* 備考 */}
        <div className="card">
          <label className="form-label">備考・メモ</label>
          <textarea className="input" rows={4} placeholder="自由記載..." {...register('notes')} />
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl text-sm" style={{ background: '#fef2f2', color: '#dc2626' }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={saving} className="btn-primary w-full disabled:opacity-60">
          {saving ? '保存中...' : '保存する'}
        </button>

        {/* 顧客削除 */}
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-60"
          style={{ background: '#fef2f2', color: '#dc2626' }}>
          {deleting ? '削除中...' : 'この顧客を削除する'}
        </button>

        <div className="bottom-nav-spacer" />
      </form>
    </div>
  )
}
