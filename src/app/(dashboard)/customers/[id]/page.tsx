'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Customer, Baby, Billing, CustomerContract, Visit, VisitBilling } from '@/types/database'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

type VisitBillingView = {
  visit: Pick<Visit, 'id' | 'visit_date' | 'start_time' | 'end_time'>
  billing: VisitBilling | null
}

type ContractForm = {
  title: string
  contracted_date: string
  period_start: string
  period_end: string
  notes: string
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [babies, setBabies] = useState<Baby[]>([])
  const [billing, setBilling] = useState<Billing | null>(null)
  const [contracts, setContracts] = useState<CustomerContract[]>([])
  const [visitBillingRows, setVisitBillingRows] = useState<VisitBillingView[]>([])
  const [planningAnswers, setPlanningAnswers] = useState<Record<string, Record<string, unknown>>>({})
  const [loading, setLoading] = useState(true)
  const [savingContract, setSavingContract] = useState(false)
  const [contractForm, setContractForm] = useState<ContractForm>({
    title: '契約',
    contracted_date: new Date().toISOString().split('T')[0],
    period_start: '',
    period_end: '',
    notes: '',
  })

  useEffect(() => {
    async function load() {
      const [cRes, bRes, biRes, contractRes, visitRes, visitBillingRes] = await Promise.all([
        supabase.from('customers').select('*').eq('id', id).single(),
        supabase.from('babies').select('*').eq('customer_id', id).order('sort_order'),
        supabase.from('billing').select('*').eq('customer_id', id).single(),
        supabase.from('customer_contracts').select('*').eq('customer_id', id).order('contracted_date', { ascending: false }),
        supabase.from('visits').select('id, visit_date, start_time, end_time').eq('customer_id', id).order('visit_date', { ascending: false }),
        supabase.from('visit_billing').select('*').eq('customer_id', id),
      ])
      setCustomer(cRes.data)
      setBabies(bRes.data ?? [])
      setBilling(biRes.data)
      setContracts(contractRes.data ?? [])

      const billingByVisit = new Map((visitBillingRes.data ?? []).map(row => [row.visit_id, row]))
      setVisitBillingRows((visitRes.data ?? []).map(visit => ({
        visit,
        billing: billingByVisit.get(visit.id) ?? null,
      })))

      const sessRes = await fetch(`/api/planning/sessions?customer_id=${id}`)
      const sessions = await sessRes.json()
      if (Array.isArray(sessions) && sessions.length > 0) {
        const latest = sessions[0]
        const sessionRes = await fetch(`/api/planning/sessions/${latest.id}`)
        const sessionData = await sessionRes.json()
        const map: Record<string, Record<string, unknown>> = {}
        for (const row of sessionData.answers ?? []) {
          map[row.section_id] = row.answers
        }
        setPlanningAnswers(map)
      }

      setLoading(false)
    }
    load()
  }, [id])

  async function toggleBilling(field: 'contracted' | 'invoiced' | 'paid', value: boolean) {
    if (!billing) return
    const today = new Date().toISOString().split('T')[0]
    if (field === 'contracted') {
      await supabase.from('billing').update({ contracted: value }).eq('id', billing.id)
      setBilling(prev => prev ? { ...prev, contracted: value } : prev)
    } else if (field === 'invoiced') {
      const patch = value ? { invoiced: true, invoiced_date: today } : { invoiced: false }
      await supabase.from('billing').update(patch).eq('id', billing.id)
      setBilling(prev => prev ? { ...prev, ...patch } : prev)
    } else if (field === 'paid') {
      const patch = value ? { paid: true, paid_date: today } : { paid: false }
      await supabase.from('billing').update(patch).eq('id', billing.id)
      setBilling(prev => prev ? { ...prev, ...patch } : prev)
    }
  }

  async function addContract(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSavingContract(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSavingContract(false); return }

    const { data } = await supabase
      .from('customer_contracts')
      .insert({
        customer_id: id,
        user_id: user.id,
        title: contractForm.title || '契約',
        contracted_date: contractForm.contracted_date,
        period_start: contractForm.period_start || null,
        period_end: contractForm.period_end || null,
        notes: contractForm.notes || null,
      })
      .select()
      .single()

    if (data) {
      setContracts(prev => [data, ...prev].sort((a, b) => b.contracted_date.localeCompare(a.contracted_date)))
      setContractForm({
        title: '契約',
        contracted_date: new Date().toISOString().split('T')[0],
        period_start: '',
        period_end: '',
        notes: '',
      })
    }
    setSavingContract(false)
  }

  async function createVisitBilling(visitId: string, patch: Partial<VisitBilling>) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data } = await supabase
      .from('visit_billing')
      .insert({
        visit_id: visitId,
        customer_id: id,
        user_id: user.id,
        invoiced: false,
        paid: false,
        ...patch,
      })
      .select()
      .single()

    return data
  }

  function updateVisitBillingState(visitId: string, next: VisitBilling) {
    setVisitBillingRows(prev => prev.map(row => (
      row.visit.id === visitId ? { ...row, billing: next } : row
    )))
  }

  async function updateVisitBilling(visitId: string, patch: Partial<VisitBilling>) {
    const row = visitBillingRows.find(v => v.visit.id === visitId)
    if (!row) return

    if (row.billing) {
      const { data } = await supabase
        .from('visit_billing')
        .update(patch)
        .eq('id', row.billing.id)
        .select()
        .single()
      if (data) updateVisitBillingState(visitId, data)
      return
    }

    const data = await createVisitBilling(visitId, patch)
    if (data) updateVisitBillingState(visitId, data)
  }

  async function toggleVisitBilling(visitId: string, field: 'invoiced' | 'paid', value: boolean) {
    const today = new Date().toISOString().split('T')[0]
    const patch = field === 'invoiced'
      ? { invoiced: value, invoiced_date: value ? today : null }
      : { paid: value, paid_date: value ? today : null }
    await updateVisitBilling(visitId, patch)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center" style={{ minHeight: '50vh' }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--color-primary)' }} />
      </div>
    )
  }

  if (!customer) {
    return <div className="text-center py-20" style={{ color: 'var(--color-text-muted)' }}>顧客が見つかりません</div>
  }

  return (
    <div className="px-4 pt-5 space-y-4 pb-8">
      {/* カルテ情報 */}
      <div className="card space-y-3">
        <p className="section-label">カルテ情報</p>
        <InfoRow label="電話番号" value={customer.phone} />
        <InfoRow label="メールアドレス" value={customer.email} />
        <InfoRow label="LINE ID" value={customer.line_id} />
        <InfoRow label="住所" value={customer.address} />
        <InfoRow label="訪問手段" value={customer.transport} />
        <InfoRow label="問い合わせ日" value={customer.inquiry_date
          ? format(new Date(customer.inquiry_date), 'yyyy年M月d日', { locale: ja })
          : undefined} />
        {customer.notes && (
          <div>
            <p className="form-label">備考</p>
            <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>{customer.notes}</p>
          </div>
        )}
      </div>

      {/* 赤ちゃん情報 */}
      {babies.length > 0 && (
        <div className="card space-y-3">
          <p className="section-label">赤ちゃん情報</p>
          {babies.map((b, i) => (
            <div key={b.id} className="p-3 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <p className="font-semibold text-sm mb-1" style={{ color: 'var(--color-text)' }}>
                {b.name ?? `赤ちゃん ${i + 1}`}
              </p>
              {b.birth_date && (
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  出産日: {format(new Date(b.birth_date), 'yyyy年M月d日', { locale: ja })}
                </p>
              )}
              {b.due_date && (
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  出産予定日: {format(new Date(b.due_date), 'yyyy年M月d日', { locale: ja })}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 請求・入金管理 */}
      <div className="card space-y-4">
        <p className="section-label">請求・入金管理</p>
        {billing ? (
          <>
            <ToggleRow label="契約済み" checked={billing.contracted} onChange={v => toggleBilling('contracted', v)} />
            <ToggleRow
              label="請求済み"
              checked={billing.invoiced}
              sub={billing.invoiced_date ? format(new Date(billing.invoiced_date), 'M月d日', { locale: ja }) : undefined}
              onChange={v => toggleBilling('invoiced', v)}
            />
            <ToggleRow
              label="入金済み"
              checked={billing.paid}
              sub={billing.paid_date ? format(new Date(billing.paid_date), 'M月d日', { locale: ja }) : undefined}
              onChange={v => toggleBilling('paid', v)}
            />
          </>
        ) : (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>請求情報がありません</p>
        )}
      </div>

      {/* プランニング情報サマリー */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="section-label mb-0">契約履歴</p>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{contracts.length}件</span>
        </div>

        <form onSubmit={addContract} className="space-y-3 p-3 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div>
            <label className="form-label">契約名</label>
            <input className="input" value={contractForm.title} onChange={e => setContractForm(prev => ({ ...prev, title: e.target.value }))} placeholder="例：第2子産後ケア契約" />
          </div>
          <div>
            <label className="form-label">契約日</label>
            <input className="input" type="date" required value={contractForm.contracted_date} onChange={e => setContractForm(prev => ({ ...prev, contracted_date: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="form-label">対象開始</label>
              <input className="input" type="date" value={contractForm.period_start} onChange={e => setContractForm(prev => ({ ...prev, period_start: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">対象終了</label>
              <input className="input" type="date" value={contractForm.period_end} onChange={e => setContractForm(prev => ({ ...prev, period_end: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="form-label">メモ</label>
            <textarea className="input min-h-20" value={contractForm.notes} onChange={e => setContractForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="例：第2子、週2回、産後8週まで" />
          </div>
          <button type="submit" disabled={savingContract} className="btn-primary w-full py-2.5 text-sm">
            {savingContract ? '保存中...' : '契約履歴を追加'}
          </button>
        </form>

        {contracts.length === 0 ? (
          <p className="text-sm text-center py-2" style={{ color: 'var(--color-text-muted)' }}>契約履歴はまだありません</p>
        ) : (
          <div className="space-y-2">
            {contracts.map(contract => (
              <div key={contract.id} className="p-3 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{contract.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>契約日: {formatDate(contract.contracted_date)}</p>
                    {(contract.period_start || contract.period_end) && (
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        対象: {contract.period_start ? formatDate(contract.period_start) : '未設定'} - {contract.period_end ? formatDate(contract.period_end) : '未設定'}
                      </p>
                    )}
                  </div>
                  <span className="badge badge-contracted text-xs">契約</span>
                </div>
                {contract.notes && <p className="text-xs mt-2 whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>{contract.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="section-label mb-0">訪問ごとの請求・入金</p>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{visitBillingRows.length}件</span>
        </div>

        {visitBillingRows.length === 0 ? (
          <p className="text-sm text-center py-2" style={{ color: 'var(--color-text-muted)' }}>訪問履歴がまだありません</p>
        ) : (
          <div className="space-y-3">
            {visitBillingRows.map(row => (
              <div key={row.visit.id} className="p-3 rounded-xl space-y-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{formatDate(row.visit.visit_date)}</p>
                    {row.visit.start_time && (
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{row.visit.start_time.slice(0, 5)}{row.visit.end_time ? ` - ${row.visit.end_time.slice(0, 5)}` : ''}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {row.billing?.invoiced && <span className="badge badge-contracted text-xs">請求済み</span>}
                    {row.billing?.paid && <span className="badge badge-active text-xs">入金済み</span>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <ToggleRow label="請求済み" checked={row.billing?.invoiced ?? false} sub={row.billing?.invoiced_date ? formatDate(row.billing.invoiced_date) : undefined} onChange={v => toggleVisitBilling(row.visit.id, 'invoiced', v)} />
                  <ToggleRow label="入金済み" checked={row.billing?.paid ?? false} sub={row.billing?.paid_date ? formatDate(row.billing.paid_date) : undefined} onChange={v => toggleVisitBilling(row.visit.id, 'paid', v)} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="form-label">請求単位</label>
                    <input className="input" defaultValue={row.billing?.invoice_label ?? ''} placeholder="例：2026年5月分" onBlur={e => updateVisitBilling(row.visit.id, { invoice_label: e.target.value || null })} />
                  </div>
                  <div>
                    <label className="form-label">金額</label>
                    <input className="input" type="number" inputMode="numeric" defaultValue={row.billing?.amount ?? ''} placeholder="例：12000" onBlur={e => updateVisitBilling(row.visit.id, { amount: e.target.value ? Number(e.target.value) : null })} />
                  </div>
                </div>

                <div>
                  <label className="form-label">メモ</label>
                  <input className="input" defaultValue={row.billing?.notes ?? ''} placeholder="例：5/1-5/31まとめ請求、契約分に含む" onBlur={e => updateVisitBilling(row.visit.id, { notes: e.target.value || null })} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {Object.keys(planningAnswers).length > 0 && (
        <PlanningInfoCard answers={planningAnswers} />
      )}

      <div className="bottom-nav-spacer" />
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex justify-between items-start gap-3">
      <span className="text-sm flex-shrink-0" style={{ color: 'var(--color-text-muted)', minWidth: '80px' }}>{label}</span>
      <span className="text-sm text-right" style={{ color: 'var(--color-text)' }}>{value}</span>
    </div>
  )
}

function formatDate(date: string) {
  return format(new Date(date), 'yyyy年M月d日', { locale: ja })
}

function ToggleRow({ label, checked, sub, onChange }: {
  label: string; checked: boolean; sub?: string; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{label}</p>
        {sub && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{sub}</p>}
      </div>
      <label className="toggle">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
        <div className="toggle-track" />
        <div className="toggle-thumb" />
      </label>
    </div>
  )
}

function PlanningInfoCard({ answers }: { answers: Record<string, Record<string, unknown>> }) {
  function str(section: string, key: string): string {
    const val = answers[section]?.[key]
    if (val == null || val === '') return ''
    if (Array.isArray(val)) return (val as string[]).join('・')
    return String(val)
  }
  function has(section: string, ...keys: string[]): boolean {
    return keys.some(k => {
      const val = answers[section]?.[k]
      if (val == null || val === '') return false
      if (Array.isArray(val)) return (val as string[]).length > 0
      return true
    })
  }

  const supportKeys = ['desired_support', 'support_start', 'support_frequency', 'support_time', 'support_end', 'discharge_supporter']
  const mealKeys = ['seasonings', 'mama_likes', 'mama_dislikes', 'papa_likes', 'papa_dislikes', 'meal_notes']
  const allergyKeys = ['mama_allergy', 'papa_allergy']
  const childKeys = ['child_name', 'child_school', 'child_lessons', 'child_allergy']
  const babyKeys = ['baby_name', 'baby_gender', 'baby_birth_date', 'baby_notes']
  const bathKeys = ['bath_place', 'baby_soap', 'bath_notes']
  const milkKeys = ['milk_type', 'milk_amount', 'milk_frequency', 'milk_notes']
  const sleepKeys = ['sleep_place', 'sleep_light', 'sleep_notes']
  const evacKeys = ['evac_place', 'evac_address', 'evac_transport']

  const hasSupport = has('partner_support', ...supportKeys)
  const hasMeal = has('housework_meal', ...mealKeys) || has('family_mama', ...allergyKeys) || has('family_papa', 'papa_allergy')
  const hasPrivacy = has('partner_support', 'no_go_zones')
  const hasChildren = has('family_children', ...childKeys)
  const hasBaby = has('baby_info', ...babyKeys) || has('baby_bath', ...bathKeys) || has('baby_milk', ...milkKeys) || has('baby_sleep', ...sleepKeys)
  const hasEvac = has('evacuation', ...evacKeys)
  const hasMemo = has('other', 'memo')

  if (!hasSupport && !hasMeal && !hasPrivacy && !hasChildren && !hasBaby && !hasEvac && !hasMemo) return null

  return (
    <div className="card space-y-5">
      <p className="section-label">プランニング情報</p>
      {hasSupport && (
        <div>
          <p className="text-xs font-bold mb-2" style={{ color: 'var(--color-primary-dark)' }}>サポート体制・訪問頻度</p>
          <div className="space-y-1">
            {str('partner_support', 'desired_support') && <InfoRow label="依頼内容" value={str('partner_support', 'desired_support')} />}
            {str('partner_support', 'support_start') && <InfoRow label="開始時期" value={str('partner_support', 'support_start')} />}
            {str('partner_support', 'support_frequency') && <InfoRow label="曜日・頻度" value={str('partner_support', 'support_frequency')} />}
            {str('partner_support', 'support_time') && <InfoRow label="訪問時間" value={str('partner_support', 'support_time')} />}
            {str('partner_support', 'support_end') && <InfoRow label="終了予定" value={str('partner_support', 'support_end')} />}
            {str('partner_support', 'discharge_supporter') && <InfoRow label="退院後サポーター" value={str('partner_support', 'discharge_supporter')} />}
          </div>
        </div>
      )}
      {hasMeal && (
        <div>
          <p className="text-xs font-bold mb-2" style={{ color: 'var(--color-primary-dark)' }}>食事の注意点</p>
          <div className="space-y-1">
            {str('family_mama', 'mama_allergy') && <InfoRow label="ママのアレルギー" value={str('family_mama', 'mama_allergy')} />}
            {str('family_papa', 'papa_allergy') && <InfoRow label="パパのアレルギー" value={str('family_papa', 'papa_allergy')} />}
            {str('housework_meal', 'seasonings') && <InfoRow label="使用調味料" value={str('housework_meal', 'seasonings')} />}
            {str('housework_meal', 'mama_likes') && <InfoRow label="ママの好き" value={str('housework_meal', 'mama_likes')} />}
            {str('housework_meal', 'mama_dislikes') && <InfoRow label="ママの嫌い" value={str('housework_meal', 'mama_dislikes')} />}
            {str('housework_meal', 'papa_likes') && <InfoRow label="パパの好き" value={str('housework_meal', 'papa_likes')} />}
            {str('housework_meal', 'papa_dislikes') && <InfoRow label="パパの嫌い" value={str('housework_meal', 'papa_dislikes')} />}
            {str('housework_meal', 'meal_notes') && <InfoRow label="食事メモ" value={str('housework_meal', 'meal_notes')} />}
          </div>
        </div>
      )}
      {hasPrivacy && (
        <div>
          <p className="text-xs font-bold mb-2" style={{ color: 'var(--color-primary-dark)' }}>プライバシーの注意点</p>
          <InfoRow label="立入禁止エリア等" value={str('partner_support', 'no_go_zones')} />
        </div>
      )}
      {hasChildren && (
        <div>
          <p className="text-xs font-bold mb-2" style={{ color: 'var(--color-primary-dark)' }}>上の子のお世話情報</p>
          <div className="space-y-1">
            {str('family_children', 'child_name') && <InfoRow label="お名前" value={str('family_children', 'child_name')} />}
            {str('family_children', 'child_school') && <InfoRow label="保育園・学校" value={str('family_children', 'child_school')} />}
            {str('family_children', 'child_lessons') && <InfoRow label="習い事" value={str('family_children', 'child_lessons')} />}
            {str('family_children', 'child_allergy') && <InfoRow label="アレルギー" value={str('family_children', 'child_allergy')} />}
          </div>
        </div>
      )}
      {hasBaby && (
        <div>
          <p className="text-xs font-bold mb-2" style={{ color: 'var(--color-primary-dark)' }}>赤ちゃんのお世話情報</p>
          <div className="space-y-1">
            {str('baby_info', 'baby_name') && <InfoRow label="お名前" value={str('baby_info', 'baby_name')} />}
            {str('baby_info', 'baby_gender') && <InfoRow label="性別" value={str('baby_info', 'baby_gender')} />}
            {str('baby_info', 'baby_birth_date') && <InfoRow label="生年月日" value={str('baby_info', 'baby_birth_date')} />}
            {str('baby_info', 'baby_notes') && <InfoRow label="特記事項" value={str('baby_info', 'baby_notes')} />}
            {str('baby_bath', 'bath_place') && <InfoRow label="沐浴場所" value={str('baby_bath', 'bath_place')} />}
            {str('baby_bath', 'baby_soap') && <InfoRow label="ベビーソープ" value={str('baby_bath', 'baby_soap')} />}
            {str('baby_bath', 'bath_notes') && <InfoRow label="沐浴メモ" value={str('baby_bath', 'bath_notes')} />}
            {str('baby_milk', 'milk_type') && <InfoRow label="ミルクの種類" value={str('baby_milk', 'milk_type')} />}
            {str('baby_milk', 'milk_amount') && <InfoRow label="1回量" value={`${str('baby_milk', 'milk_amount')}ml`} />}
            {str('baby_milk', 'milk_frequency') && <InfoRow label="ミルク頻度" value={str('baby_milk', 'milk_frequency')} />}
            {str('baby_milk', 'milk_notes') && <InfoRow label="ミルクメモ" value={str('baby_milk', 'milk_notes')} />}
            {str('baby_sleep', 'sleep_place') && <InfoRow label="寝かしつけ場所" value={str('baby_sleep', 'sleep_place')} />}
            {str('baby_sleep', 'sleep_light') && <InfoRow label="電気" value={str('baby_sleep', 'sleep_light')} />}
            {str('baby_sleep', 'sleep_notes') && <InfoRow label="寝かしつけメモ" value={str('baby_sleep', 'sleep_notes')} />}
          </div>
        </div>
      )}
      {hasEvac && (
        <div>
          <p className="text-xs font-bold mb-2" style={{ color: 'var(--color-primary-dark)' }}>防災について</p>
          <div className="space-y-1">
            {str('evacuation', 'evac_place') && <InfoRow label="避難場所" value={str('evacuation', 'evac_place')} />}
            {str('evacuation', 'evac_address') && <InfoRow label="住所" value={str('evacuation', 'evac_address')} />}
            {str('evacuation', 'evac_transport') && <InfoRow label="移動手段" value={str('evacuation', 'evac_transport')} />}
          </div>
        </div>
      )}
      {hasMemo && (
        <div>
          <p className="text-xs font-bold mb-2" style={{ color: 'var(--color-primary-dark)' }}>担当者メモ</p>
          <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>{str('other', 'memo')}</p>
        </div>
      )}
    </div>
  )
}
