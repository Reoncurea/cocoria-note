'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, ChevronUp, Save, Wand2 } from 'lucide-react'
import questionsConfig from '@/lib/planning/questions.json'
import type { AllAnswers, AnswerValue, Question, Section } from '@/lib/planning/types'

export type CustomerPrefill = {
  name_kanji: string | null
  name_kana: string | null
  address: string | null
  phone: string | null
  email: string | null
}

const sections = questionsConfig.sections as Section[]

/** カルテの項目 → プランニングの質問 の対応 */
const PREFILL_MAP: { section: string; question: string; from: keyof CustomerPrefill }[] = [
  { section: 'basic', question: 'name', from: 'name_kanji' },
  { section: 'basic', question: 'name_kana', from: 'name_kana' },
  { section: 'basic', question: 'address', from: 'address' },
  { section: 'basic', question: 'phone', from: 'phone' },
  { section: 'basic', question: 'email', from: 'email' },
]

function hasAnswer(value: AnswerValue | undefined): boolean {
  if (value == null || value === '') return false
  if (Array.isArray(value)) return value.length > 0
  return true
}

function shouldShowSection(section: Section, answers: AllAnswers): boolean {
  if (!section.show_if) return true
  const { section: sec, question: qid, includes, equals } = section.show_if
  const value = answers[sec]?.[qid]
  if (!value) return false
  const text = Array.isArray(value) ? value.join(' ') : String(value)
  if (equals) return text === equals
  return includes ? text.includes(includes) : true
}

function toText(value: AnswerValue | undefined): string {
  if (value == null || Array.isArray(value)) return ''
  return String(value)
}

function toArray(value: AnswerValue | undefined): string[] {
  return Array.isArray(value) ? value : []
}

