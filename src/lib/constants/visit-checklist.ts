// 訪問チェックリストの項目定義。
// チェックの状態は visits.checklist（JSONB）に { 項目ID: { checked, note, time } } の形で入る。
// 項目を増減してもDB変更は不要。ここが正本。

/** 自動表示するデータの取り出し元 */
export type ChecklistSource =
  /** 訪問日・開始/終了時刻（visits） */
  | { kind: 'visit_datetime' }
  /** 住所・最寄駅（customers）。Googleマップのボタンを出す */
  | { kind: 'address' }
  /** 交通経路・交通費（customers） */
  | { kind: 'route' }
  /** 契約の締結状況（customer_contracts / pipeline_stage） */
  | { kind: 'contract' }
  /** 請求・入金の状況（billing / visit_billing） */
  | { kind: 'payment' }
  /** 前回訪問の内容（visits / service_records） */
  | { kind: 'last_visit' }
  /** プランニング回答から拾う。[セクションID, 質問ID] の並び */
  | { kind: 'planning'; paths: [string, string][] }

export type ChecklistItem = {
  id: string
  label: string
  /** メモ欄を出すか */
  note?: boolean
  placeholder?: string
  /** 時刻入力を出すか */
  time?: boolean
  /** 参照用に自動表示する情報 */
  source?: ChecklistSource
}

export type ChecklistPhase = {
  id: 'pre' | 'start' | 'during' | 'end' | 'after'
  title: string
  description: string
  items: ChecklistItem[]
}

export const CHECKLIST_PHASES: ChecklistPhase[] = [
  {
    id: 'pre',
    title: '訪問前チェック',
    description: '訪問の前日までに確認します。カルテとプランニング情報から自動で表示されます。',
    items: [
      { id: 'pre_datetime', label: '訪問日時', source: { kind: 'visit_datetime' } },
      { id: 'pre_address', label: '住所・最寄駅', source: { kind: 'address' } },
      { id: 'pre_route', label: '交通経路・交通費', source: { kind: 'route' } },
      {
        id: 'pre_plan',
        label: '利用プラン・利用時間',
        source: { kind: 'planning', paths: [['partner_support', 'support_time'], ['partner_support', 'support_frequency']] },
      },
      { id: 'pre_contract', label: '契約締結確認', source: { kind: 'contract' } },
      { id: 'pre_payment', label: '支払い確認', source: { kind: 'payment' } },
      {
        id: 'pre_support',
        label: '希望するサポート内容',
        source: { kind: 'planning', paths: [['partner_support', 'desired_support']] },
      },
      {
        id: 'pre_priority',
        label: '優先順位',
        note: true,
        placeholder: '例：1. 作り置き 2. 沐浴サポート 3. 洗濯',
      },
      {
        id: 'pre_allergy',
        label: 'アレルギー・苦手なもの',
        source: {
          kind: 'planning',
          paths: [
            ['family_mama', 'mama_allergy'],
            ['family_papa', 'papa_allergy'],
            ['family_children', 'child_allergy'],
            ['housework_meal', 'mama_dislikes'],
            ['housework_meal', 'papa_dislikes'],
          ],
        },
      },
      {
        id: 'pre_children',
        label: '赤ちゃん・上のお子さまの情報',
        source: {
          kind: 'planning',
          paths: [
            ['baby_info', 'baby_name'],
            ['baby_info', 'baby_birth_date'],
            ['baby_info', 'baby_notes'],
            ['family_children', 'child_name'],
            ['family_children', 'child_school'],
          ],
        },
      },
      {
        id: 'pre_emergency',
        label: '緊急連絡先',
        source: {
          kind: 'planning',
          paths: [
            ['emergency', 'emergency_1_name'],
            ['emergency', 'emergency_1_relation'],
            ['emergency', 'emergency_1_phone'],
            ['emergency', 'emergency_2_name'],
            ['emergency', 'emergency_2_phone'],
          ],
        },
      },
      {
        id: 'pre_pet',
        label: 'ペット・入室時の注意',
        note: true,
        placeholder: '例：犬あり。リビングのみ立ち入り可',
        source: { kind: 'planning', paths: [['partner_support', 'no_go_zones']] },
      },
      {
        id: 'pre_photo_consent',
        label: '写真同意の内容',
        note: true,
        placeholder: '例：赤ちゃんの顔出しOK・SNS掲載は不可',
      },
      {
        id: 'pre_bring',
        label: '持参物',
        note: true,
        placeholder: '例：エプロン、三角巾、上履き、母子手帳ケース',
      },
    ],
  },
  {
    id: 'start',
    title: '訪問開始時チェック',
    description: 'お宅に着いて、作業を始める前に確認します。',
    items: [
      { id: 'start_condition', label: '本日の体調確認', note: true, placeholder: '睡眠・食欲・痛みなど' },
      { id: 'start_baby', label: '赤ちゃんの様子確認', note: true, placeholder: '授乳間隔・睡眠・機嫌など' },
      { id: 'start_request', label: '本日の希望を再確認', note: true },
      { id: 'start_priority', label: '優先順位を確認', note: true },
      { id: 'start_available', label: '使用可能な場所・物を確認', note: true, placeholder: 'キッチン・洗濯機・掃除機など' },
      { id: 'start_end_time', label: '終了希望時刻を確認', time: true },
      { id: 'start_photo', label: '写真撮影可否を再確認', note: true },
    ],
  },
  {
    id: 'during',
    title: '訪問中の記録',
    description: '作業しながら記録します。ここの内容は報告書のもとになります。',
    items: [
      { id: 'during_start_time', label: '開始時刻', time: true },
      { id: 'during_work', label: '実施した作業', note: true, placeholder: '掃除・洗濯・調理など' },
      { id: 'during_meal', label: '料理名・保存方法', note: true, placeholder: '例：筑前煮（冷蔵3日）、鮭の塩麹漬け（冷凍2週間）' },
      { id: 'during_baby_care', label: '赤ちゃんのお世話や見守り内容', note: true },
      { id: 'during_confirm', label: '依頼者への確認事項', note: true },
      { id: 'during_change', label: '変更・追加依頼', note: true },
      { id: 'during_near_miss', label: 'ヒヤリハット', note: true, placeholder: '起きたこと・原因・その場の対応' },
      { id: 'during_incident', label: '破損・事故・体調変化', note: true, placeholder: '無ければ「なし」と記入' },
    ],
  },
  {
    id: 'end',
    title: '訪問終了時チェック',
    description: '帰る前に、ご依頼主と一緒に確認します。',
    items: [
      { id: 'end_report', label: '実施内容の報告', note: true },
      { id: 'end_incomplete', label: '未完了内容の説明', note: true, placeholder: '無ければ「なし」と記入' },
      { id: 'end_meal_guide', label: '料理の保存・温め方説明' },
      { id: 'end_restore', label: '使用物を元に戻したか' },
      { id: 'end_belongings', label: '忘れ物確認' },
      { id: 'end_damage', label: '破損・汚損確認', note: true, placeholder: '無ければ「なし」と記入' },
      { id: 'end_time', label: '終了時刻', time: true },
      { id: 'end_next', label: '次回希望確認', note: true },
      { id: 'end_report_notice', label: '報告書を後ほど送る旨の案内' },
    ],
  },
  {
    id: 'after',
    title: '帰宅後チェック',
    description: '帰宅後に片づける事務作業です。ここまで終えて1件完了になります。',
    items: [
      { id: 'after_record', label: '訪問記録確定' },
      { id: 'after_pdf', label: 'PDF報告書作成' },
      { id: 'after_send', label: '報告書送付' },
      { id: 'after_thanks', label: 'お礼メッセージ送付' },
      { id: 'after_survey', label: 'アンケート送付' },
      { id: 'after_expense', label: '交通費・経費登録', note: true, placeholder: '例：往復1,240円' },
      { id: 'after_sales', label: '売上登録', note: true },
      { id: 'after_next_booking', label: '次回予約登録' },
      { id: 'after_near_miss_review', label: 'ヒヤリハットの振り返り', note: true, placeholder: '無ければ「なし」と記入' },
    ],
  },
]

