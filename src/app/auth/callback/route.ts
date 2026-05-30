import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function getSafeNextPath(next: string | null) {
  if (!next) return '/dashboard'
  if (!next.startsWith('/') || next.startsWith('//')) return '/dashboard'
  return next
}

// メール確認リンクのコールバック用
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = getSafeNextPath(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      return NextResponse.redirect(`${origin}/login`)
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
