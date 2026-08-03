import Link from 'next/link'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { CocoriaLogo } from '@/components/CocoriaLogo'
import { createClient } from '@/lib/supabase/server'
import { STAGE_TONE_STYLE, daysSince, getStage, isOnHold, needsFollowUp, nextTaskFor } from '@/lib/constants/pipeline'

export const dynamic = 'force-dynamic'

const MESSAGES = [
  'あなたのケアが、誰かの笑顔を作っています',
  '今日も丁寧に、一歩ずつ',
  'あなたの存在が、家族の安心につながっています',
  '小さな気づきが、大きな支えになる',
  '今日の頑張りは、必ず誰かの力になっています',
  'ケアする心を、今日も大切に',
  'あなたが関わるすべての家族に、温かさを',
  '一つひとつの訪問が、かけがえない時間です',
  '今日もお疲れ様。あなたの仕事に意味があります',
  'やさしさを届けるプロとして、今日も輝いて',
]

type CustomerName = { name_kanji: string } | { name_kanji: string }[] | null

function customerName(value: CustomerName): string {
  if (Array.isArray(value)) return value[0]?.name_kanji ?? '不明'
  return value?.name_kanji ?? '不明'
}

function toDateKey(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? ''

  const now = new Date()
  const tomorrowDate = new Date(now)
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)

  const today = toDateKey(now)
  const tomorrow = toDateKey(tomorrowDate)

  const [profileRes, todayRes, tomorrowRes, unsentRes, unpaidRes, visitUnpaidRes, customersRes] =
    await Promise.all([
      supabase
        .from('user_profiles')
        .select('subscription_status, accepted_at, trial_ends_at, current_period_end')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('visits')
        .select('id, customer_id, start_time, customers(name_kanji)')
        .eq('visit_date', today)
        .eq('user_id', userId)
        .order('start_time'),
      supabase
        .from('visits')
        .select('id, customer_id, start_time, customers(name_kanji)')
        .eq('visit_date', tomorrow)
        .eq('user_id', userId)
        .order('start_time'),
      supabase
        .from('visits')
        .select('id, customer_id, visit_date, customers(name_kanji)')
        .eq('report_sent', false)
        .eq('user_id', userId)
        .lte('visit_date', today)
        .order('visit_date', { ascending: false })
        .limit(10),
      supabase
        .from('billing')
        .select('customer_id, customers(name_kanji)')
        .eq('user_id', userId)
        .eq('contracted', true)
        .eq('paid', false),
      supabase
        .from('visit_billing')
        .select('id, customer_id, invoice_label, customers(name_kanji), visits(visit_date)')
        .eq('user_id', userId)
        .eq('invoiced', true)
        .eq('paid', false),
      supabase
        .from('customers')
        .select('id, name_kanji, pipeline_stage, stage_updated_at, stage_note, is_recurring, hold_state, hold_reason, hold_until')
        .eq('user_id', userId)
        .neq('pipeline_stage', 'completed')
        .order('stage_updated_at', { ascending: true }),
    ])

  const todayVisits = todayRes.data ?? []
  const tomorrowVisits = tomorrowRes.data ?? []
  const unsentReports = unsentRes.data ?? []

  const visitUnpaid = visitUnpaidRes.data ?? []
  const visitUnpaidCustomerIds = new Set(visitUnpaid.map(v => v.customer_id))
  const unpaidBilling = [
    ...visitUnpaid,
    ...(unpaidRes.data ?? []).filter(v => !visitUnpaidCustomerIds.has(v.customer_id)),
  ]

  // 保留・待ちにしている顧客は、対応中の件数にもアラートにも出さない
  const openCustomers = (customersRes.data ?? []).filter(c => !isOnHold(c))
  const staleCustomers = openCustomers.filter(c => needsFollowUp(c))

  const acceptedAt = profileRes.data?.accepted_at ?? null
  const trialEndsAt = profileRes.data?.trial_ends_at ?? getFallbackTrialEndsAt(acceptedAt)
  const subscriptionStatus = profileRes.data?.subscription_status ?? null

  const message = MESSAGES[new Date().getDate() % MESSAGES.length]
  const todayLabel = format(new Date(), 'M月d日（E）', { locale: ja })

  return (
    <div className="px-4 pt-6 space-y-5">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <CocoriaLogo size={44} />
          </div>
          <h1 className="text-base font-bold leading-snug" style={{ color: 'var(--color-text)' }}>
            {message}
          </h1>
        </div>
        <p className="text-sm mt-1.5 ml-1" style={{ color: 'var(--color-text-muted)' }}>
          {todayLabel} · {user?.email ?? ''}
        </p>
      </div>

      {subscriptionStatus === 'trialing' && trialEndsAt && <TrialNotice trialEndsAt={trialEndsAt} />}

      {subscriptionStatus === 'active' && profileRes.data?.current_period_end && (
        <div className="card py-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          次回更新予定: {formatDate(profileRes.data.current_period_end)}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <SummaryCard icon="📅" label="今日の訪問" count={todayVisits.length} />
        <SummaryCard icon="💌" label="未送信報告書" count={unsentReports.length} warn />
        <SummaryCard icon="🔔" label="要対応" count={staleCustomers.length} warn />
      </div>

      {/* 今日やること */}
      <Section title="✅ 今日やること" empty={staleCustomers.length === 0 && tomorrowVisits.length === 0}
        emptyText="止まっている案件はありません">
        {tomorrowVisits.map(v => (
          <Link key={`tomorrow-${v.id}`} href={`/customers/${v.customer_id}/visits/${v.id}`}>
            <TaskItem
              name={customerName(v.customers as CustomerName)}
              task="明日の訪問。前日確認の連絡をする"
              badge="明日"
              badgeStyle={{ background: '#dbeafe', color: '#1e40af' }}
            />
          </Link>
        ))}
        {staleCustomers.map(c => {
          const stage = getStage(c.pipeline_stage)
          const days = daysSince(c.stage_updated_at)
          return (
            <Link key={c.id} href={`/customers/${c.id}${stage.href ?? ''}`}>
              <TaskItem
                name={c.name_kanji}
                task={nextTaskFor(c.pipeline_stage, c.is_recurring).task}
                sub={`${stage.step}. ${stage.label}${c.stage_note ? ` / ${c.stage_note}` : ''}`}
                badge={days !== null ? `${days}日` : undefined}
                badgeStyle={{ background: '#ffedd5', color: '#9a3412' }}
              />
            </Link>
          )
        })}
      </Section>

      <Section title="📅 今日の訪問" empty={todayVisits.length === 0} emptyText="今日の訪問はありません">
        {todayVisits.map(v => (
          <Link key={v.id} href={`/customers/${v.customer_id}/visits/${v.id}`}>
            <TaskItem
              name={customerName(v.customers as CustomerName)}
              task="訪問チェックリストを開く"
              sub={v.start_time ? `${v.start_time.slice(0, 5)} 〜` : undefined}
            />
          </Link>
        ))}
      </Section>

      {unsentReports.length > 0 && (
        <Section title="💌 未送信の報告書">
          {unsentReports.map(v => (
            <Link key={v.id} href={`/customers/${v.customer_id}/visits/${v.id}`}>
              <TaskItem
                name={customerName(v.customers as CustomerName)}
                task="報告書を作成して送る"
                sub={format(new Date(v.visit_date), 'M月d日', { locale: ja })}
                badge="要送信"
                badgeStyle={{ background: '#fce7f3', color: '#9d174d' }}
              />
            </Link>
          ))}
        </Section>
      )}

      {unpaidBilling.length > 0 && (
        <Section title="💰 未入金の顧客">
          {unpaidBilling.map(b => (
            <Link key={('id' in b && b.id) ? b.id : b.customer_id} href={`/customers/${b.customer_id}/billing`}>
              <TaskItem
                name={customerName(b.customers as CustomerName)}
                task="入金を確認する"
                badge="未入金"
                badgeStyle={{ background: '#fee2e2', color: '#991b1b' }}
              />
            </Link>
          ))}
        </Section>
      )}

      {/* ステータス別の件数 */}
      {openCustomers.length > 0 && (
        <div className="card space-y-2">
          <div className="flex items-center justify-between">
            <p className="section-label mb-0">対応中の案件</p>
            <Link href="/customers" className="text-xs underline" style={{ color: 'var(--color-primary-dark)' }}>
              顧客一覧へ
            </Link>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(
              openCustomers.reduce<Record<string, number>>((acc, c) => {
                const key = getStage(c.pipeline_stage).key
                acc[key] = (acc[key] ?? 0) + 1
                return acc
              }, {}),
            )
              .sort(([a], [b]) => getStage(a).step - getStage(b).step)
              .map(([key, count]) => {
                const stage = getStage(key)
                return (
                  <span key={key} className="badge text-xs" style={STAGE_TONE_STYLE[stage.tone]}>
                    {stage.label} {count}
                  </span>
                )
              })}
          </div>
        </div>
      )}

      <div className="bottom-nav-spacer" />
    </div>
  )
}

