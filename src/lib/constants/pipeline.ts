// 顧客ごとの進行ステータス（15段階）と、各段階で次にやることの定義。
// DB側は customers.pipeline_stage に key を保存する。
// 段階を増やすときは、ここと migration の check 制約の両方を直すこと。

export const PIPELINE_STAGES = [
  'inquiry',
  'form_received',
  'transport_check',
  'scheduling',
  'schedule_fixed',
  'contract_sent',
  'contract_signed',
  'invoiced',
  'paid',
  'day_before_confirmed',
  'visit_done',
  'report_sent',
  'survey_sent',
  'next_offered',
  'completed',
] as const

export type PipelineStage = (typeof PIPELINE_STAGES)[number]

export const DEFAULT_STAGE: PipelineStage = 'inquiry'

export type StageDefinition = {
  key: PipelineStage
  /** 1始まりの表示順 */
  step: number
  /** 一覧・バッジに出す名前 */
  label: string
  /** この段階で次にやること */
  nextTask: string
  /** 次のタスクの補足 */
  nextTaskDetail: string
  /** この段階に留まってよい日数の目安。超えたらアラートを出す */
  staleAfterDays: number
  /** バッジの配色 */
  tone: 'lead' | 'prep' | 'contract' | 'money' | 'visit' | 'after' | 'done'
  /** 次のタスクから飛べる顧客配下のパス（'' は顧客詳細） */
  href?: string
}

export const STAGE_DEFINITIONS: Record<PipelineStage, StageDefinition> = {
  inquiry: {
    key: 'inquiry',
    step: 1,
    label: '問い合わせ',
    nextTask: '申込フォームを案内する',
    nextTaskDetail: '公式LINEまたはメールで申込フォームのURLを送り、返信期限を伝えます。',
    staleAfterDays: 3,
    tone: 'lead',
  },
  form_received: {
    key: 'form_received',
    step: 2,
    label: '申込フォーム受領',
    nextTask: 'カルテに転記して交通費を確認する',
    nextTaskDetail: 'フォームの内容をカルテとプランニング情報に入力し、住所から最寄駅と交通費を調べます。',
    staleAfterDays: 3,
    tone: 'prep',
    href: '/edit',
  },
  transport_check: {
    key: 'transport_check',
    step: 3,
    label: '交通費確認中',
    nextTask: '交通経路と交通費を確定する',
    nextTaskDetail: '最寄駅・経路・往復の交通費をカルテに登録し、金額をご依頼主に共有します。',
    staleAfterDays: 3,
    tone: 'prep',
    href: '/edit',
  },
  scheduling: {
    key: 'scheduling',
    step: 4,
    label: '日程調整中',
    nextTask: '訪問日の候補を出して決める',
    nextTaskDetail: '候補日を3つ程度提示し、返信を待ちます。決まったら訪問予定を登録します。',
    staleAfterDays: 4,
    tone: 'prep',
    href: '/visits',
  },
  schedule_fixed: {
    key: 'schedule_fixed',
    step: 5,
    label: '日程確定',
    nextTask: '契約書を送付する',
    nextTaskDetail: '利用契約書の別表の料金で作成し、署名依頼を送ります。訪問予定の登録も忘れずに。',
    staleAfterDays: 2,
    tone: 'contract',
    href: '/visits',
  },
  contract_sent: {
    key: 'contract_sent',
    step: 6,
    label: '契約送付済み',
    nextTask: '契約の締結を確認する',
    nextTaskDetail: '署名済み契約書が返ってきたか確認します。届いていなければ催促します。',
    staleAfterDays: 5,
    tone: 'contract',
  },
  contract_signed: {
    key: 'contract_signed',
    step: 7,
    label: '契約締結済み',
    nextTask: '請求書を発行して送る',
    nextTaskDetail: '契約履歴を登録し、利用プランと交通費を合算した請求書を送ります。',
    staleAfterDays: 3,
    tone: 'money',
    href: '/billing',
  },
  invoiced: {
    key: 'invoiced',
    step: 8,
    label: '請求済み',
    nextTask: '入金を確認する',
    nextTaskDetail: '入金の有無を確認し、請求画面の入金済みにチェックを入れます。',
    staleAfterDays: 7,
    tone: 'money',
    href: '/billing',
  },
  paid: {
    key: 'paid',
    step: 9,
    label: '入金済み',
    nextTask: '訪問前日の確認連絡をする',
    nextTaskDetail: '訪問日時・持参物・当日の希望を前日までに確認します。訪問前チェックの記入もここで。',
    staleAfterDays: 14,
    tone: 'visit',
    href: '/visits',
  },
  day_before_confirmed: {
    key: 'day_before_confirmed',
    step: 10,
    label: '前日確認済み',
    nextTask: '訪問して記録を取る',
    nextTaskDetail: '訪問チェックリストに沿って進め、開始時刻・実施内容・ヒヤリハットを記録します。',
    staleAfterDays: 3,
    tone: 'visit',
    href: '/visits',
  },
  visit_done: {
    key: 'visit_done',
    step: 11,
    label: '訪問完了',
    nextTask: '報告書を作成して送付する',
    nextTaskDetail: '訪問記録を確定してPDF報告書を作り、お礼メッセージと一緒に送ります。',
    staleAfterDays: 2,
    tone: 'after',
    href: '/visits',
  },
  report_sent: {
    key: 'report_sent',
    step: 12,
    label: '報告書送付済み',
    nextTask: 'アンケートを送る',
    nextTaskDetail: '満足度アンケートのURLを送り、回答期限を添えます。',
    staleAfterDays: 3,
    tone: 'after',
  },
  survey_sent: {
    key: 'survey_sent',
    step: 13,
    label: 'アンケート送付済み',
    nextTask: '次回のご利用を案内する',
    nextTaskDetail: '空き日程と継続プランを案内します。アンケート回答があれば内容を確認します。',
    staleAfterDays: 5,
    tone: 'after',
  },
  next_offered: {
    key: 'next_offered',
    step: 14,
    label: '次回案内済み',
    nextTask: '返答を受けて次回予約か完了にする',
    nextTaskDetail: '継続するなら次回訪問を登録して日程調整へ戻します。しない場合は完了にします。',
    staleAfterDays: 7,
    tone: 'after',
    href: '/visits',
  },
  completed: {
    key: 'completed',
    step: 15,
    label: '完了・継続利用',
    nextTask: '対応中のタスクはありません',
    nextTaskDetail: '次の依頼が来たら、ステータスを「問い合わせ」または「日程調整中」に戻してください。',
    staleAfterDays: 0,
    tone: 'done',
  },
}

