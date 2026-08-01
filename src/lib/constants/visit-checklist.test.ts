import { describe, expect, it } from 'vitest'
import {
  CHECKLIST_PHASES,
  normalizeChecklist,
  phaseProgress,
  totalProgress,
} from './visit-checklist'

describe('訪問チェックリストの定義', () => {
  it('5つのフェーズがある', () => {
    expect(CHECKLIST_PHASES.map(p => p.id)).toEqual(['pre', 'start', 'during', 'end', 'after'])
  })

  it('項目IDが全体で重複していない', () => {
    const ids = CHECKLIST_PHASES.flatMap(phase => phase.items.map(item => item.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('normalizeChecklist', () => {
  it('想定外の値が来ても空オブジェクトを返す', () => {
    expect(normalizeChecklist(null)).toEqual({})
    expect(normalizeChecklist('文字列')).toEqual({})
    expect(normalizeChecklist([1, 2, 3])).toEqual({})
  })

  it('定義に無い項目IDは捨てる', () => {
    const result = normalizeChecklist({
      pre_datetime: { checked: true },
      不正な項目: { checked: true },
    })
    expect(result.pre_datetime?.checked).toBe(true)
    expect(result['不正な項目']).toBeUndefined()
  })

  it('checkedがtrue以外なら未チェックにする', () => {
    const result = normalizeChecklist({
      pre_datetime: { checked: 'yes' },
      pre_address: { checked: 1 },
    })
    expect(result.pre_datetime?.checked).toBe(false)
    expect(result.pre_address?.checked).toBe(false)
  })

  it('note と time は文字列のときだけ残す', () => {
    const result = normalizeChecklist({
      pre_priority: { checked: true, note: '料理優先', time: 123 },
    })
    expect(result.pre_priority?.note).toBe('料理優先')
    expect(result.pre_priority?.time).toBeUndefined()
  })
})

describe('進捗の集計', () => {
  it('フェーズごとにチェック済み件数を数える', () => {
    const pre = CHECKLIST_PHASES[0]
    const state = normalizeChecklist({
      [pre.items[0].id]: { checked: true },
      [pre.items[1].id]: { checked: true },
      [pre.items[2].id]: { checked: false },
    })
    expect(phaseProgress(pre, state)).toEqual({ done: 2, total: pre.items.length })
  })

  it('全体の合計は各フェーズの合計と一致する', () => {
    const expectedTotal = CHECKLIST_PHASES.reduce((sum, phase) => sum + phase.items.length, 0)
    expect(totalProgress({})).toEqual({ done: 0, total: expectedTotal })
  })
})
