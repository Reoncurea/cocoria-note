import { describe, expect, it } from 'vitest'
import {
  PIPELINE_STAGES,
  STAGE_LIST,
  daysSince,
  getStage,
  isStale,
  nextStage,
  toStage,
} from './pipeline'

function daysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

describe('進行ステータスの定義', () => {
  it('15段階そろっていて、stepが1から順に振られている', () => {
    expect(STAGE_LIST).toHaveLength(15)
    STAGE_LIST.forEach((stage, index) => {
      expect(stage.step).toBe(index + 1)
    })
  })

  it('すべての段階に次のタスクが書かれている', () => {
    for (const stage of STAGE_LIST) {
      expect(stage.nextTask.length).toBeGreaterThan(0)
      expect(stage.nextTaskDetail.length).toBeGreaterThan(0)
    }
  })
})

describe('toStage', () => {
  it('既知の値はそのまま返す', () => {
    expect(toStage('contract_sent')).toBe('contract_sent')
  })

  it('未知の値やnullは問い合わせ扱いにする', () => {
    expect(toStage('unknown_stage')).toBe('inquiry')
    expect(toStage(null)).toBe('inquiry')
    expect(toStage(undefined)).toBe('inquiry')
  })
})

describe('nextStage', () => {
  it('1つ先の段階を返す', () => {
    expect(nextStage('inquiry')).toBe('form_received')
    expect(nextStage('paid')).toBe('day_before_confirmed')
  })

  it('最後の段階では次が無い', () => {
    expect(nextStage('completed')).toBeNull()
  })

  it('全段階をたどると最後にたどり着く', () => {
    let current: string | null = PIPELINE_STAGES[0]
    let steps = 0
    while (current && steps < 100) {
      current = nextStage(current)
      steps++
    }
    expect(steps).toBe(15)
  })
})

describe('daysSince', () => {
  it('経過日数を返す', () => {
    expect(daysSince(daysAgo(0))).toBe(0)
    expect(daysSince(daysAgo(5))).toBe(5)
  })

  it('日付が無い・壊れているときはnull', () => {
    expect(daysSince(null)).toBeNull()
    expect(daysSince('not-a-date')).toBeNull()
  })
})

describe('isStale', () => {
  it('目安日数を超えたら止まっている扱いにする', () => {
    // 問い合わせの目安は3日
    expect(isStale('inquiry', daysAgo(2))).toBe(false)
    expect(isStale('inquiry', daysAgo(3))).toBe(false)
    expect(isStale('inquiry', daysAgo(4))).toBe(true)
  })

  it('完了・継続利用は何日たっても対象外', () => {
    expect(getStage('completed').staleAfterDays).toBe(0)
    expect(isStale('completed', daysAgo(365))).toBe(false)
  })

  it('更新日時が無ければ判定しない', () => {
    expect(isStale('inquiry', null)).toBe(false)
  })
})
