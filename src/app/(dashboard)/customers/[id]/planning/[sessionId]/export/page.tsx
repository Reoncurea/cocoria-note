'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { CustomerRow } from '@/types/database'
import questionsConfig from '@/lib/planning/questions.json'
import type { Section } from '@/lib/planning/types'

interface Answer {
  section_id: string
  answers: Record<string, unknown>
}

interface Suggestion {
  id: string
  priority: 'high' | 'medium' | 'low'
  category: string
  title: string
  body: string
  is_dismissed: boolean
  display_order: number
}

const sections = questionsConfig.sections as Section[]
const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

// セクション内の主要回答（最大3項目）を取得
function summarizeSection(section: Section, answers: Record<string, unknown>): string[] {
  const lines: string[] = []
  for (const q of section.questions) {
    const val = answers[q.id]
    if (val == null || val === '') continue
    if (Array.isArray(val) && val.length === 0) continue
    const text = Array.isArray(val) ? (val as string[]).join('、') : String(val)
    lines.push(`${q.label}：${text}`)
  }
  return lines
}

export default function ExportPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [customer, setCustomer] = useState<CustomerRow | null>(null)
  const [answerRows, setAnswerRows] = useState<Answer[]>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [cRes, sRes] = await Promise.all([
        supabase.from('customers').select('*').eq('id', id).single(),
        fetch(`/api/planning/sessions/${sessionId}`).then(r => r.json()),
      ])
      setCustomer(cRes.data)
      setAnswerRows(sRes.answers ?? [])
      setSuggestions(((sRes.suggestions ?? []) as Suggestion[])
        .filter(s => !s.is_dismissed)
        .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.display_order - b.display_order)
      )

      const name = cRes.data?.name_kanji ?? ''
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      document.title = `${name}_事前プランニング_${date}`

      setLoading(false)
    }
    load()
    return () => { document.title = 'cocorianote' }
  }, [sessionId])

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--color-primary)' }} />
      </div>
    )
  }

  if (!customer) return null

  // 回答サマリーを section ごとに生成
  const answerMap = Object.fromEntries(answerRows.map(a => [a.section_id, a.answers]))

  return (
    <div className="min-h-screen bg-white">
      {/* 操作バー（印刷時は非表示） */}
      <div className="print:hidden px-4 py-4 flex items-center gap-3 sticky top-0 z-10 bg-white"
        style={{ borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => router.back()} className="p-2 -ml-2">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
            style={{ color: 'var(--color-text)' }}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="flex-1 font-bold" style={{ color: 'var(--color-text)' }}>プランニングシート</span>
        <button onClick={() => window.print()} className="btn-primary text-sm px-4 py-2">
          印刷 / PDF保存
        </button>
      </div>

      {/* 印刷対象コンテンツ */}
      <div className="mx-4 my-6 space-y-6 print:mx-8 print:my-8" style={{ maxWidth: 720 }}>

        {/* タイトル */}
        <div className="text-center pb-4" style={{ borderBottom: '2px solid var(--color-primary)' }}>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
            事前プランニングシート
          </h1>
        </div>

        {/* 顧客基本情報 */}
        <section>
          <h2 className="section-label mb-2">お客様基本情報</h2>
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <PrintRow label="お名前" value={`${(answerMap['basic']?.name as string) ?? customer.name_kanji} 様`} />
              {(answerMap['basic']?.name_kana || customer.name_kana) && (
                <PrintRow label="ふりがな" value={(answerMap['basic']?.name_kana as string) ?? customer.name_kana ?? ''} />
              )}
              {customer.phone && <PrintRow label="電話番号" value={customer.phone} />}
            </tbody>
          </table>
        </section>

        {/* プラン提案 */}
        {suggestions.length > 0 && (
          <section style={{ pageBreakAfter: 'always', breakAfter: 'page' }}>
            <h2 className="section-label mb-3">プラン提案</h2>
            <div className="space-y-3">
              {suggestions.map(s => (
                <div key={s.id} className="p-3 rounded-xl"
                  style={{ background: '#fff7fb', border: '1px solid var(--color-border)' }}>
                  <p className="text-xs font-bold mb-1" style={{ color: 'var(--color-primary-dark)' }}>
                    {priorityLabel(s.priority)}・{s.category}
                  </p>
                  <p className="text-sm font-bold mb-1" style={{ color: 'var(--color-text)' }}>
                    {s.title}
                  </p>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>
                    {s.body}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 回答サマリー */}
        {answerRows.length > 0 && (
          <section>
            <h2 className="section-label mb-3">ヒアリング内容サマリー</h2>
            <div className="space-y-3">
              {sections
                .filter(s => answerMap[s.id])
                .map(s => {
                  const lines = summarizeSection(s, answerMap[s.id] ?? {})
                  if (lines.length === 0) return null
                  return (
                    <div key={s.id} className="p-3 rounded-xl"
                      style={{ background: '#fdf2f8', border: '1px solid var(--color-border)' }}>
                      <p className="text-xs font-bold mb-1.5" style={{ color: 'var(--color-primary)' }}>
                        {s.title}
                      </p>
                      {lines.map((line, i) => (
                        <p key={i} className="text-xs" style={{ color: 'var(--color-text)' }}>{line}</p>
                      ))}
                    </div>
                  )
                })}
            </div>
          </section>
        )}

        {/* 担当者メモ欄 */}
        <section>
          <h2 className="section-label mb-2">担当者メモ</h2>
          <div className="rounded-xl p-4" style={{ border: '1px solid var(--color-border)', minHeight: 100 }} />
        </section>

        {/* フッター */}
        <footer className="pt-4" style={{ borderTop: '1px solid var(--color-border)' }} />
      </div>
    </div>
  )
}

function priorityLabel(priority: Suggestion['priority']): string {
  if (priority === 'high') return '重要'
  if (priority === 'medium') return '推奨'
  return '参考'
}

function PrintRow({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
      <td className="py-2 pr-4 font-semibold text-xs w-28" style={{ color: 'var(--color-text-muted)' }}>{label}</td>
      <td className="py-2 text-sm" style={{ color: 'var(--color-text)' }}>{value}</td>
    </tr>
  )
}
