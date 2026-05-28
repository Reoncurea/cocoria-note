'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CustomerContract } from '@/types/database'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

type ContractForm = {
  title: string
  contracted_date: string
  period_start: string
  period_end: string
  notes: string
}

const emptyForm = (): ContractForm => ({
  title: '契約',
  contracted_date: new Date().toISOString().split('T')[0],
  period_start: '',
  period_end: '',
  notes: '',
})

const toForm = (contract: CustomerContract): ContractForm => ({
  title: contract.title,
  contracted_date: contract.contracted_date,
  period_start: contract.period_start ?? '',
  period_end: contract.period_end ?? '',
  notes: contract.notes ?? '',
})

export default function ContractHistory({ customerId }: { customerId: string }) {
  const supabase = createClient()
  const [contracts, setContracts] = useState<CustomerContract[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ContractForm>(() => emptyForm())
  const [editForm, setEditForm] = useState<ContractForm>(() => emptyForm())

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('customer_contracts')
        .select('*')
        .eq('customer_id', customerId)
        .order('contracted_date', { ascending: false })
      setContracts(data ?? [])
      setLoading(false)
    }
    load()
  }, [customerId])

  async function addContract(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const { data } = await supabase
      .from('customer_contracts')
      .insert({
        customer_id: customerId,
        user_id: user.id,
        title: form.title || '契約',
        contracted_date: form.contracted_date,
        period_start: form.period_start || null,
        period_end: form.period_end || null,
        notes: form.notes || null,
      })
      .select()
      .single()

    if (data) {
      setContracts(prev => [data, ...prev].sort(sortContracts))
      setForm(emptyForm())
    }
    setSaving(false)
  }

  function startEdit(contract: CustomerContract) {
    setEditingId(contract.id)
    setEditForm(toForm(contract))
  }

  async function saveEdit(contractId: string) {
    setSaving(true)
    const { data } = await supabase
      .from('customer_contracts')
      .update({
        title: editForm.title || '契約',
        contracted_date: editForm.contracted_date,
        period_start: editForm.period_start || null,
        period_end: editForm.period_end || null,
        notes: editForm.notes || null,
      })
      .eq('id', contractId)
      .select()
      .single()

    if (data) {
      setContracts(prev => prev.map(c => c.id === contractId ? data : c).sort(sortContracts))
      setEditingId(null)
    }
    setSaving(false)
  }

  async function deleteContract(contractId: string) {
    if (!window.confirm('この契約履歴を削除しますか？')) return
    const { error } = await supabase.from('customer_contracts').delete().eq('id', contractId)
    if (!error) {
      setContracts(prev => prev.filter(c => c.id !== contractId))
      if (editingId === contractId) setEditingId(null)
    }
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="section-label mb-0">契約履歴</p>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{contracts.length}件</span>
      </div>

      <form onSubmit={addContract} className="space-y-3 p-3 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <ContractFields form={form} onChange={setForm} />
        <button type="submit" disabled={saving} className="btn-primary w-full py-2.5 text-sm">
          {saving ? '保存中...' : '契約履歴を追加'}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-center py-2" style={{ color: 'var(--color-text-muted)' }}>読み込み中...</p>
      ) : contracts.length === 0 ? (
        <p className="text-sm text-center py-2" style={{ color: 'var(--color-text-muted)' }}>契約履歴はまだありません</p>
      ) : (
        <div className="space-y-2">
          {contracts.map(contract => (
            <div key={contract.id} className="p-3 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              {editingId === contract.id ? (
                <div className="space-y-3">
                  <ContractFields form={editForm} onChange={setEditForm} />
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button" disabled={saving} className="btn-primary py-2 text-sm" onClick={() => saveEdit(contract.id)}>
                      保存
                    </button>
                    <button type="button" className="btn-secondary py-2 text-sm" onClick={() => setEditingId(null)}>
                      キャンセル
                    </button>
                    <button type="button" className="btn-secondary py-2 text-sm" style={{ color: 'var(--color-primary-dark)' }} onClick={() => deleteContract(contract.id)}>
                      削除
                    </button>
                  </div>
                </div>
              ) : (
                <>
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
                    <button type="button" className="btn-secondary text-xs px-3 py-1.5" onClick={() => startEdit(contract)}>
                      編集
                    </button>
                  </div>
                  {contract.notes && <p className="text-xs mt-2 whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>{contract.notes}</p>}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ContractFields({ form, onChange }: {
  form: ContractForm
  onChange: React.Dispatch<React.SetStateAction<ContractForm>>
}) {
  return (
    <>
      <div>
        <label className="form-label">契約名</label>
        <input
          className="input"
          value={form.title}
          onChange={e => onChange(prev => ({ ...prev, title: e.target.value }))}
          placeholder="例：第2子産後ケア契約"
        />
      </div>
      <div>
        <label className="form-label">契約日</label>
        <input
          className="input"
          type="date"
          required
          value={form.contracted_date}
          onChange={e => onChange(prev => ({ ...prev, contracted_date: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="form-label">対象開始</label>
          <input
            className="input"
            type="date"
            value={form.period_start}
            onChange={e => onChange(prev => ({ ...prev, period_start: e.target.value }))}
          />
        </div>
        <div>
          <label className="form-label">対象終了</label>
          <input
            className="input"
            type="date"
            value={form.period_end}
            onChange={e => onChange(prev => ({ ...prev, period_end: e.target.value }))}
          />
        </div>
      </div>
      <div>
        <label className="form-label">メモ</label>
        <textarea
          className="input min-h-20"
          value={form.notes}
          onChange={e => onChange(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="例：第2子、週2回、産後8週まで"
        />
      </div>
    </>
  )
}

function formatDate(date: string) {
  return format(new Date(date), 'yyyy年M月d日', { locale: ja })
}

function sortContracts(a: CustomerContract, b: CustomerContract) {
  return b.contracted_date.localeCompare(a.contracted_date)
}