function TrialNotice({ trialEndsAt }: { trialEndsAt: string }) {
  const daysLeft = getDaysLeft(trialEndsAt)
  const isNearEnd = daysLeft <= 7
  const label = daysLeft > 0 ? `あと${daysLeft}日` : '本日まで'

  return (
    <div
      className="card py-3 text-sm flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
      style={{
        borderColor: isNearEnd ? '#fb923c' : 'var(--color-border)',
        background: isNearEnd ? '#fff7ed' : 'var(--color-card)',
      }}
    >
      <span style={{ color: 'var(--color-text)' }}>
        無料試用期間: {formatDate(trialEndsAt)}まで
      </span>
      <span className="font-semibold" style={{ color: isNearEnd ? '#c2410c' : 'var(--color-primary-dark)' }}>
        {label}
      </span>
    </div>
  )
}

function SummaryCard({ icon, label, count, warn }: { icon: string; label: string; count: number; warn?: boolean }) {
  return (
    <div className="card text-center py-4">
      <div className="text-xl mb-1">{icon}</div>
      <div className="text-2xl font-bold" style={{ color: warn && count > 0 ? 'var(--color-primary-dark)' : 'var(--color-text)' }}>
        {count}
      </div>
      <div className="text-xs mt-0.5 leading-tight" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
    </div>
  )
}

