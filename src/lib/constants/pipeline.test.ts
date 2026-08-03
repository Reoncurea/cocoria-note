import { describe, expect, it } from 'vitest'
import {
  PIPELINE_STAGES,
  STAGE_LIST,
  daysSince,
  getStage,
  isHoldExpired,
  isOnHold,
  isStale,
  needsFollowUp,
  nextStage,
  nextTaskFor,
  stagesFor,
  toHoldState,
  toStage,
} from './pipeline'

function daysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

/** YYYY-MM-DD 形式で、今日から days 日ずらした日付 */
function dateKey(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** 放置されている（本来なら対応が必要な）顧客 */
const staleCustomer = { pipeline_stage: 'inquiry', stage_updated_at: daysAgo(30) }

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

describe('段階の並び順（2026-08-02 修正）', () => {
  it('契約締結済みの次は前日確認済み', () => {
    expect(nextStage('contract_signed')).toBe('day_before_confirmed')
  })

  it('請求はアンケート送付済みのあと', () => {
    expect(nextStage('survey_sent')).toBe('invoiced')
    expect(nextStage('invoiced')).toBe('paid')
    expect(nextStage('paid')).toBe('next_offered')
  })

  it('訪問まわりが契約と報告書の間に並んでいる', () => {
    const order: string[] = STAGE_LIST.map(s => s.key)
    const at = (key: string) => order.indexOf(key)
    expect(at('contract_signed')).toBeLessThan(at('day_before_confirmed'))
    expect(at('day_before_confirmed')).toBeLessThan(at('visit_done'))
    expect(at('visit_done')).toBeLessThan(at('report_sent'))
    expect(at('report_sent')).toBeLessThan(at('survey_sent'))
    expect(at('survey_sent')).toBeLessThan(at('invoiced'))
  })
})

describe('nextStage', () => {
  it('1つ先の段階を返す', () => {
    expect(nextStage('inquiry')).toBe('form_received')
  })

  it('最後の段階では次が無い', () => {
    expect(nextStage('completed')).toBeNull()
    expect(nextStage('completed', true)).toBeNull()
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

describe('定期利用の扱い（月末請求）', () => {
  it('請求済み・入金済みを飛ばす', () => {
    expect(nextStage('survey_sent', true)).toBe('next_offered')
  })

  it('スポット契約では飛ばさない', () => {
    expect(nextStage('survey_sent', false)).toBe('invoiced')
  })

  it('定期利用で使う段階は13個', () => {
    expect(stagesFor(true)).toHaveLength(13)
    expect(stagesFor(false)).toHaveLength(15)
    expect(stagesFor(true).map(s => s.key)).not.toContain('invoiced')
    expect(stagesFor(true).map(s => s.key)).not.toContain('paid')
  })

  it('定期利用でも全段階をたどれば最後にたどり着く', () => {
    let current: string | null = PIPELINE_STAGES[0]
    let steps = 0
    while (current && steps < 100) {
      current = nextStage(current, true)
      steps++
    }
    expect(steps).toBe(13)
  })

  it('飛ばす段階に手動で入っていても、次へ進める', () => {
    // 設定を後から定期利用に変えた顧客が請求済みで止まっている場合
    expect(nextStage('invoiced', true)).toBe('next_offered')
    expect(nextStage('paid', true)).toBe('next_offered')
  })

  it('アンケート送付済みの次のタスクが契約形態で変わる', () => {
    expect(nextTaskFor('survey_sent', false).task).toContain('請求書')
    expect(nextTaskFor('survey_sent', true).task).toContain('次回')
    expect(nextTaskFor('survey_sent', true).detail).toContain('月末')
  })

  it('契約形態で変わらない段階は同じ文言になる', () => {
    expect(nextTaskFor('inquiry', true).task).toBe(nextTaskFor('inquiry', false).task)
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

describe('保留・待ち', () => {
  it('未知の値は通常扱いにする', () => {
    expect(toHoldState(null)).toBe('active')
    expect(toHoldState('unknown')).toBe('active')
    expect(toHoldState('paused')).toBe('paused')
  })

  it('通常は保留ではない', () => {
    expect(isOnHold({ hold_state: 'active' })).toBe(false)
    expect(isOnHold({})).toBe(false)
  })

  it('日付なしの保留は止まったまま', () => {
    expect(isOnHold({ hold_state: 'paused' })).toBe(true)
    expect(isOnHold({ hold_state: 'waiting' })).toBe(true)
  })

  it('再開予定日が未来なら止まったまま', () => {
    expect(isOnHold({ hold_state: 'waiting', hold_until: dateKey(7) })).toBe(true)
  })

  it('再開予定日が来たら自動で戻る', () => {
    expect(isOnHold({ hold_state: 'waiting', hold_until: dateKey(0) })).toBe(false)
    expect(isOnHold({ hold_state: 'waiting', hold_until: dateKey(-1) })).toBe(false)
    expect(isHoldExpired({ hold_state: 'waiting', hold_until: dateKey(-1) })).toBe(true)
    expect(isHoldExpired({ hold_state: 'waiting', hold_until: dateKey(7) })).toBe(false)
  })
})

describe('needsFollowUp', () => {
  it('放置されていれば対応が必要', () => {
    expect(needsFollowUp(staleCustomer)).toBe(true)
  })

  it('保留中は何日たっても対応不要', () => {
    expect(needsFollowUp({ ...staleCustomer, hold_state: 'paused' })).toBe(false)
    expect(needsFollowUp({ ...staleCustomer, hold_state: 'waiting' })).toBe(false)
  })

  it('再開予定日を過ぎたら、また対応が必要になる', () => {
    expect(needsFollowUp({ ...staleCustomer, hold_state: 'waiting', hold_until: dateKey(7) })).toBe(false)
    expect(needsFollowUp({ ...staleCustomer, hold_state: 'waiting', hold_until: dateKey(-1) })).toBe(true)
  })

  it('保留を解除しても、放置されていなければ対応不要のまま', () => {
    expect(needsFollowUp({ pipeline_stage: 'inquiry', stage_updated_at: daysAgo(0) })).toBe(false)
  })

  it('完了した顧客は保留に関係なく対応不要', () => {
    expect(needsFollowUp({ pipeline_stage: 'completed', stage_updated_at: daysAgo(365) })).toBe(false)
  })
})
