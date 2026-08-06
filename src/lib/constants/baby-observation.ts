// 訪問中の赤ちゃんの様子の記録（体温・機嫌・睡眠）で使う定数と計算。

export const MOODS = ['good', 'calm', 'fussy', 'crying', 'sleeping'] as const
export type Mood = (typeof MOODS)[number]

export const MOOD_LABEL: Record<Mood, string> = {
  good: '機嫌がよい',
  calm: '落ち着いている',
  fussy: 'ぐずり気味',
  crying: '泣いている',
  sleeping: '寝ている',
}

export const MOOD_EMOJI: Record<Mood, string> = {
  good: '😊',
  calm: '🙂',
  fussy: '😕',
  crying: '😢',
  sleeping: '😴',
}

export function toMood(value: string | null | undefined): Mood | null {
  return value && (MOODS as readonly string[]).includes(value) ? (value as Mood) : null
}

/** 体温が測定値としてありえる範囲か。入力ミスに気づけるようにする */
export function isPlausibleTemperature(value: number): boolean {
  return value >= 33 && value <= 42
}

/** 平熱より高いか。乳児は37.5℃以上を目安にする */
export function isHighTemperature(value: number): boolean {
  return value >= 37.5
}

/** "HH:MM" または "HH:MM:SS" を分に直す。読めなければ null */
export function timeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null
  const match = /^(\d{1,2}):(\d{2})/.exec(value)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

/**
 * 睡眠1件の長さ（分）。まだ起きていない、または時刻が読めなければ null。
 * 日をまたぐ訪問は想定していないので、終了が開始より前なら不正として扱う。
 */
export function sleepMinutes(log: { started_at: string; ended_at: string | null }): number | null {
  const start = timeToMinutes(log.started_at)
  const end = timeToMinutes(log.ended_at)
  if (start === null || end === null) return null
  const diff = end - start
  return diff >= 0 ? diff : null
}

/** 睡眠の合計（分）。終了していないものは数えない */
export function totalSleepMinutes(logs: { started_at: string; ended_at: string | null }[]): number {
  return logs.reduce((sum, log) => sum + (sleepMinutes(log) ?? 0), 0)
}

/** 90 → "1時間30分" のように読める形にする */
export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0分'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}分`
  if (rest === 0) return `${hours}時間`
  return `${hours}時間${rest}分`
}

/** "HH:MM:SS" を "HH:MM" に切り詰める */
export function shortTime(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : ''
}