/** 表示順に並んだ段階定義 */
export const STAGE_LIST: StageDefinition[] = PIPELINE_STAGES.map(key => STAGE_DEFINITIONS[key])

/** DBから来た未知の値でも落ちないようにする */
export function toStage(value: string | null | undefined): PipelineStage {
  return value && (PIPELINE_STAGES as readonly string[]).includes(value)
    ? (value as PipelineStage)
    : DEFAULT_STAGE
}

export function getStage(value: string | null | undefined): StageDefinition {
  return STAGE_DEFINITIONS[toStage(value)]
}

/** 「3. 交通費確認中」のような表示 */
export function stageLabelWithStep(value: string | null | undefined): string {
  const stage = getStage(value)
  return `${stage.step}. ${stage.label}`
}

/** 1つ進んだ段階。最後の段階ならnull */
export function nextStage(value: string | null | undefined): PipelineStage | null {
  const stage = getStage(value)
  return PIPELINE_STAGES[stage.step] ?? null
}

export const STAGE_TONE_STYLE: Record<StageDefinition['tone'], { background: string; color: string }> = {
  lead:     { background: '#fce7f3', color: '#9d174d' },
  prep:     { background: '#fef3c7', color: '#92400e' },
  contract: { background: '#e0e7ff', color: '#3730a3' },
  money:    { background: '#fee2e2', color: '#991b1b' },
  visit:    { background: '#dbeafe', color: '#1e40af' },
  after:    { background: '#ede9fe', color: '#5b21b6' },
  done:     { background: '#dcfce7', color: '#166534' },
}

/**
 * 経過日数を返す。日付が無ければ null。
 */
export function daysSince(value: string | null | undefined): number | null {
  if (!value) return null
  const then = new Date(value)
  if (Number.isNaN(then.getTime())) return null
  const start = new Date(then)
  start.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - start.getTime()) / 86_400_000)
}

/**
 * この段階に留まりすぎていないか。完了段階は対象外。
 */
export function isStale(stageValue: string | null | undefined, stageUpdatedAt: string | null | undefined): boolean {
  const stage = getStage(stageValue)
  if (stage.staleAfterDays <= 0) return false
  const days = daysSince(stageUpdatedAt)
  return days !== null && days > stage.staleAfterDays
}