/** JSONBに入る1項目分の状態 */
export type ChecklistEntry = {
  checked?: boolean
  note?: string
  time?: string
}

export type ChecklistState = Record<string, ChecklistEntry>

export const CHECKLIST_PHASE_IDS = CHECKLIST_PHASES.map(p => p.id)

/** 想定外の値が入っていても落ちないように整える */
export function normalizeChecklist(value: unknown): ChecklistState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const source = value as Record<string, unknown>
  const result: ChecklistState = {}

  for (const phase of CHECKLIST_PHASES) {
    for (const item of phase.items) {
      const entry = source[item.id]
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
      const record = entry as Record<string, unknown>
      result[item.id] = {
        checked: record.checked === true,
        note: typeof record.note === 'string' ? record.note : undefined,
        time: typeof record.time === 'string' ? record.time : undefined,
      }
    }
  }

  return result
}

/** そのフェーズの進捗（チェック済み / 全体） */
export function phaseProgress(phase: ChecklistPhase, state: ChecklistState): { done: number; total: number } {
  const done = phase.items.filter(item => state[item.id]?.checked).length
  return { done, total: phase.items.length }
}

/** 全フェーズ合計の進捗 */
export function totalProgress(state: ChecklistState): { done: number; total: number } {
  return CHECKLIST_PHASES.reduce(
    (acc, phase) => {
      const { done, total } = phaseProgress(phase, state)
      return { done: acc.done + done, total: acc.total + total }
    },
    { done: 0, total: 0 },
  )
}
