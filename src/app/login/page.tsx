'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CocoriaLogo } from '@/components/CocoriaLogo'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        if (error.message.includes('already registered') || error.message.includes('already been registered')) {
          setError('このメールアドレスは既に登録済みです。ログインしてください。')
        } else {
          setError(error.message)
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) {
          setMessage('登録が完了しました。ログインしてください。')
          setIsSignUp(false)
        } else {
          router.push('/dashboard')
          router.refresh()
        }
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError('メールアドレスまたはパスワードが正しくありません')
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{ background: 'linear-gradient(160deg, #fdf2f8 0%, #fff5f9 100%)' }}>

      {/* ロゴ・タイトル */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-3">
          <CocoriaLogo size={72} />
        </div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
          cocorianote
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
          顧客カルテ管理
        </p>
      </div>

      {/* ログインカード */}
      <div className="card w-full max-w-sm">
        <h2 className="text-lg font-bold mb-5 text-center" style={{ color: 'var(--color-text)' }}>
          {isSignUp ? '新規登録' : 'ログイン'}
        </h2>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div>
            <label className="form-label">メールアドレス</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@gmail.com"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="form-label">パスワード</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
            />
          </div>

          {error && (
            <div className="text-sm px-3 py-2 rounded-lg" style={{ background: '#fef2f2', color: '#dc2626' }}>
              {error}
            </div>
          )}
          {message && (
            <div className="text-sm px-3 py-2 rounded-lg" style={{ background: '#f0fdf4', color: '#16a34a' }}>
              {message}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
            {loading ? '処理中...' : isSignUp ? '登録する' : 'ログイン'}
          </button>
        </form>

        <button
          onClick={() => { setIsSignUp(!isSignUp); setError(null); setMessage(null) }}
          className="w-full mt-4 text-sm text-center"
          style={{ color: 'var(--color-primary-dark)' }}
        >
          {isSignUp ? '既にアカウントをお持ちの方はこちら' : 'アカウントをお持ちでない方はこちら'}
        </button>
      </div>

      <p className="mt-6 text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
        ログインすることで
        <a href="/privacy" className="underline" style={{ color: 'var(--color-primary-dark)' }}>
          プライバシーポリシー
        </a>
        に同意したものとみなします
      </p>
    </div>
  )
}
