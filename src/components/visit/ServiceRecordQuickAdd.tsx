'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ServiceRecord } from '@/types/database'

// 訪問しながら使う作業記録。カテゴリーを押すと、その時刻で1件すぐ保存する。
// 訪問が終わってから思い出して書くのではなく、その場で残せるようにするのが目的。

const RECORD_CATEGORIES = [
  { group: '赤ちゃんのお世話', items: ['ミルク', 'オムツ(うんち)', 'オムツ(おしっこ)', '沐浴', '抱っこ・あやし', '寝かしつけ'] },
  { group: '家事', items: ['料理', '掃除', '洗濯', '片付け'] },
  { group: '対話・ケア', items: ['ママと対話', '兄弟と対話', '授乳サポート'] },
]

function nowTime() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export default function ServiceRecordQuickAdd({
  visitId,
  initialRecords,
}: {
  visitId: string
  initialRecords: ServiceRecord[]
}) {
  const supabase = createClient()
  const [records, setRecords] = useState<ServiceRecord[]>(initialRecords)
  const [time, setTime] = useState('')
  const [detail, setDetail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function addRecord(content: string) {
    const timeLabel = time || nowTime()
    setSaving(true)
    setError(null)

    const { data, error: insertError } = await supabase
      .from('service_records')
      .insert({
        visit_id: visitId,
        time_label: timeLabel,
        content,
        detail: detail || null,
        sort_order: records.length,
      })
      .select()
      .single()

    setSaving(false)

    if (insertError || !data) {
      setError('記録の保存に失敗しました。通信環境を確認してください。')
      return
    }

    setRecords(prev => [...prev, data])
    setTime(timeLabel)
    setDetail('')
  }

  async function removeRecord(recordId: string) {
    const previous = records
    setRecords(prev => prev.filter(r => r.id !== recordId))

    const { error: deleteError } = await supabase.from('service_records').delete().eq('id', recordId)
    if (deleteError) {
      setRecords(previous)
      setError('削除に失敗しました。')
    }
  }

  return (
    <div className="space-y-3 pt-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold" style={{ color: 'var(--color-primary-dark)' }}>
          作業記録
        </p>
        <span className="text-xs" style={{ color: saving ? 'var(--color-primary-dark)' : 'var(--color-text-muted)' }}>
          {saving ? '保存中...' : `${records.length}件`}
        </span>
      </div>

      {error && (
        <p className="text-xs px-3 py-2 rounded-lg" style={{ background: '#fef2f2', color: '#dc2626' }}>{error}</p>
      )}

      {records.length > 0 && (
        <div className="space-y-1.5">
          {records.map(record => (
            <div key={record.id} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <span className="font-semibold w-12 flex-shrink-0" style={{ color: 'var(--color-primary-dark)' }}>
                {record.time_label}
              </span>
              <span className="flex-1 min-w-0" style={{ color: 'var(--color-text)' }}>{record.content}</span>
              {record.detail && (
                <span className="text-xs truncate" style={{ color: 'var(--color-text-muted)', maxWidth: '40%' }}>
                  {record.detail}
                </span>
              )}
              <button
                type="button"
                onClick={() => removeRecord(record.id)}
                className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-xs"
                style={{ background: '#fef2f2', color: '#dc2626' }}
                aria-label="この記録を削除"
              >
                ✕
              </button>
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
            value={time}
            onChange={event => setTime(event.target.value)}
          />
          <button type="button" onClick={() => setTime(nowTime())} className="btn-secondary text-xs px-3 flex-shrink-0">
            今すぐ
          </button>
        </div>

        <input
          className="input text-sm"
          placeholder="メモ（任意）— 入力してからカテゴリーを押す"
          value={detail}
          onChange={event => setDetail(event.target.value)}
        />

        {RECORD_CATEGORIES.map(category => (
          <div key={category.group}>
            <p className="text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>{category.group}</p>
            <div className="flex flex-wrap gap-1.5">
              {category.items.map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => addRecord(item)}
                  disabled={saving}
                  className="text-xs px-3 py-1.5 rounded-full font-medium disabled:opacity-50"
                  style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)' }}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ))}

        <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
          押すとその時刻で記録されます。時刻が空のときは現在時刻を使います。
        </p>
      </div>
    </div>
  )
}
