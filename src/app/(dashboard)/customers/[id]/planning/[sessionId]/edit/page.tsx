'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import questionsConfig from '@/lib/planning/questions.json'
import type { AllAnswers, AnswerValue, Section, Question } from '@/lib/planning/types'

const sections = questionsConfig.sections as Section[]

function shouldShowSection(section: Section, answers: AllAnswers): boolean {
  if (!section.show_if) return true
  const { section: sec, question: qid, includes } = section.show_if
  const val = answers[sec]?.[qid]
  if (!val) return false
  const str = Array.isArray(val) ? val.join(' ') : String(val)
  return includes ? str.includes(includes) : true
}

// 個別質問の入力フィールド
function AnswerField({
  question,
  value,
  onChange,
}: {
  question: Question
  value: AnswerValue
  onChange: (v: AnswerValue) => void
}) {
  const strVal = value == null ? '' : Array.isArray(value) ? '' : String(value)
  const arrVal: string[] = Array.isArray(value) ? value : []

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 10,
    border: '1.5px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    fontSize: 14,
    outline: 'none',
  } as React.CSSProperties

  if (question.type === 'select') {
    return (
      <div className="flex flex-wrap gap-2">
        {(question.options ?? []).map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className="text-sm py-1.5 px-3 rounded-full transition-colors"
            style={
              strVal === opt
                ? { background: 'var(--color-primary)', color: '#fff', border: '1.5px solid var(--color-primary)' }
                : { background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', color: 'var(--color-text)' }
            }
          >
            {opt}
          </button>
        ))}
        {!question.required && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-sm py-1.5 px-3 rounded-full"
            style={{ border: '1.5px solid var(--color-border)', color: 'var(--color-text-muted)' }}
          >
            未回答
          </button>
        )}
      </div>
    )
  }

  if (question.type === 'multi_select') {
    const fixedOptions = question.options ?? []
    const otherValues = arrVal.filter(v => !fixedOptions.includes(v))
    const otherText = otherValues.join('、')

    function toggle(opt: string) {
      if (arrVal.includes(opt)) {
        onChange(arrVal.filter(o => o !== opt))
      } else {
        onChange([...arrVal, opt])
      }
    }

    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {fixedOptions.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className="text-sm py-1.5 px-3 rounded-full transition-colors"
              style={
                arrVal.includes(opt)
                  ? { background: 'var(--color-primary)', color: '#fff', border: '1.5px solid var(--color-primary)' }
                  : { background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', color: 'var(--color-text)' }
              }
            >
              {opt}
            </button>
          ))}
        </div>
        {question.allow_other && (
          <input
            style={inputStyle}
            placeholder="その他（カンマ区切り）"
            value={otherText}
            onChange={e => {
              const extras = e.target.value ? e.target.value.split(/[,、]/).map(s => s.trim()).filter(Boolean) : []
              onChange([...arrVal.filter(v => fixedOptions.includes(v)), ...extras])
            }}
          />
        )}
      </div>
    )
  }

  if (question.type === 'textarea') {
    return (
      <textarea
        style={{ ...inputStyle, minHeight: 72, resize: 'none' }}
        placeholder={question.placeholder ?? ''}
        value={strVal}
        onChange={e => onChange(e.target.value || null)}
        rows={3}
      />
    )
  }

  return (
    <div className="flex items-center gap-2">
      <input
        style={inputStyle}
        type={question.type}
        placeholder={question.placeholder ?? ''}
        value={strVal}
        onChange={e => onChange(e.target.value || null)}
      />
      {question.unit && (
        <span className="text-sm flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
          {question.unit}
        </span>
      )}
    </div>
  )
}

export default function PlanningEditPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>()
  const router = useRouter()

  const [answers, setAnswers] = useState<AllAnswers>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/planning/sessions/${sessionId}`)
      .then(r => r.json())
      .then(data => {
        const map: AllAnswers = {}
        for (const row of data.answers ?? []) {
          map[row.section_id] = row.answers
        }
        setAnswers(map)
        setLoading(false)
      })
  }, [sessionId])

  function setAnswer(sectionId: string, questionId: string, value: AnswerValue) {
    setAnswers(prev => ({
      ...prev,
      [sectionId]: { ...(prev[sectionId] ?? {}), [questionId]: value },
    }))
  }

  async function handleSave() {
    setSaving(true)
    const visibleSections = sections.filter(s => shouldShowSection(s, answers))
    await Promise.all(
      visibleSections.map(s =>
        fetch(`/api/planning/sessions/${sessionId}/answers`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section_id: s.id, answers: answers[s.id] ?? {} }),
        })
      )
    )
    setSaving(false)
    router.push(`/customers/${id}/planning/${sessionId}/review`)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--color-primary)' }} />
      </div>
    )
  }

  const visibleSections = sections.filter(s => shouldShowSection(s, answers))

  return (
    <div className="px-4 pt-6 pb-32 space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 -ml-2">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
            style={{ color: 'var(--color-text)' }}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="page-title flex-1">回答を修正</h1>
      </div>

      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
        各セクションの回答を編集して「保存して提案を再生成」を押してください。
      </p>

      {visibleSections.map(section => (
        <div key={section.id} className="card space-y-4">
          <p className="section-label">{section.title}</p>
          {section.questions.map(q => (
            <div key={q.id} className="space-y-1.5">
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                {q.label}
                {q.required && <span style={{ color: 'var(--color-primary-dark)' }}> *</span>}
              </p>
              {q.hint && (
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{q.hint}</p>
              )}
              <AnswerField
                question={q}
                value={answers[section.id]?.[q.id] ?? null}
                onChange={v => setAnswer(section.id, q.id, v)}
              />
            </div>
          ))}
        </div>
      ))}

      {/* 固定フッター */}
      <div className="fixed bottom-0 left-0 right-0 px-4 py-4 border-t"
        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary w-full py-3 disabled:opacity-40"
        >
          {saving ? '保存中...' : '保存して提案を再生成'}
        </button>
      </div>
    </div>
  )
}
