'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useForm, useFieldArray } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const babySchema = z.object({
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

export default function CustomerNewPage() {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: { status: '活動中', babies: [] },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'babies' })

  async function onSubmit(values: FormValues) {
    setSaving(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('ログインが必要です'); setSaving(false); return }

    // 顧客登録
    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .insert({
        user_id: user.id,
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
      .select()
      .single()

    if (custErr || !customer) {
      setError('登録に失敗しました: ' + custErr?.message)
      setSaving(false)
      return
    }

    // 赤ちゃん情報
    if (values.babies.length > 0) {
      const babyInserts = values.babies.map((b, i) => ({
        customer_id: customer.id,
        name: b.name || null,
        birth_date: b.birth_date || null,
        due_date: b.due_date || null,
        sort_order: i,
      }))
      await supabase.from('babies').insert(babyInserts)
    }

    // 請求情報（初期値）
    await supabase.from('billing').insert({
      customer_id: customer.id,
      user_id: user.id,
      contracted: false,
      invoiced: false,
      paid: false,
    })

    router.push(`/customers/${customer.id}`)
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
        <h1 className="page-title">顧客を登録</h1>
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
            onClick={() => append({ name: '', birth_date: '', due_date: '' })}
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
          {saving ? '保存中...' : '登録する'}
        </button>

        <div className="bottom-nav-spacer" />
      </form>
    </div>
  )
}
