'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CocoriaLogo } from '@/components/CocoriaLogo'

const PUBLIC_SIGNUP_ENABLED = false

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [isResetMode, setIsResetMode] = useState(false)
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

    if (isSignUp && !PUBLIC_SIGNUP_ENABLED) {
      setError('現在、新規登録は招待された方のみに限定しています。')
      setLoading(false)
      return
    }

    if (isSignUp) {
      const { error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) {
        setError('登録に失敗しました。入力内容を確認してください。')
      } else {
        setMessage('登録が完了しました。ログインしてください。')
        setIsSignUp(false)
      }
      setLoading(false)
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError('メールアドレスまたはパスワードが正しくありません。')
    } else {
      router.push('/dashboard')
      router.refresh()
    }
    setLoading(false)
  }

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })

    if (resetError) {
      setError('再設定メールを送信できませんでした。少し時間をおいて再度お試しください。')
    } else {
      setMessage('パスワード再設定メールを送信しました。メール内のリンクから新しいパスワードを設定してください。')
    }

    setLoading(false)
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{ background: 'linear-gradient(160deg, #fdf2f8 0%, #fff5f9 100%)' }}
    >
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

      <div className="card w-full max-w-sm">
        <h2 className="text-lg font-bold mb-5 text-center" style={{ color: 'var(--color-text)' }}>
          {isResetMode ? 'パスワード再設定' : isSignUp ? '新規登録' : 'ログイン'}
        </h2>

        <form onSubmit={isResetMode ? handlePasswordReset : handleEmailAuth} className="space-y-4">
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
          {!isResetMode && (
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
          )}

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
            {loading ? '処理中...' : isResetMode ? '再設定メールを送る' : isSignUp ? '登録する' : 'ログイン'}
          </button>
        </form>

        {!isSignUp && (
          <button
            onClick={() => { setIsResetMode(!isResetMode); setError(null); setMessage(null) }}
            className="w-full mt-4 text-sm text-center"
            style={{ color: 'var(--color-primary-dark)' }}
          >
            {isResetMode ? 'ログイン画面に戻る' : 'パスワードを忘れた方はこちら'}
          </button>
        )}

        {isResetMode ? (
          <p className="mt-4 text-xs text-center leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            メールが届かない場合は、迷惑メールフォルダも確認してください。
          </p>
        ) : PUBLIC_SIGNUP_ENABLED ? (
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(null); setMessage(null) }}
            className="w-full mt-4 text-sm text-center"
            style={{ color: 'var(--color-primary-dark)' }}
          >
            {isSignUp ? 'すでにアカウントをお持ちの方はこちら' : 'アカウントをお持ちでない方はこちら'}
          </button>
        ) : (
          <p className="mt-4 text-xs text-center leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            新規登録は招待制です。利用開始をご希望の方は管理者にお問い合わせください。
          </p>
        )}
      </div>

      <p className="mt-6 text-xs text-center leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
        ログインすることで
        <a href="/privacy" className="underline mx-1" style={{ color: 'var(--color-primary-dark)' }}>
          プライバシーポリシー
        </a>
        と
        <a href="/terms" className="underline mx-1" style={{ color: 'var(--color-primary-dark)' }}>
          利用規約
        </a>
        に同意したものとみなします。
      </p>
    </div>
  )
}
