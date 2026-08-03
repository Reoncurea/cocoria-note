import { createClient } from '@/lib/supabase/server'
import CustomersListClient, { type CustomerListItem } from './CustomersListClient'

export const dynamic = 'force-dynamic'

export default async function CustomersPage() {
  const supabase = await createClient()

  // サーバー側で取り切ってからHTMLを返す。
  // 以前はクライアントで取っていたので、移動のたびに空のスピナーが挟まっていた。
  const { data } = await supabase
    .from('customers')
    .select('id, name_kanji, name_kana, inquiry_date, pipeline_stage, stage_updated_at, is_recurring, hold_state, hold_reason, hold_until')
    .order('created_at', { ascending: false })

  return <CustomersListClient customers={(data ?? []) as CustomerListItem[]} />
}
