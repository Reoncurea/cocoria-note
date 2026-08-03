// 顧客ごとの進行ステータス（15段階）と、各段階で次にやることの定義。
// DB側は customers.pipeline_stage に key を保存する。
// 段階を増やすときは、ここと migration の check 制約の両方を直すこと。
//
// 請求のタイミングは契約形態で変わる（2026-08-02 ユーザー確認）
//   スポット契約・初回利用 … アンケート送付済みのあとに請求する
//   定期利用             … 月末にまとめて請求する。訪問ごとの流れでは請求しない
// そのため「請求済み」「入金済み」は spotOnly とし、
// 定期利用の顧客では次の段階への案内から外す。

export const PIPELINE_STAGES = [
  'inquiry',
  'form_received',
  'transport_check',
  'scheduling',
  'schedule_fixed',
  'contract_sent',
  'contract_signed',
  'day_before_confirmed',
  'visit_done',
  'report_sent',
  'survey_sent',
  'invoiced',
  'paid',
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
  /** 定期利用の顧客のときに差し替える「次のタスク」 */
  nextTaskRecurring?: string
  nextTaskDetailRecurring?: string
  /** この段階に留まってよい日数の目安。超えたらアラートを出す */
  staleAfterDays: number
  /** バッジの配色 */
  tone: 'lead' | 'prep' | 'contract' | 'money' | 'visit' | 'after' | 'done'
  /** 次のタスクから飛べる顧客配下のパス（'' は顧客詳細） */
  href?: string
  /** スポット契約・初回利用だけで通る段階。定期利用では飛ばす */
  spotOnly?: boolean
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
    nextTask: '訪問前日の確認連絡をする',
    nextTaskDetail: '契約履歴を登録したうえで、訪問日時・持参物・当日の希望を前日までに確認します。訪問前チェックの記入もここで。',
    staleAfterDays: 14,
    tone: 'visit',
    href: '/visits',
  },
  day_before_confirmed: {
    key: 'day_before_confirmed',
    step: 8,
    label: '前日確認済み',
    nextTask: '訪問して記録を取る',
    nextTaskDetail: '訪問チェックリストに沿って進め、開始時刻・実施内容・ヒヤリハットを記録します。',
    staleAfterDays: 3,
    tone: 'visit',
    href: '/visits',
  },
  visit_done: {
    key: 'visit_done',
    step: 9,
    label: '訪問完了',
    nextTask: '報告書を作成して送付する',
    nextTaskDetail: '訪問記録を確定してPDF報告書を作り、お礼メッセージと一緒に送ります。',
    staleAfterDays: 2,
    tone: 'after',
    href: '/visits',
  },
  report_sent: {
    key: 'report_sent',
    step: 10,
    label: '報告書送付済み',
    nextTask: 'アンケートを送る',
    nextTaskDetail: '満足度アンケートのURLを送り、回答期限を添えます。',
    staleAfterDays: 3,
    tone: 'after',
  },
  survey_sent: {
    key: 'survey_sent',
    step: 11,
    label: 'アンケート送付済み',
    nextTask: '請求書を発行して送る',
    nextTaskDetail: 'スポット契約・初回利用は、ここで請求します。利用プランと交通費を合算した請求書を送ります。',
    nextTaskRecurring: '次回のご利用を案内する',
    nextTaskDetailRecurring: '定期利用のため、請求は月末にまとめて行います。ここでは次回の日程を案内します。',
    staleAfterDays: 3,
    tone: 'money',
    href: '/billing',
  },
  invoiced: {
    key: 'invoiced',
    step: 12,
    label: '請求済み',
    nextTask: '入金を確認する',
    nextTaskDetail: '入金の有無を確認し、請求画面の入金済みにチェックを入れます。',
    staleAfterDays: 7,
    tone: 'money',
    href: '/billing',
    spotOnly: true,
  },
  paid: {
    key: 'paid',
    step: 13,
    label: '入金済み',
    nextTask: '次回のご利用を案内する',
    nextTaskDetail: '空き日程と継続プランを案内します。アンケート回答があれば内容を確認します。',
    staleAfterDays: 5,
    tone: 'after',
    spotOnly: true,
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
    nextTaskDetailRecurring: '定期利用のため、月末の請求を忘れないでください。次の訪問が決まったら「日程確定」に戻します。',
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

/** その顧客で使う段階だけ。定期利用では請求・入金を飛ばす */
export function stagesFor(isRecurring: boolean | null | undefined): StageDefinition[] {
  return isRecurring ? STAGE_LIST.filter(stage => !stage.spotOnly) : STAGE_LIST
}

/**
 * 1つ進んだ段階。最後の段階ならnull。
 * 定期利用の顧客では「請求済み」「入金済み」を飛ばす。
 */
export function nextStage(
  value: string | null | undefined,
  isRecurring?: boolean | null,
): PipelineStage | null {
  const current = getStage(value)
  const usable = stagesFor(isRecurring)
  const index = usable.findIndex(stage => stage.key === current.key)

  // いま spotOnly の段階にいる定期利用顧客（設定変更後など）は、
  // 表示順で次に来る使える段階へ送る
  if (index === -1) {
    return usable.find(stage => stage.step > current.step)?.key ?? null
  }

  return usable[index + 1]?.key ?? null
}

/** 定期利用かどうかで文言が変わる「次のタスク」 */
export function nextTaskFor(
  value: string | null | undefined,
  isRecurring?: boolean | null,
): { task: string; detail: string } {
  const stage = getStage(value)
  return {
    task: (isRecurring && stage.nextTaskRecurring) || stage.nextTask,
    detail: (isRecurring && stage.nextTaskDetailRecurring) || stage.nextTaskDetail,
  }
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
 * 保留中かどうかは見ないので、通知の判定には needsFollowUp を使うこと。
 */
export function isStale(stageValue: string | null | undefined, stageUpdatedAt: string | null | undefined): boolean {
  const stage = getStage(stageValue)
  if (stage.staleAfterDays <= 0) return false
  const days = daysSince(stageUpdatedAt)
  return days !== null && days > stage.staleAfterDays
}

// ===== 保留・待ち =====
// 進行ステータスとは別軸。止めている間も段階はそのまま残るので、
// 解除すれば元の段階から再開できる。

export const HOLD_STATES = ['active', 'waiting', 'paused'] as const
export type HoldState = (typeof HOLD_STATES)[number]

export type CustomerHold = {
  hold_state?: string | null
  hold_reason?: string | null
  hold_until?: string | null
}

export const HOLD_LABEL: Record<HoldState, string> = {
  active: '通常',
  waiting: '待ち',
  paused: '保留',
}

export const HOLD_DESCRIPTION: Record<HoldState, string> = {
  active: '通常どおり追いかけます。',
  waiting: '出産の連絡待ちなど、そのうち動く見込みがあるもの。',
  paused: '契約に至らなかったなど、こちらからは追わないもの。',
}

export const HOLD_TONE_STYLE: Record<HoldState, { background: string; color: string }> = {
  active:  { background: 'transparent', color: 'var(--color-text-muted)' },
  waiting: { background: '#e0f2fe', color: '#075985' },
  paused:  { background: '#f3f4f6', color: '#4b5563' },
}

export function toHoldState(value: string | null | undefined): HoldState {
  return value && (HOLD_STATES as readonly string[]).includes(value)
    ? (value as HoldState)
    : 'active'
}

/** 今日の日付（YYYY-MM-DD）。DBのdate型と文字列で比べるため */
function todayKey(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/**
 * いま止めているか。
 * hold_until を過ぎていれば、自動的に通常へ戻ったものとして扱う。
 */
export function isOnHold(customer: CustomerHold): boolean {
  const state = toHoldState(customer.hold_state)
  if (state === 'active') return false
  if (customer.hold_until && customer.hold_until <= todayKey()) return false
  return true
}

/** hold_until を過ぎて、追跡に戻ってきたところか */
export function isHoldExpired(customer: CustomerHold): boolean {
  const state = toHoldState(customer.hold_state)
  if (state === 'active') return false
  return Boolean(customer.hold_until && customer.hold_until <= todayKey())
}

/**
 * いま対応が必要か。アラート・通知の判定はすべてこれを使う。
 * 保留中は、何日たっても対応不要として扱う。
 */
export function needsFollowUp(
  customer: CustomerHold & {
    pipeline_stage?: string | null
    stage_updated_at?: string | null
  },
): boolean {
  if (isOnHold(customer)) return false
  return isStale(customer.pipeline_stage, customer.stage_updated_at)
}
