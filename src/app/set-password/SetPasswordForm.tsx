'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function SetPasswordForm() {
  const router = useRouter()
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (password.length < 8) {
      setError('パスワードは8文字以上で設定してください。')
      return
    }

    if (password !== confirmPassword) {
      setError('確認用パスワードが一致していません。')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError('パスワードを設定できませんでした。招待メールのリンクから開き直してください。')
      setLoading(false)
      return
    }

    const acceptResponse = await fetch('/api/account/accept-invite', {
      method: 'POST',
    })

    if (!acceptResponse.ok) {
      setError('パスワードは設定されましたが、初回設定完了の記録に失敗しました。管理者に連絡してください。')
      setLoading(false)
      return
    }

    setMessage('パスワードを設定しました。利用状態を確認します。')
    router.push('/account-status')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="form-label">新しいパスワード</label>
        <input
          type="password"
          className="input"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="8文字以上"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <div>
        <label className="form-label">確認用パスワード</label>
        <input
          type="password"
          className="input"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="もう一度入力"
          required
          minLength={8}
          autoComplete="new-password"
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
        {loading ? '設定中...' : 'パスワードを設定する'}
      </button>
    </form>
  )
}
