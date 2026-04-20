'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { SupportTag } from '@/types/database'

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [tags, setTags] = useState<SupportTag[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [adding, setAdding] = useState(false)
  const [loading, setLoading] = useState(true)
  const [csvLoading, setCsvLoading] = useState(false)

  useEffect(() => {
    loadTags()
  }, [])

  async function loadTags() {
    const { data } = await supabase
      .from('support_tags')
      .select('*')
      .order('sort_order')
    setTags(data ?? [])
    setLoading(false)
  }

  async function addTag() {
    const name = newTagName.trim()
    if (!name) return
    setAdding(true)
    const { data: { user } } = await supabase.auth.getUser()
    const maxOrder = tags.length > 0 ? Math.max(...tags.map(t => t.sort_order)) + 1 : 0

    const { data } = await supabase
      .from('support_tags')
      .insert({ user_id: user!.id, name, is_default: false, sort_order: maxOrder })
      .select()
      .single()

    if (data) {
      setTags(prev => [...prev, data])
      setNewTagName('')
    }
    setAdding(false)
  }

  async function deleteTag(id: string) {
    await supabase.from('support_tags').delete().eq('id', id)
    setTags(prev => prev.filter(t => t.id !== id))
  }

  async function exportCsv() {
    setCsvLoading(true)
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false })
    if (!data) { setCsvLoading(false); return }

    const headers = ['ID', '氏名', 'フリガナ', '電話番号', 'メールアドレス', 'ステータス', '問い合わせ日', '登録日']
    const rows = data.map(c => [
      c.id,
      c.name_kanji,
      c.name_kana,
      c.phone ?? '',
      c.email ?? '',
      c.status,
      c.inquiry_date ?? '',
      c.created_at.split('T')[0],
    ])

    const bom = '\uFEFF'
    const csv = bom + [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `顧客一覧_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setCsvLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="px-4 pt-6 space-y-5">
      <h1 className="page-title">設定</h1>

      {/* タグ管理 */}
      <div className="card space-y-4">
        <p className="section-label">サポート内容タグ</p>

        {loading ? (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'var(--color-primary)' }} />
          </div>
        ) : (
          <div className="space-y-2">
            {tags.map(tag => (
              <div key={tag.id} className="flex items-center justify-between p-3 rounded-xl"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{tag.name}</span>
                  {tag.is_default && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)' }}>
                      デフォルト
                    </span>
                  )}
                </div>
                {!tag.is_default && (
                  <button
                    onClick={() => deleteTag(tag.id)}
                    className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ background: '#fef2f2', color: '#dc2626' }}>
                    削除
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* タグ追加 */}
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="新しいタグ名..."
            value={newTagName}
            onChange={e => setNewTagName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTag()}
          />
          <button
            onClick={addTag}
            disabled={adding || !newTagName.trim()}
            className="btn-primary px-4 text-sm disabled:opacity-60 flex-shrink-0">
            追加
          </button>
        </div>
      </div>

      {/* CSV出力 */}
      <div className="card space-y-3">
        <p className="section-label">データ出力</p>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          顧客一覧をCSVファイルとしてダウンロードします。
        </p>
        <button
          onClick={exportCsv}
          disabled={csvLoading}
          className="btn-secondary w-full disabled:opacity-60">
          {csvLoading ? '準備中...' : '顧客一覧をCSVで出力'}
        </button>
      </div>

      {/* ログアウト */}
      <div className="card">
        <p className="section-label">アカウント</p>
        <button
          onClick={handleLogout}
          className="w-full mt-3 py-3 rounded-xl text-sm font-semibold transition-opacity"
          style={{ background: '#fef2f2', color: '#dc2626' }}>
          ログアウト
        </button>
      </div>

      <div className="bottom-nav-spacer" />
    </div>
  )
}
