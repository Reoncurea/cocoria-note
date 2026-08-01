// 訪問チェックリストの各項目に、カルテ・プランニング情報から拾った内容を添える。
// 「訪問前に何を見ればいいか」を毎回探しに行かなくて済むようにするのが目的。

import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import questionsConfig from '@/lib/planning/questions.json'
import type { Section } from '@/lib/planning/types'
import { CHECKLIST_PHASES, type ChecklistSource } from '@/lib/constants/visit-checklist'
import { mapDirectionsUrl, mapSearchUrl } from '@/lib/maps'
import { getStage } from '@/lib/constants/pipeline'

const sections = questionsConfig.sections as Section[]

/** [セクションID, 質問ID] → 質問ラベル */
const QUESTION_LABELS: Record<string, string> = Object.fromEntries(
  sections.flatMap(section =>
    section.questions.map(question => [`${section.id}.${question.id}`, question.label]),
  ),
)

export type ContextLine = { label: string; value: string }

export type ChecklistContext = {
  lines: ContextLine[]
  mapUrl?: string
  directionsUrl?: string
}

type PlanningAnswers = Record<string, Record<string, unknown>>

export type ChecklistContextInput = {
  visit: {
    visit_date: string
    start_time: string | null
    end_time: string | null
    transport: string | null
  }
  customer: {
    address: string | null
    nearest_station: string | null
    route_note: string | null
    transport_fee: number | null
    transport: string | null
    pipeline_stage: string | null
    recurring_note: string | null
    is_recurring: boolean | null
  }
  planningAnswers: PlanningAnswers
  billing: { contracted: boolean; invoiced: boolean; paid: boolean; amount: number | null } | null
  latestContract: { title: string; contracted_date: string } | null
  lastVisit: { visit_date: string; next_visit_notes: string | null; staff_message: string | null } | null
}

function formatValue(value: unknown): string {
  if (value == null || value === '') return ''
  if (Array.isArray(value)) return value.filter(Boolean).join('、')
  return String(value)
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return format(date, 'yyyy年M月d日（E）', { locale: ja })
}

function resolve(source: ChecklistSource, input: ChecklistContextInput): ChecklistContext {
  const lines: ContextLine[] = []

  switch (source.kind) {
    case 'visit_datetime': {
      lines.push({ label: '訪問日', value: formatDate(input.visit.visit_date) })
      if (input.visit.start_time) {
        lines.push({
          label: '時間',
          value: `${input.visit.start_time.slice(0, 5)}${input.visit.end_time ? ` 〜 ${input.visit.end_time.slice(0, 5)}` : ''}`,
        })
      }
      if (input.customer.is_recurring && input.customer.recurring_note) {
        lines.push({ label: '定期利用', value: input.customer.recurring_note })
      }
      return { lines }
    }

    case 'address': {
      if (input.customer.address) lines.push({ label: '住所', value: input.customer.address })
      if (input.customer.nearest_station) lines.push({ label: '最寄駅', value: input.customer.nearest_station })
      return {
        lines,
        mapUrl: mapSearchUrl(input.customer.address) ?? undefined,
        directionsUrl: mapDirectionsUrl(input.customer.address, { mode: 'transit' }) ?? undefined,
      }
    }

    case 'route': {
      const transport = input.visit.transport ?? input.customer.transport
      if (transport) lines.push({ label: '訪問手段', value: transport })
      if (input.customer.route_note) lines.push({ label: '経路', value: input.customer.route_note })
      if (input.customer.transport_fee != null) {
        lines.push({ label: '交通費', value: `${input.customer.transport_fee.toLocaleString()}円` })
      }
      return { lines }
    }

    case 'contract': {
      if (input.latestContract) {
        lines.push({
          label: '契約',
          value: `${input.latestContract.title}（${formatDate(input.latestContract.contracted_date)}）`,
        })
      } else {
        lines.push({ label: '契約', value: '契約履歴が登録されていません' })
      }
      lines.push({ label: '進行ステータス', value: getStage(input.customer.pipeline_stage).label })
      return { lines }
    }

    case 'payment': {
      if (!input.billing) {
        lines.push({ label: '請求', value: '請求情報が登録されていません' })
        return { lines }
      }
      lines.push({ label: '請求', value: input.billing.invoiced ? '請求済み' : '未請求' })
      lines.push({ label: '入金', value: input.billing.paid ? '入金済み' : '未入金' })
      if (input.billing.amount != null) {
        lines.push({ label: '金額', value: `${input.billing.amount.toLocaleString()}円` })
      }
      return { lines }
    }

    case 'last_visit': {
      if (!input.lastVisit) return { lines }
      lines.push({ label: '前回訪問', value: formatDate(input.lastVisit.visit_date) })
      if (input.lastVisit.next_visit_notes) {
        lines.push({ label: '申し送り', value: input.lastVisit.next_visit_notes })
      }
      return { lines }
    }

    case 'planning': {
      for (const [sectionId, questionId] of source.paths) {
        const value = formatValue(input.planningAnswers[sectionId]?.[questionId])
        if (!value) continue
        lines.push({
          label: QUESTION_LABELS[`${sectionId}.${questionId}`] ?? questionId,
          value,
        })
      }
      return { lines }
    }
  }
}

/** 項目IDごとの参照情報。中身が空の項目は入れない */
export function buildChecklistContext(input: ChecklistContextInput): Record<string, ChecklistContext> {
  const result: Record<string, ChecklistContext> = {}

  for (const phase of CHECKLIST_PHASES) {
    for (const item of phase.items) {
      if (!item.source) continue
      const context = resolve(item.source, input)
      if (context.lines.length === 0 && !context.mapUrl) continue
      result[item.id] = context
    }
  }

  return result
}
