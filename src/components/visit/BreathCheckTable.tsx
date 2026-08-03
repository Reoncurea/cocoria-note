'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { BreathCheck, BreathCheckCell } from '@/types/database'

// 呼吸チェック表。訪問中に5分ごとのマスを押していく使い方なので、
// 訪問記録の最後ではなく「訪問中の記録」の中に置いている。

const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

export default function BreathCheckTable({
  visitId,
  initialBreathCheck,
  initialCells,
}: {
  visitId: string
  initialBreathCheck: BreathCheck | null
  initialCells: BreathCheckCell[]
}) {
  const supabase = useMemo(() => createClient(), [])
  const [breathCheck, setBreathCheck] = useState<BreathCheck | null>(initialBreathCheck)
  const [cells, setCells] = useState<BreathCheckCell[]>(initialCells)
  const [addingHour, setAddingHour] = useState('')
  const [creating, setCreating] = useState(false)

  const hours = useMemo(
    () => Array.from(new Set(cells.map(c => c.hour_label))).sort(),
    [cells],
  )

  // 別の画面から戻ってきたときに古い状態が出ないよう、開いた時点で取り直す
  useEffect(() => {
    let ignore = false

    async function sync() {
      const { data: check } = await supabase
        .from('breath_checks')
        .select('*')
        .eq('visit_id', visitId)
        .maybeSingle()
      if (ignore || !check) return
      setBreathCheck(check)

      const { data: latestCells } = await supabase
        .from('breath_check_cells')
        .select('*')
        .eq('breath_check_id', check.id)
      if (!ignore && latestCells) setCells(latestCells)
    }

    void sync()
    return () => { ignore = true }
  }, [supabase, visitId])

  async function createBreathCheck() {
    setCreating(true)
    const { data } = await supabase.from('breath_checks').insert({ visit_id: visitId }).select().single()
    setCreating(false)
    if (data) setBreathCheck(data)
  }

  async function toggleCell(hourLabel: string, minute: number) {
    if (!breathCheck) return
    const existing = cells.find(c => c.hour_label === hourLabel && c.minute_value === minute)

    if (existing) {
      // 先に画面を変えて、押した手応えを止めない
      setCells(prev => prev.map(c => c.id === existing.id ? { ...c, checked: !c.checked } : c))
      await supabase.from('breath_check_cells').update({ checked: !existing.checked }).eq('id', existing.id)
      return
    }

    const { data } = await supabase.from('breath_check_cells').insert({
      breath_check_id: breathCheck.id,
      hour_label: hourLabel,
      minute_value: minute,
      checked: true,
    }).select().single()
    if (data) setCells(prev => [...prev, data])
  }

  async function addHour() {
    const raw = addingHour.trim()
    if (!raw || !breathCheck) return
    const label = raw.includes('時') ? raw : `${raw}時`
    if (hours.includes(label)) { setAddingHour(''); return }

    const { data } = await supabase.from('breath_check_cells').insert(
      MINUTES.map(m => ({
        breath_check_id: breathCheck.id,
        hour_label: label,
        minute_value: m,
        checked: false,
      })),
    ).select()
    if (data) setCells(prev => [...prev, ...data])
    setAddingHour('')
  }

  /** いまの時刻の時間帯をすぐ足せるようにする */
  async function addCurrentHour() {
    if (!breathCheck) return
    const label = `${new Date().getHours()}時`
    if (hours.includes(label)) return
    const { data } = await supabase.from('breath_check_cells').insert(
      MINUTES.map(m => ({
        breath_check_id: breathCheck.id,
        hour_label: label,
        minute_value: m,
        checked: false,
      })),
    ).select()
    if (data) setCells(prev => [...prev, ...data])
  }

  async function updateMemo(memo: string) {
    if (!breathCheck) return
    await supabase.from('breath_checks').update({ memo }).eq('id', breathCheck.id)
    setBreathCheck(prev => prev ? { ...prev, memo } : prev)
  }

  if (!breathCheck) {
    return (
      <div className="space-y-2 pt-1">
        <p className="text-xs font-bold" style={{ color: 'var(--color-primary-dark)' }}>呼吸チェック表</p>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          この訪問には呼吸チェック表がまだありません。
        </p>
        <button type="button" onClick={createBreathCheck} disabled={creating} className="btn-secondary w-full text-sm py-2.5 disabled:opacity-60">
          {creating ? '作成中...' : '呼吸チェック表を作る'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3 pt-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold" style={{ color: 'var(--color-primary-dark)' }}>呼吸チェック表</p>
        <button type="button" onClick={addCurrentHour} className="btn-secondary text-xs px-3 py-1.5">
          ＋ 今の時間帯
        </button>
      </div>

      {hours.length === 0 ? (
        <p className="text-xs text-center py-2" style={{ color: 'var(--color-text-muted)' }}>
          「＋ 今の時間帯」を押すか、下から時間帯を追加してください
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left py-1 px-2" style={{ color: 'var(--color-text-muted)', minWidth: '48px' }}>時間</th>
                {MINUTES.map(m => (
                  <th key={m} className="py-1 px-1 text-center" style={{ color: 'var(--color-text-muted)', minWidth: '28px' }}>
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hours.map(hour => (
                <tr key={hour}>
                  <td className="py-1 px-2 font-semibold text-xs" style={{ color: 'var(--color-text)' }}>{hour}</td>
                  {MINUTES.map(m => {
                    const cell = cells.find(c => c.hour_label === hour && c.minute_value === m)
                    const checked = cell?.checked ?? false
                    return (
                      <td key={m} className="py-1 px-1 text-center">
                        <button
                          type="button"
                          onClick={() => toggleCell(hour, m)}
                          className="w-6 h-6 rounded transition-colors"
                          style={{
                            background: checked ? '#86efac' : 'var(--color-surface)',
                            border: `1px solid ${checked ? '#4ade80' : 'var(--color-border)'}`,
                          }}
                          aria-label={`${hour}${m}分`}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-2">
        <input
          className="input flex-1 text-sm"
          placeholder="例：10（時）"
          value={addingHour}
          onChange={e => setAddingHour(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void addHour() } }}
        />
        <button type="button" onClick={addHour} className="btn-secondary text-sm px-3 flex-shrink-0">
          ＋ 時間帯
        </button>
      </div>

      <div>
        <label className="form-label">メモ（特記事項）</label>
        <textarea
          className="input text-sm"
          rows={2}
          defaultValue={breathCheck.memo ?? ''}
          onBlur={e => updateMemo(e.target.value)}
          placeholder="特記事項..."
        />
      </div>
    </div>
  )
}
