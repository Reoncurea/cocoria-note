'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import questionsConfig from '@/lib/planning/questions.json'
import type { AllAnswers, AnswerValue, Section } from '@/lib/planning/types'
import ProgressBar from '../_components/ProgressBar'
import ChatMessage from '../_components/ChatMessage'
import QuestionInput from '../_components/QuestionInput'

interface ChatItem {
  role: 'bot' | 'user'
  text: string
  sectionIdx?: number
  questionIdx?: number
}

const sections = questionsConfig.sections as Section[]

function shouldShowSection(section: Section, answers: AllAnswers): boolean {
  if (!section.show_if) return true
  const { section: sec, question: qid, includes, equals } = section.show_if
  const val = answers[sec]?.[qid]
  if (!val) return false
  const str = Array.isArray(val) ? val.join(' ') : String(val)
  if (equals) return str === equals
  return includes ? str.includes(includes) : true
}

function answerToText(value: AnswerValue): string {
  if (value == null || value === '') return '（スキップ）'
  if (Array.isArray(value)) return value.length > 0 ? value.join('、') : '（スキップ）'
  return String(value)
}

function hasAnswer(value: AnswerValue | undefined): boolean {
  if (value == null || value === '') return false
  if (Array.isArray(value)) return value.length > 0
  return true
}

function isBasicComplete(answers: AllAnswers): boolean {
  const basic = sections.find(s => s.id === 'basic')
  if (!basic) return false
  return basic.questions
    .filter(q => q.required)
    .every(q => hasAnswer(answers.basic?.[q.id]))
}

function firstVisibleSectionIndex(answers: AllAnswers): number {
  let index = isBasicComplete(answers) ? 1 : 0
  while (index < sections.length && !shouldShowSection(sections[index], answers)) {
    index++
  }
  return Math.min(index, sections.length - 1)
}

function buildChatLog(section: Section): ChatItem[] {
  const messages: ChatItem[] = []
  if (section.intro) messages.push({ role: 'bot', text: section.intro })
  messages.push({ role: 'bot', text: section.questions[0].label })
  return messages
}

async function saveSection(sessionId: string, sectionId: string, sectionAnswers: AllAnswers[string]) {
  await fetch(`/api/planning/sessions/${sessionId}/answers`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ section_id: sectionId, answers: sectionAnswers }),
  })
}

export default function PlanningChatPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>()
  const router = useRouter()

  const [answers, setAnswers] = useState<AllAnswers>({})
  const [sectionIdx, setSectionIdx] = useState(0)
  const [questionIdx, setQuestionIdx] = useState(0)
  const [chatLog, setChatLog] = useState<ChatItem[]>([])
  const [repeatCount, setRepeatCount] = useState(0)
  const [askRepeat, setAskRepeat] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/planning/sessions/${sessionId}`)
      const data = await res.json()
      const map: AllAnswers = {}
      for (const row of data.answers ?? []) {
        map[row.section_id] = row.answers
      }

      const startIndex = firstVisibleSectionIndex(map)
      const startSection = sections[startIndex]
      setAnswers(map)
      setSectionIdx(startIndex)
      setQuestionIdx(0)
      setChatLog(buildChatLog(startSection))
      setLoading(false)
    }
    load()
  }, [sessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatLog, askRepeat])

  const visibleSectionCount = sections.filter(s => shouldShowSection(s, answers)).length
  const currentSection = sections[sectionIdx]
  const currentQuestion = currentSection?.questions[questionIdx]

  async function handleAnswer(value: AnswerValue) {
    if (!currentSection || !currentQuestion) return

    const newSectionAnswers = {
      ...(answers[currentSection.id] ?? {}),
      [currentQuestion.id]: value,
    }
    const newAnswers: AllAnswers = { ...answers, [currentSection.id]: newSectionAnswers }
    setAnswers(newAnswers)

    setChatLog(prev => [
      ...prev,
      { role: 'user', text: answerToText(value), sectionIdx, questionIdx },
    ])

    const isLastQuestion = questionIdx === currentSection.questions.length - 1
    if (!isLastQuestion) {
      const nextQ = currentSection.questions[questionIdx + 1]
      setQuestionIdx(questionIdx + 1)
      setTimeout(() => {
        setChatLog(prev => [...prev, { role: 'bot', text: nextQ.label }])
      }, 300)
      return
    }

    setSaving(true)
    await saveSection(sessionId, currentSection.id, newSectionAnswers)
    setSaving(false)

    if (currentSection.repeatable && repeatCount < (currentSection.repeatable.max - 1)) {
      setAskRepeat(true)
      return
    }

    goToNextSection(newAnswers)
  }

  function goToNextSection(currentAnswers: AllAnswers = answers) {
    setAskRepeat(false)
    setRepeatCount(0)

    let next = sectionIdx + 1
    while (next < sections.length && !shouldShowSection(sections[next], currentAnswers)) {
      next++
    }

    if (next >= sections.length) {
      router.push(`/customers/${id}/planning/${sessionId}/review`)
      return
    }

    const nextSection = sections[next]
    setSectionIdx(next)
    setQuestionIdx(0)
    setChatLog(prev => [...prev, ...buildChatLog(nextSection)])
  }

  function handleRepeatYes() {
    setAskRepeat(false)
    setRepeatCount(c => c + 1)
    setQuestionIdx(0)
    if (currentSection) {
      setChatLog(prev => [...prev, ...buildChatLog(currentSection)])
    }
  }

  function startEdit(si: number, qi: number) {
    setSectionIdx(si)
    setQuestionIdx(qi)
    const q = sections[si].questions[qi]
    setChatLog(prev => [...prev, { role: 'bot', text: `「${q.label}」を修正します。` }, { role: 'bot', text: q.label }])
  }

  if (loading || !currentSection || !currentQuestion) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--color-primary)' }} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-svh">
      <ProgressBar
        current={Math.min(sectionIdx + 1, visibleSectionCount)}
        total={visibleSectionCount}
        title={currentSection.title}
      />

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {chatLog.map((msg, i) => (
          <ChatMessage
            key={i}
            role={msg.role}
            text={msg.text}
            onEdit={
              msg.role === 'user' && msg.sectionIdx !== undefined && msg.questionIdx !== undefined
                ? () => startEdit(msg.sectionIdx!, msg.questionIdx!)
                : undefined
            }
          />
        ))}

        {askRepeat && (
          <div className="space-y-2">
            <ChatMessage
              role="bot"
              text={`${currentSection.repeatable?.itemLabel ?? '項目'}をもう1件追加しますか？`}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={handleRepeatYes} className="btn-primary text-sm py-2 px-5">はい</button>
              <button onClick={() => goToNextSection()} className="btn-secondary text-sm py-2 px-5">いいえ</button>
            </div>
          </div>
        )}

        {saving && (
          <p className="text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>保存中...</p>
        )}
        <div ref={bottomRef} />
      </div>

      {!askRepeat && (
        <div
          className="px-4 py-4 border-t space-y-2"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
        >
          {currentSection.skippable && questionIdx === 0 && (
            <button
              onClick={() => goToNextSection()}
              className="w-full text-sm py-2"
              style={{ color: 'var(--color-text-muted)' }}
            >
              このセクションをスキップ
            </button>
          )}
          <QuestionInput
            key={`${sectionIdx}-${questionIdx}`}
            question={currentQuestion}
            onSubmit={handleAnswer}
          />
        </div>
      )}
    </div>
  )
}
