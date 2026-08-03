// 毎朝のアラート本文を組み立てる。
//
// 拾うもの
//   - 今日の訪問
//   - 明日の訪問（前日確認のリマインド）
//   - 同じステータスのまま止まっている顧客と、その「次のタスク」
//   - 未送信の報告書
//   - 未入金
//
// 定期実行から呼ぶため、ログイン中のユーザーがいない。
// そのため service role キーで読む。RLSを迂回するので、
// このモジュールはサーバー側からのみ呼ぶこと（クライアントに import しない）。

import { createClient } from '@supabase/supabase-js'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { getStage, isStale, nextTaskFor } from '@/lib/constants/pipeline'

const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_ORIGIN ?? 'https://note.cocoria.net'

type VisitRow = {
  id: string
  customer_id: string
  start_time: string | null
  visit_date: string
  customers: { name_kanji: string } | { name_kanji: string }[] | null
}

function name(value: VisitRow['customers']): string {
  if (Array.isArray(value)) return value[0]?.name_kanji ?? '不明'
  return value?.name_kanji ?? '不明'
}

function dateKey(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

export type DailyAlert = {
  /** LINEに送る本文。何も無ければ空文字 */
  text: string
  counts: {
    todayVisits: number
    tomorrowVisits: number
    stale: number
    unsentReports: number
    unpaid: number
  }
}

export async function buildDailyAlert(): Promise<DailyAlert> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error('Supabase credentials are not configured')
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const now = new Date()
  const tomorrowDate = new Date(now)
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)

  const today = dateKey(now)
  const tomorrow = dateKey(tomorrowDate)

  const [todayRes, tomorrowRes, unsentRes, unpaidRes, customersRes] = await Promise.all([
    supabase
      .from('visits')
      .select('id, customer_id, visit_date, start_time, customers(name_kanji)')
      .eq('visit_date', today)
      .order('start_time'),
    supabase
      .from('visits')
      .select('id, customer_id, visit_date, start_time, customers(name_kanji)')
      .eq('visit_date', tomorrow)
      .order('start_time'),
    supabase
      .from('visits')
      .select('id, customer_id, visit_date, start_time, customers(name_kanji)')
      .eq('report_sent', false)
      .lte('visit_date', today)
      .order('visit_date', { ascending: true })
      .limit(10),
    supabase
      .from('visit_billing')
      .select('id, customer_id, customers(name_kanji)')
      .eq('invoiced', true)
      .eq('paid', false)
      .limit(10),
    supabase
      .from('customers')
      .select('id, name_kanji, pipeline_stage, stage_updated_at, stage_note, is_recurring')
      .neq('pipeline_stage', 'completed')
      .order('stage_updated_at', { ascending: true }),
  ])

  const todayVisits = (todayRes.data ?? []) as VisitRow[]
  const tomorrowVisits = (tomorrowRes.data ?? []) as VisitRow[]
  const unsentReports = (unsentRes.data ?? []) as VisitRow[]
  const unpaid = (unpaidRes.data ?? []) as { id: string; customer_id: string; customers: VisitRow['customers'] }[]

  const stale = (customersRes.data ?? []).filter(c => isStale(c.pipeline_stage, c.stage_updated_at))

  const counts = {
    todayVisits: todayVisits.length,
    tomorrowVisits: tomorrowVisits.length,
    stale: stale.length,
    unsentReports: unsentReports.length,
    unpaid: unpaid.length,
  }

  const blocks: string[] = []

  if (todayVisits.length > 0) {
    blocks.push([
      '【今日の訪問】',
      ...todayVisits.map(v =>
        `・${v.start_time ? `${v.start_time.slice(0, 5)} ` : ''}${name(v.customers)}`,
      ),
    ].join('\n'))
  }

  if (tomorrowVisits.length > 0) {
    blocks.push([
      '【明日の訪問／前日確認】',
      ...tomorrowVisits.map(v =>
        `・${v.start_time ? `${v.start_time.slice(0, 5)} ` : ''}${name(v.customers)}`,
      ),
    ].join('\n'))
  }

  if (stale.length > 0) {
    blocks.push([
      '【止まっている案件】',
      ...stale.slice(0, 10).map(c => {
        const stage = getStage(c.pipeline_stage)
        const task = nextTaskFor(c.pipeline_stage, c.is_recurring)
        return `・${c.name_kanji}（${stage.label}）\n  → ${task.task}`
      }),
      ...(stale.length > 10 ? [`ほか${stale.length - 10}件`] : []),
    ].join('\n'))
  }

  if (unsentReports.length > 0) {
    blocks.push([
      '【報告書が未送信】',
      ...unsentReports.map(v =>
        `・${name(v.customers)}（${format(new Date(v.visit_date), 'M月d日', { locale: ja })}の訪問）`,
      ),
    ].join('\n'))
  }

  if (unpaid.length > 0) {
    blocks.push([
      '【未入金】',
      ...unpaid.map(b => `・${name(b.customers)}`),
    ].join('\n'))
  }

  if (blocks.length === 0) {
    return { text: '', counts }
  }

  const header = `cocoria note ${format(now, 'M月d日（E）', { locale: ja })}のお知らせ`
  const text = [header, '', ...blocks, '', APP_ORIGIN].join('\n')

  return { text, counts }
}
