'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Visit, VisitBilling } from '@/types/database'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

type VisitBillingView = {
  visit: Pick<Visit, 'id' | 'visit_date' | 'start_time' | 'end_time'>
  billing: VisitBilling | null
}

export default function CustomerBillingPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()

  const [visitBillingRows, setVisitBillingRows] = useState<VisitBillingView[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [visitRes, visitBillingRes] = await Promise.all([
        supabase.from('visits').select('id, visit_date, start_time, end_time').eq('customer_id', id).order('visit_date', { ascending: false }),
        supabase.from('visit_billing').select('*').eq('customer_id', id),
      ])

      const billingByVisit = new Map((visitBillingRes.data ?? []).map(row => [row.visit_id, row]))
      setVisitBillingRows((visitRes.data ?? []).map(visit => ({
        visit,
        billing: billingByVisit.get(visit.id) ?? null,
      })))
      setLoading(false)
    }
    load()
  }, [id])

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

  return (
    <div className="px-4 pt-5 space-y-4 pb-8">
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
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {row.visit.start_time.slice(0, 5)}{row.visit.end_time ? ` - ${row.visit.end_time.slice(0, 5)}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {row.billing?.invoiced && <span className="badge badge-contracted text-xs">請求済み</span>}
                    {row.billing?.paid && <span className="badge badge-active text-xs">入金済み</span>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <ToggleRow
                    label="請求済み"
                    checked={row.billing?.invoiced ?? false}
                    sub={row.billing?.invoiced_date ? formatDate(row.billing.invoiced_date) : undefined}
                    onChange={v => toggleVisitBilling(row.visit.id, 'invoiced', v)}
                  />
                  <ToggleRow
                    label="入金済み"
                    checked={row.billing?.paid ?? false}
                    sub={row.billing?.paid_date ? formatDate(row.billing.paid_date) : undefined}
                    onChange={v => toggleVisitBilling(row.visit.id, 'paid', v)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="form-label">請求単位</label>
                    <input
                      className="input"
                      defaultValue={row.billing?.invoice_label ?? ''}
                      placeholder="例：2026年5月分"
                      onBlur={e => updateVisitBilling(row.visit.id, { invoice_label: e.target.value || null })}
                    />
                  </div>
                  <div>
                    <label className="form-label">金額</label>
                    <input
                      className="input"
                      type="number"
                      inputMode="numeric"
                      defaultValue={row.billing?.amount ?? ''}
                      placeholder="例：12000"
                      onBlur={e => updateVisitBilling(row.visit.id, { amount: e.target.value ? Number(e.target.value) : null })}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">メモ</label>
                  <input
                    className="input"
                    defaultValue={row.billing?.notes ?? ''}
                    placeholder="例：5/1-5/31まとめ請求、契約分に含む"
                    onBlur={e => updateVisitBilling(row.visit.id, { notes: e.target.value || null })}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bottom-nav-spacer" />
    </div>
  )
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

function formatDate(date: string) {
  return format(new Date(date), 'yyyy年M月d日', { locale: ja })
}
