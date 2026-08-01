import { createClient } from '@/lib/supabase/server'
import ScheduleClient, { type ScheduleVisit, type RecurringCustomer } from './ScheduleClient'

export const dynamic = 'force-dynamic'

export default async function SchedulePage() {
  const supabase = await createClient()

  const now = new Date()
  const from = new Date(now)
  from.setDate(from.getDate() - 14)
  const to = new Date(now)
  to.setDate(to.getDate() + 90)

  const toKey = (date: Date) => date.toISOString().split('T')[0]

  const [visitsRes, recurringRes] = await Promise.all([
    supabase
      .from('visits')
      .select('id, customer_id, visit_date, start_time, end_time, report_sent, checklist, customers(name_kanji, is_recurring)')
      .gte('visit_date', toKey(from))
      .lte('visit_date', toKey(to))
      .order('visit_date', { ascending: true })
      .order('start_time', { ascending: true }),
    supabase
      .from('customers')
      .select('id, name_kanji, recurring_note, pipeline_stage')
      .eq('is_recurring', true)
      .order('name_kanji'),
  ])

  return (
    <ScheduleClient
      visits={(visitsRes.data ?? []) as unknown as ScheduleVisit[]}
      recurringCustomers={(recurringRes.data ?? []) as RecurringCustomer[]}
      today={toKey(now)}
    />
  )
}
