'use client'

import { useState } from 'react'
import type { Question, AnswerValue } from '@/lib/planning/types'

interface Props {
  question: Question
  onSubmit: (value: AnswerValue) => void
}

export default function QuestionInput({ question, onSubmit }: Props) {
  const [value, setValue] = useState<string>('')
  const [selected, setSelected] = useState<string[]>([])
  const [otherText, setOtherText] = useState('')

  function handleTextSubmit() {
    const v = value.trim()
    if (question.required && !v) return
    onSubmit(v || null)
    setValue('')
  }

  function handleSelectSubmit(opt: string) {
    onSubmit(opt)
  }

  function handleMultiSubmit() {
    const all = otherText.trim() ? [...selected, otherText.trim()] : [...selected]
    if (question.required && all.length === 0) return
    onSubmit(all.length > 0 ? all : null)
    setSelected([])
    setOtherText('')
  }

  function toggleMulti(opt: string) {
    setSelected(prev =>
      prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt]
    )
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 12,
    border: '1.5px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    fontSize: 15,
    outline: 'none',
  } as React.CSSProperties

  if (question.type === 'select') {
    return (
      <div className="flex flex-col gap-2">
        {(question.options ?? []).map(opt => (
          <button
            key={opt}
            onClick={() => handleSelectSubmit(opt)}
            className="text-sm py-3 px-4 rounded-2xl text-left active:opacity-70 transition-opacity"
            style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', color: 'var(--color-text)' }}
          >
            {opt}
          </button>
        ))}
        {!question.required && (
          <button
            onClick={() => onSubmit(null)}
            className="text-sm py-2 px-4 rounded-2xl text-left"
            style={{ color: 'var(--color-text-muted)' }}
          >
            スキップ
          </button>
        )}
      </div>
    )
  }

  if (question.type === 'multi_select') {
    const canSubmit = !question.required || selected.length > 0 || otherText.trim().length > 0
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {(question.options ?? []).map(opt => (
            <button
              key={opt}
              onClick={() => toggleMulti(opt)}
              className="text-sm py-2 px-4 rounded-full transition-colors"
              style={
                selected.includes(opt)
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
            placeholder="その他（自由記入）"
            value={otherText}
            onChange={e => setOtherText(e.target.value)}
          />
        )}
        <button
          onClick={handleMultiSubmit}
          disabled={!canSubmit}
          className="btn-primary py-3 mt-1 disabled:opacity-40"
        >
          決定
        </button>
      </div>
    )
  }

  if (question.type === 'textarea') {
    return (
      <div className="flex flex-col gap-2">
        <textarea
          style={{ ...inputStyle, minHeight: 80, resize: 'none' }}
          placeholder={question.placeholder ?? ''}
          value={value}
          onChange={e => setValue(e.target.value)}
          rows={3}
        />
        <button
          onClick={handleTextSubmit}
          disabled={question.required && !value.trim()}
          className="btn-primary py-3 disabled:opacity-40"
        >
          送信
        </button>
      </div>
    )
  }

  // text / number / tel / email / date
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 items-center">
        <input
          style={inputStyle}
          type={question.type}
          placeholder={question.placeholder ?? ''}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleTextSubmit() }}
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
      <button
        onClick={handleTextSubmit}
        disabled={question.required && !value.trim()}
        className="btn-primary py-3 disabled:opacity-40"
      >
        送信
      </button>
    </div>
  )
}