function Section({ title, children, empty, emptyText }: {
  title: string; children?: React.ReactNode; empty?: boolean; emptyText?: string
}) {
  return (
    <div className="card space-y-2">
      <p className="section-label">{title}</p>
      {empty ? (
        <p className="text-sm py-2 text-center" style={{ color: 'var(--color-text-muted)' }}>{emptyText}</p>
      ) : children}
    </div>
  )
}

function TaskItem({ name, task, sub, badge, badgeStyle }: {
  name: string
  task: string
  sub?: string
  badge?: string
  badgeStyle?: React.CSSProperties
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl active:opacity-70 transition-opacity"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <div className="min-w-0">
        <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{name}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text)' }}>{task}</p>
        {sub && <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{sub}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {badge && <span className="badge text-xs" style={badgeStyle}>{badge}</span>}
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
          style={{ color: 'var(--color-text-muted)' }}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </div>
  )
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ja-JP')
}

function getFallbackTrialEndsAt(acceptedAt: string | null) {
  if (!acceptedAt) return null
  const result = new Date(acceptedAt)
  result.setMonth(result.getMonth() + 1)
  return result.toISOString()
}

function getDaysLeft(value: string) {
  const end = new Date(value)
  const today = new Date()
  end.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  return Math.ceil((end.getTime() - today.getTime()) / 86_400_000)
}