export default function PlanningFormClient({
  customerId,
  sessionId,
  initialAnswers,
  prefill,
}: {
  customerId: string
  sessionId: string
  initialAnswers: AllAnswers
  prefill: CustomerPrefill | null
}) {
  const router = useRouter()
  const [answers, setAnswers] = useState<AllAnswers>(initialAnswers)
  const [openSection, setOpenSection] = useState<string | null>(sections[0]?.id ?? null)
  const [showAll, setShowAll] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** 保存が必要なセクション */
  const [dirty, setDirty] = useState<Set<string>>(new Set())

  const visibleSections = useMemo(
    () => showAll ? sections : sections.filter(section => shouldShowSection(section, answers)),
    [answers, showAll],
  )

  const progress = useMemo(() => {
    let done = 0
    let total = 0
    for (const section of visibleSections) {
      for (const question of section.questions) {
        total++
        if (hasAnswer(answers[section.id]?.[question.id])) done++
      }
    }
    return { done, total }
  }, [answers, visibleSections])

  const prefillTargets = useMemo(() => {
    if (!prefill) return []
    return PREFILL_MAP.filter(item => {
      const source = prefill[item.from]
      if (!source) return false
      return !hasAnswer(answers[item.section]?.[item.question])
    })
  }, [answers, prefill])

  function setAnswer(sectionId: string, questionId: string, value: AnswerValue) {
    setAnswers(prev => ({
      ...prev,
      [sectionId]: { ...(prev[sectionId] ?? {}), [questionId]: value },
    }))
    setDirty(prev => new Set(prev).add(sectionId))
    setSavedAt(null)
  }

  function applyPrefill() {
    if (!prefill) return
    setAnswers(prev => {
      const next = { ...prev }
      const touched = new Set<string>()
      for (const item of prefillTargets) {
        const value = prefill[item.from]
        if (!value) continue
        next[item.section] = { ...(next[item.section] ?? {}), [item.question]: value }
        touched.add(item.section)
      }
      setDirty(current => new Set([...current, ...touched]))
      return next
    })
    setSavedAt(null)
  }

  async function save(sectionIds?: string[]) {
    const targets = sectionIds ?? Array.from(dirty)
    if (targets.length === 0) return

    setSaving(true)
    setError(null)

    const responses = await Promise.all(targets.map(sectionId =>
      fetch(`/api/planning/sessions/${sessionId}/answers`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_id: sectionId, answers: answers[sectionId] ?? {} }),
      })
    ))

    setSaving(false)

    if (responses.some(response => !response.ok)) {
      setError('保存に失敗しました。通信環境を確認して、もう一度お試しください。')
      return
    }

    setDirty(prev => {
      const next = new Set(prev)
      for (const id of targets) next.delete(id)
      return next
    })
    setSavedAt(new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }))
    router.refresh()
  }

  return (
    <div className="px-4 pt-5 space-y-4 pb-8">
      <div className="card space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="section-label mb-1">まとめて入力</p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              チャットを使わずに、わかっている項目だけ先に入力できます。
              空欄のまま残した項目は、あとからチャットで聞き取れます。
            </p>
          </div>
          <Link href={`/customers/${customerId}/planning/${sessionId}`} className="btn-secondary text-xs px-3 py-2 flex-shrink-0">
            チャットへ
          </Link>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <span>入力済み</span>
            <span>{progress.done} / {progress.total}</span>
          </div>
          <div className="rounded-full overflow-hidden" style={{ height: '6px', background: 'var(--color-border)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : '0%',
                background: 'var(--color-primary)',
              }}
            />
          </div>
        </div>

        {prefillTargets.length > 0 && (
          <button type="button" onClick={applyPrefill} className="btn-secondary w-full text-sm py-2.5">
            <Wand2 size={14} className="inline mr-1" />
            カルテの内容を{prefillTargets.length}項目に流し込む
          </button>
        )}

        <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <input type="checkbox" checked={showAll} onChange={event => setShowAll(event.target.checked)} />
          条件によって出てこない項目もすべて表示する
        </label>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-xl text-sm" style={{ background: '#fef2f2', color: '#dc2626' }}>
          {error}
        </div>
      )}

      {visibleSections.map(section => {
        const open = openSection === section.id
        const filled = section.questions.filter(q => hasAnswer(answers[section.id]?.[q.id])).length
        const isDirty = dirty.has(section.id)

        return (
          <div key={section.id} className="card space-y-3">
            <button
              type="button"
              onClick={() => setOpenSection(open ? null : section.id)}
              className="w-full flex items-center justify-between gap-3 text-left"
            >
              <div className="min-w-0">
                <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
                  {section.title}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  {filled} / {section.questions.length} 入力済み
                  {isDirty && <span style={{ color: '#c2410c' }}> · 未保存</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {filled === section.questions.length && filled > 0 && (
                  <Check size={16} style={{ color: '#16a34a' }} />
                )}
                {open
                  ? <ChevronUp size={18} style={{ color: 'var(--color-text-muted)' }} />
                  : <ChevronDown size={18} style={{ color: 'var(--color-text-muted)' }} />}
              </div>
            </button>

            {open && (
              <div className="space-y-4 pt-1">
                {section.questions.map(question => (
                  <FormField
                    key={question.id}
                    question={question}
                    value={answers[section.id]?.[question.id]}
                    onChange={value => setAnswer(section.id, question.id, value)}
                  />
                ))}

                <button
                  type="button"
                  onClick={() => save([section.id])}
                  disabled={saving || !isDirty}
                  className="btn-primary w-full text-sm py-2.5 disabled:opacity-40"
                >
                  <Save size={14} className="inline mr-1" />
                  {saving ? '保存中...' : isDirty ? 'このセクションを保存' : '保存済み'}
                </button>
              </div>
            )}
          </div>
        )
      })}

      {/* 画面下に固定の保存バー */}
      <div
        className="sticky bottom-0 -mx-4 px-4 py-3 flex items-center gap-3"
        style={{
          background: 'var(--color-background)',
          borderTop: '1px solid var(--color-border)',
          paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
        }}
      >
        <span className="text-xs flex-1" style={{ color: 'var(--color-text-muted)' }}>
          {dirty.size > 0
            ? `未保存 ${dirty.size}セクション`
            : savedAt ? `${savedAt} に保存しました` : 'すべて保存済み'}
        </span>
        <button
          type="button"
          onClick={() => save()}
          disabled={saving || dirty.size === 0}
          className="btn-primary text-sm px-5 py-2.5 disabled:opacity-40"
        >
          {saving ? '保存中...' : 'まとめて保存'}
        </button>
      </div>

      <div className="bottom-nav-spacer" />
    </div>
  )
}

