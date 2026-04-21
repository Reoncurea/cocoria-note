import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateSuggestions } from '@/lib/planning/engine'
import type { AllAnswers } from '@/lib/planning/types'

type Params = { params: Promise<{ id: string }> }

// POST: 全回答を読み込んでルールエンジンを走らせ、提案をDBに保存
export async function POST(_request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 回答データ取得
  const { data: answerRows, error: fetchError } = await supabase
    .from('planning_answers')
    .select('section_id, answers')
    .eq('session_id', id)

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

  // AllAnswers 形式に変換
  const all: AllAnswers = {}
  for (const row of answerRows ?? []) {
    all[row.section_id] = row.answers as AllAnswers[string]
  }

  // ルールエンジン実行
  const suggestions = generateSuggestions(all)

  // 既存の提案を全削除してから再挿入（再生成）
  await supabase.from('planning_suggestions').delete().eq('session_id', id)

  if (suggestions.length > 0) {
    const rows = suggestions.map((s, i) => ({
      session_id: id,
      rule_id: s.rule_id,
      priority: s.priority,
      category: s.category,
      title: s.title,
      body: s.body,
      display_order: i,
    }))

    const { error: insertError } = await supabase.from('planning_suggestions').insert(rows)
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // セッションを completed に更新
  await supabase
    .from('planning_sessions')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ count: suggestions.length })
}
