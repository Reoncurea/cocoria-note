'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  MOODS,
  MOOD_EMOJI,
  MOOD_LABEL,
  isHighTemperature,
  isPlausibleTemperature,
  shortTime,
  toMood,
  type Mood,
} from '@/lib/constants/baby-observation'
import type { BabyObservation } from '@/types/database'

// 訪問中の体温・機嫌を、時刻つきで何回でも残す。

function nowTime() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export default function BabyObservationPanel({
  visitId,
  initialObservations,
}: {
  visitId: string
  initialObservations: BabyObservation[]
}) {
  const supabase = useMemo(() => createClient(), [])
  const [observations, setObservations] = useState<BabyObservation[]>(initialObservations)
  const [time, setTime] = useState('')
  const [temperature, setTemperature] = useState('')
  const [mood, setMood] = useState<Mood | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 別の画面から戻ってきたときに古い一覧が出ないよう、開いた時点で取り直す
  useEffect(() => {
    let ignore = false

    async function sync() {
      const { data } = await supabase
        .from('baby_observations')
        .select('*')
        .eq('visit_id', visitId)
        .order('recorded_at')
      if (!ignore && data) setObservations(data)
    }

    void sync()
    return () => { ignore = true }
  }, [supabase, visitId])

  async function add() {
    const trimmed = temperature.trim()
    const temperatureValue = trimmed ? Number(trimmed) : null

    if (temperatureValue !== null && Number.isNaN(temperatureValue)) {
      setError('体温は数字で入力してください。')
      return
    }
    // 36.8 を 368 と打ち間違えたときに気づけるようにする
    if (temperatureValue !== null && !isPlausibleTemperature(temperatureValue)) {
      setError('体温は33〜42℃の範囲で入力してください。')
      return
    }
    if (temperatureValue === null && !mood && !note.trim()) {
      setError('体温・機嫌・メモのどれかを入力してください。')
      return
    }

    setSaving(true)
    setError(null)

    const { data, error: insertError } = await supabase
      .from('baby_observations')
      .insert({
        visit_id: visitId,
        recorded_at: time || nowTime(),
        temperature: temperatureValue,
        mood,
        note: note.trim() || null,
      })
      .select()
      .single()

    setSaving(false)
    if (insertError || !data) {
      setError('記録できませんでした。通信環境を確認してください。')
      return
    }

    setObservations(prev => [...prev, data])
    setTemperature('')
    setMood(null)
    setNote('')
    setTime('')
  }

  async function remove(id: string) {
    const previous = observations
    setObservations(prev => prev.filter(o => o.id !== id))
    const { error: deleteError } = await supabase.from('baby_observations').delete().eq('id', id)
    if (deleteError) {
      setObservations(previous)
      setError('削除できませんでした。')
    }
  }

  return (
    <div className="space-y-3 pt-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold" style={{ color: 'var(--color-primary-dark)' }}>体温・機嫌</p>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{observations.length}件</span>
      </div>

      {error && (
        <p className="text-xs px-3 py-2 rounded-lg" style={{ background: '#fef2f2', color: '#dc2626' }}>{error}</p>
      )}

      {observations.length > 0 && (
        <div className="space-y-1.5">
          {observations.map(observation => {
            const moodKey = toMood(observation.mood)
            const high = observation.temperature !== null && isHighTemperature(observation.temperature)
            return (
              <div key={observation.id} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <span className="font-semibold w-12 flex-shrink-0" style={{ color: 'var(--color-primary-dark)' }}>
                  {shortTime(observation.recorded_at)}
                </span>
                {observation.temperature !== null && (
                  <span
                    className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={high
                      ? { background: '#fee2e2', color: '#991b1b' }
                      : { background: '#dcfce7', color: '#166534' }}
                  >
                    {observation.temperature}℃
                  </span>
                )}
                {moodKey && (
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-text)' }}>
                    {MOOD_EMOJI[moodKey]} {MOOD_LABEL[moodKey]}
                  </span>
                )}
                {observation.note && (
                  <span className="text-xs flex-1 min-w-0 truncate" style={{ color: 'var(--color-text-muted)' }}>
                    {observation.note}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => remove(observation.id)}
                  className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-xs ml-auto"
                  style={{ background: '#fef2f2', color: '#dc2626' }}
                  aria-label="この記録を削除"
                >
                  ✕
                </button>
              </div>
            )
          })}
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

        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold flex-shrink-0" style={{ color: 'var(--color-text)' }}>体温</span>
          <input
            className="input flex-1 text-sm"
            type="number"
            inputMode="decimal"
            step="0.1"
            placeholder="例：36.8"
            value={temperature}
            onChange={event => setTemperature(event.target.value)}
          />
          <span className="text-sm flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>℃</span>
        </div>

        <div>
          <p className="text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>機嫌</p>
          <div className="flex flex-wrap gap-1.5">
            {MOODS.map(item => {
              const active = mood === item
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setMood(active ? null : item)}
                  className="text-xs px-3 py-1.5 rounded-full font-medium"
                  style={active
                    ? { background: 'var(--color-primary)', color: '#fff' }
                    : { background: 'var(--color-card, #fff)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
                >
                  {MOOD_EMOJI[item]} {MOOD_LABEL[item]}
                </button>
              )
            })}
          </div>
        </div>

        <input
          className="input text-sm"
          placeholder="メモ（任意）"
          value={note}
          onChange={event => setNote(event.target.value)}
        />

        <button type="button" onClick={add} disabled={saving} className="btn-primary w-full text-sm py-2.5 disabled:opacity-60">
          {saving ? '記録中...' : '記録する'}
        </button>

        <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
          時刻が空のときは現在時刻を使います。
        </p>
      </div>
    </div>
  )
}
