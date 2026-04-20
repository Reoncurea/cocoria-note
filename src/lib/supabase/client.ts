import { createBrowserClient } from '@supabase/ssr'

// ブラウザ用Supabaseクライアント
// Supabaseプロジェクト設定後、`npx supabase gen types typescript`で型を自動生成して置き換え可能
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://placeholder.supabase.co'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-key'
  return createBrowserClient(url, key)
}
