import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { AllAnswers } from '@/lib/planning/types'
import PlanningFormClient, { type CustomerPrefill } from './PlanningFormClient'

export const dynamic = 'force-dynamic'

export default async function PlanningFormPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>
}) {
  const { id, sessionId } = await params
  const supabase = await createClient()

  const [sessionRes, customerRes] = await Promise.all([
    supabase
      .from('planning_sessions')
      .select('id, customer_id, planning_answers(section_id, answers)')
      .eq('id', sessionId)
      .maybeSingle(),
    supabase
      .from('customers')
      .select('name_kanji, name_kana, address, phone, email')
      .eq('id', id)
      .maybeSingle(),
  ])

  const session = sessionRes.data as
    | { id: string; customer_id: string; planning_answers: { section_id: string; answers: AllAnswers[string] }[] | null }
    | null

  // 他人のセッションはRLSで取れないので、ここに来たらnotFound
  if (!session || session.customer_id !== id) notFound()

  const answers: AllAnswers = {}
  for (const row of session.planning_answers ?? []) {
    answers[row.section_id] = row.answers
  }

  return (
    <PlanningFormClient
      customerId={id}
      sessionId={sessionId}
      initialAnswers={answers}
      prefill={(customerRes.data ?? null) as CustomerPrefill | null}
    />
  )
}