function FormField({
  question,
  value,
  onChange,
}: {
  question: Question
  value: AnswerValue | undefined
  onChange: (value: AnswerValue) => void
}) {
  const options = question.options ?? []

  if (question.type === 'multi_select') {
    const selected = toArray(value)
    const fixed = selected.filter(v => options.includes(v))
    const other = selected.filter(v => !options.includes(v)).join('、')

    const emit = (nextFixed: string[], nextOther: string) => {
      const trimmed = nextOther.trim()
      const all = trimmed ? [...nextFixed, trimmed] : nextFixed
      onChange(all.length > 0 ? all : null)
    }

    return (
      <div className="space-y-2">
        <Label question={question} />
        <div className="flex flex-wrap gap-2">
          {options.map(option => {
            const active = fixed.includes(option)
            return (
              <button
                key={option}
                type="button"
                onClick={() => emit(
                  active ? fixed.filter(v => v !== option) : [...fixed, option],
                  other,
                )}
                className="text-sm py-2 px-4 rounded-full"
                style={active
                  ? { background: 'var(--color-primary)', color: '#fff', border: '1.5px solid var(--color-primary)' }
                  : { background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', color: 'var(--color-text)' }}
              >
                {option}
              </button>
            )
          })}
        </div>
        {question.allow_other && (
          <input
            className="input text-sm"
            placeholder="その他（自由記入）"
            defaultValue={other}
            onBlur={event => emit(fixed, event.target.value)}
            lang="ja"
          />
        )}
      </div>
    )
  }

  if (question.type === 'select') {
    return (
      <div className="space-y-2">
        <Label question={question} />
        <div className="flex flex-wrap gap-2">
          {options.map(option => {
            const active = toText(value) === option
            return (
              <button
                key={option}
                type="button"
                onClick={() => onChange(active ? null : option)}
                className="text-sm py-2 px-4 rounded-full"
                style={active
                  ? { background: 'var(--color-primary)', color: '#fff', border: '1.5px solid var(--color-primary)' }
                  : { background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', color: 'var(--color-text)' }}
              >
                {option}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  if (question.type === 'textarea') {
    return (
      <div className="space-y-1.5">
        <Label question={question} />
        <textarea
          className="input text-sm"
          rows={3}
          placeholder={question.placeholder ?? ''}
          value={toText(value)}
          onChange={event => onChange(event.target.value || null)}
          lang="ja"
        />
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <Label question={question} />
      <div className="flex items-center gap-2">
        <input
          className="input text-sm"
          type={question.type}
          placeholder={question.placeholder ?? ''}
          value={toText(value)}
          onChange={event => {
            const raw = event.target.value
            if (!raw) return onChange(null)
            onChange(question.type === 'number' ? Number(raw) : raw)
          }}
          inputMode={question.type === 'tel' ? 'tel' : question.type === 'email' ? 'email' : question.type === 'number' ? 'numeric' : 'text'}
          lang={question.type === 'tel' || question.type === 'email' ? undefined : 'ja'}
        />
        {question.unit && (
          <span className="text-sm flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
            {question.unit}
          </span>
        )}
      </div>
      {question.hint && (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{question.hint}</p>
      )}
    </div>
  )
}

function Label({ question }: { question: Question }) {
  return (
    <span className="form-label">
      {question.label}
      {question.required && <span style={{ color: 'var(--color-primary-dark)' }}> *</span>}
    </span>
  )
}
