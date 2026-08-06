import { describe, expect, it } from 'vitest'
import {
  MOODS,
  MOOD_LABEL,
  formatMinutes,
  isHighTemperature,
  isPlausibleTemperature,
  sleepMinutes,
  shortTime,
  timeToMinutes,
  toMood,
  totalSleepMinutes,
} from './baby-observation'

describe('機嫌', () => {
  it('5段階そろっていて、すべてに表示名がある', () => {
    expect(MOODS).toHaveLength(5)
    for (const mood of MOODS) {
      expect(MOOD_LABEL[mood].length).toBeGreaterThan(0)
    }
  })

  it('未知の値やnullはnullにする', () => {
    expect(toMood('good')).toBe('good')
    expect(toMood('unknown')).toBeNull()
    expect(toMood(null)).toBeNull()
  })
})

describe('体温', () => {
  it('ありえる範囲を判定する', () => {
    expect(isPlausibleTemperature(36.8)).toBe(true)
    expect(isPlausibleTemperature(33)).toBe(true)
    expect(isPlausibleTemperature(42)).toBe(true)
    expect(isPlausibleTemperature(3.68)).toBe(false)
    expect(isPlausibleTemperature(368)).toBe(false)
  })

  it('37.5℃以上を高めとする', () => {
    expect(isHighTemperature(37.4)).toBe(false)
    expect(isHighTemperature(37.5)).toBe(true)
  })
})

describe('時刻の変換', () => {
  it('分に直す', () => {
    expect(timeToMinutes('10:30')).toBe(630)
    expect(timeToMinutes('10:30:00')).toBe(630)
    expect(timeToMinutes('00:00')).toBe(0)
  })

  it('読めない値はnull', () => {
    expect(timeToMinutes(null)).toBeNull()
    expect(timeToMinutes('')).toBeNull()
    expect(timeToMinutes('あさ')).toBeNull()
    expect(timeToMinutes('25:00')).toBeNull()
    expect(timeToMinutes('10:75')).toBeNull()
  })

  it('秒を落として表示する', () => {
    expect(shortTime('10:30:00')).toBe('10:30')
    expect(shortTime(null)).toBe('')
  })
})

describe('睡眠時間', () => {
  it('開始と終了から長さを出す', () => {
    expect(sleepMinutes({ started_at: '10:20', ended_at: '12:05' })).toBe(105)
  })

  it('まだ起きていなければnull', () => {
    expect(sleepMinutes({ started_at: '10:20', ended_at: null })).toBeNull()
  })

  it('終了が開始より前なら数えない', () => {
    expect(sleepMinutes({ started_at: '12:00', ended_at: '10:00' })).toBeNull()
  })

  it('合計は、終了したものだけ数える', () => {
    const logs = [
      { started_at: '10:00', ended_at: '11:00' },
      { started_at: '13:00', ended_at: '13:30' },
      { started_at: '15:00', ended_at: null },
    ]
    expect(totalSleepMinutes(logs)).toBe(90)
  })

  it('1件も無ければ0', () => {
    expect(totalSleepMinutes([])).toBe(0)
  })
})

describe('formatMinutes', () => {
  it('読める形にする', () => {
    expect(formatMinutes(0)).toBe('0分')
    expect(formatMinutes(45)).toBe('45分')
    expect(formatMinutes(60)).toBe('1時間')
    expect(formatMinutes(90)).toBe('1時間30分')
    expect(formatMinutes(105)).toBe('1時間45分')
  })
})
