'use client'

import { useEffect, useMemo, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  formatMinutes,
  shortTime,
  sleepMinutes,
  totalSleepMinutes,
} from '@/lib/constants/baby-observation'
import type { SleepLog } from '@/types/database'

// 「寝た」「起きた」を押すだけで睡眠時間を残す。
// 訪問中に何度でも記録でき、合計時間は自動で出す。

function nowTime() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export default function SleepLogPanel({
  visitId,
  initialLogs,
}: {
  visitId: string
  initialLogs: SleepLog[]
}) {
  const supabase = useMemo(() => createClient(), [])
  const [logs, setLogs] = useState<SleepLog[]>(initialLogs)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 別の画面から戻ってきたときに古い状態が出ないよう、開いた時点で取り直す
  useEffect(() => {
    let ignore = false

    async function sync() {
      const { data } = await supabase
        .from('sleep_logs')
        .select('*')
        .eq('visit_id', visitId)
        .order('started_at')
      if (!ignore && data) setLogs(data)
    }

    void sync()
    return () => { ignore = true }
  }, [supabase, visitId])

  /** まだ起きていない記録。あれば「起きた」を出す */
  const openLog = logs.find(log => !log.ended_at) ?? null
  const total = totalSleepMinutes(logs)

  async function startSleep() {
    setSaving(true)
    setError(null)

    const { data, error: insertError } = await supabase
      .from('sleep_logs')
      .insert({ visit_id: visitId, started_at: nowTime(), ended_at: null, note: null })
      .select()
      .single()

    setSaving(false)
    if (insertError || !data) {
      setError('記録できませんでした。通信環境を確認してください。')
      return
    }
    setLogs(prev => [...prev, data])
  }

  async function endSleep() {
    if (!openLog) return
    setSaving(true)
    setError(null)

    const endedAt = nowTime()
    const { data, error: updateError } = await supabase
      .from('sleep_logs')
      .update({ ended_at: endedAt })
      .eq('id', openLog.id)
      .select()
      .single()

    setSaving(false)
    if (updateError || !data) {
      setError('記録できませんでした。通信環境を確認してください。')
      return
    }
    setLogs(prev => prev.map(log => log.id === openLog.id ? data : log))
  }

  async function updateTime(logId: string, field: 'started_at' | 'ended_at', value: string) {
    setLogs(prev => prev.map(log => log.id === logId ? { ...log, [field]: value || null } : log))
    await supabase.from('sleep_logs').update({ [field]: value || null }).eq('id', logId)
  }

  async function removeLog(logId: string) {
    const previous = logs
    setLogs(prev => prev.filter(log => log.id !== logId))
    const { error: deleteError } = await supabase.from('sleep_logs').delete().eq('id', logId)
    if (deleteError) {
      setLogs(previous)
      setError('削除できませんでした。')
    }
  }

  return (
    <div className="space-y-3 pt-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold" style={{ color: 'var(--color-primary-dark)' }}>睡眠</p>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {total > 0 ? `合計 ${formatMinutes(total)}` : '記録なし'}
        </span>
      </div>

      {error && (
        <p className="text-xs px-3 py-2 rounded-lg" style={{ background: '#fef2f2', color: '#dc2626' }}>{error}</p>
      )}

      {logs.length > 0 && (
        <div className="space-y-1.5">
          {logs.map(log => {
            const minutes = sleepMinutes(log)
            return (
              <div key={log.id} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm flex-wrap"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <input
                  type="time"
                  className="input text-sm"
                  style={{ width: '6.5rem', padding: '4px 8px' }}
                  value={shortTime(log.started_at)}
                  onChange={event => updateTime(log.id, 'started_at', event.target.value)}
                />
                <span style={{ color: 'var(--color-text-muted)' }}>〜</span>
                <input
                  type="time"
                  className="input text-sm"
                  style={{ width: '6.5rem', padding: '4px 8px' }}
                  value={shortTime(log.ended_at)}
                  onChange={event => updateTime(log.id, 'ended_at', event.target.value)}
                />
                <span className="text-xs flex-1" style={{ color: minutes === null ? '#c2410c' : 'var(--color-text-muted)' }}>
                  {minutes === null ? '睡眠中' : formatMinutes(minutes)}
                </span>
                <button
                  type="button"
                  onClick={() => removeLog(log.id)}
                  className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-xs"
                  style={{ background: '#fef2f2', color: '#dc2626' }}
                  aria-label="この睡眠記録を削除"
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      )}

      {openLog ? (
        <button type="button" onClick={endSleep} disabled={saving} className="btn-primary w-full text-sm py-3 disabled:opacity-60">
          <Sun size={15} className="inline mr-1" />
          {saving ? '記録中...' : `起きた（${shortTime(openLog.started_at)} から睡眠中）`}
        </button>
      ) : (
        <button type="button" onClick={startSleep} disabled={saving} className="btn-secondary w-full text-sm py-3 disabled:opacity-60">
          <Moon size={15} className="inline mr-1" />
          {saving ? '記録中...' : '寝た'}
        </button>
      )}

      <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
        押すとその時刻で記録されます。時刻は後から直せます。
      </p>
    </div>
  )
}
