'use client'

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { UserProfile } from '@/types/database'

const ROLE_LABELS = {
  admin: '管理者',
  user: '業務用',
  supporter: '支援者',
} as const

const ONBOARDING_LABELS = {
  pending: '初回確認前',
  completed: '確認済み',
} as const

const SUBSCRIPTION_LABELS = {
  trialing: '試用中',
  active: '有効',
  past_due: '確認必要',
  canceled: '停止中',
} as const

type EditableField = 'role' | 'onboarding_status' | 'subscription_status'

function getErrorText(body: { error?: unknown } | null, fallback: string) {
  if (typeof body?.error === 'string') return body.error
  return fallback
}

export default function AdminUsersClient() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'user' | 'supporter'>('user')
  const [inviteStatus, setInviteStatus] = useState<'trialing' | 'active'>('trialing')
  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false

    async function loadUsers() {
      const response = await fetch('/api/admin/users', { cache: 'no-store' })
      if (!response.ok) {
        if (!ignore) {
          setError('ユーザー一覧を読み込めませんでした')
          setLoading(false)
        }
        return
      }

      const data = await response.json() as UserProfile[]
      if (!ignore) {
        setUsers(data)
        setLoading(false)
      }
    }

    void loadUsers()
    return () => { ignore = true }
  }, [])

  async function updateUser(userId: string, field: EditableField, value: string) {
    setSavingId(userId)
    setMessage(null)
    setError(null)

    const response = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string } | null
      setError(getErrorText(body, '更新できませんでした'))
      setSavingId(null)
      return
    }

    const updated = await response.json() as UserProfile
    setUsers(prev => prev.map(user => user.user_id === updated.user_id ? updated : user))
    setMessage('更新しました')
    setSavingId(null)
  }

  async function inviteUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = inviteEmail.trim()
    if (!email) return

    setInviting(true)
    setMessage(null)
    setError(null)

    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        role: inviteRole,
        onboarding_status: 'pending',
        subscription_status: inviteStatus,
      }),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string } | null
      setError(getErrorText(body, '招待メールを送信できませんでした'))
      setInviting(false)
      return
    }

    const invited = await response.json() as UserProfile
    setUsers(prev => [invited, ...prev.filter(user => user.user_id !== invited.user_id)])
    setInviteEmail('')
    setInviteRole('user')
    setInviteStatus('trialing')
    setMessage('招待メールを送信しました')
    setInviting(false)
  }

  async function resendInvite(user: UserProfile) {
    if (user.onboarding_status !== 'pending') {
      setError('再送できるのは初回確認前のユーザーだけです')
      return
    }

    setActionId(user.user_id)
    setMessage(null)
    setError(null)

    const response = await fetch(`/api/admin/users/${user.user_id}/resend-invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        role: user.role,
        onboarding_status: user.onboarding_status,
        subscription_status: user.subscription_status,
      }),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string } | null
      setError(getErrorText(body, '招待メールを再送できませんでした'))
      setActionId(null)
      return
    }

    const resent = await response.json() as UserProfile
    setUsers(prev => [resent, ...prev.filter(item => item.user_id !== user.user_id && item.user_id !== resent.user_id)])
    setMessage('招待メールを再送しました')
    setActionId(null)
  }

  async function deleteInvite(user: UserProfile) {
    if (user.onboarding_status !== 'pending') {
      setError('削除できるのは初回確認前の招待だけです')
      return
    }

    const ok = window.confirm(`${user.email ?? 'このユーザー'} の未完了招待を削除します。よろしいですか？`)
    if (!ok) return

    setActionId(user.user_id)
    setMessage(null)
    setError(null)

    const response = await fetch(`/api/admin/users/${user.user_id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        onboarding_status: user.onboarding_status,
      }),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string } | null
      setError(getErrorText(body, '招待を削除できませんでした'))
      setActionId(null)
      return
    }

    setUsers(prev => prev.filter(item => item.user_id !== user.user_id))
    setMessage('未完了の招待を削除しました')
    setActionId(null)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--color-primary)' }} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <form onSubmit={inviteUser} className="card space-y-4">
        <div>
          <p className="section-label">新規招待</p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            メールアドレスを入力すると、Supabaseから招待メールが送信されます。招待直後は初回確認前として登録されます。
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_160px_160px_auto] md:items-end">
          <label>
            <span className="form-label">メールアドレス</span>
            <input
              className="input"
              type="email"
              value={inviteEmail}
              onChange={event => setInviteEmail(event.target.value)}
              placeholder="example@example.com"
              disabled={inviting}
              required
            />
          </label>

          <SelectField
            label="権限"
            value={inviteRole}
            disabled={inviting}
            options={{ user: '業務用', supporter: '支援者' }}
            onChange={value => setInviteRole(value as 'user' | 'supporter')}
          />

          <SelectField
            label="利用状態"
            value={inviteStatus}
            disabled={inviting}
            options={{ trialing: '試用中', active: '有効' }}
            onChange={value => setInviteStatus(value as 'trialing' | 'active')}
          />

          <button
            type="submit"
            disabled={inviting || !inviteEmail.trim()}
            className="btn-primary disabled:opacity-60"
          >
            {inviting ? '送信中...' : '招待する'}
          </button>
        </div>
      </form>

      {message && (
        <div className="px-4 py-3 rounded-xl text-sm" style={{ background: '#ecfdf5', color: '#047857' }}>
          {message}
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-xl text-sm" style={{ background: '#fef2f2', color: '#dc2626' }}>
          {error}
        </div>
      )}

      <div className="grid gap-3">
        {users.map(user => (
          <article key={user.user_id} className="card space-y-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>
                  {user.email ?? 'メール未設定'}
                </p>
                <p className="text-xs break-all" style={{ color: 'var(--color-text-muted)' }}>
                  {user.user_id}
                </p>
              </div>
              <StatusBadge status={user.subscription_status} />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <SelectField
                label="権限"
                value={user.role}
                disabled={savingId === user.user_id}
                options={ROLE_LABELS}
                onChange={value => updateUser(user.user_id, 'role', value)}
              />
              <SelectField
                label="初回確認"
                value={user.onboarding_status}
                disabled={savingId === user.user_id}
                options={ONBOARDING_LABELS}
                onChange={value => updateUser(user.user_id, 'onboarding_status', value)}
              />
              <SelectField
                label="利用状態"
                value={user.subscription_status}
                disabled={savingId === user.user_id}
                options={SUBSCRIPTION_LABELS}
                onChange={value => updateUser(user.user_id, 'subscription_status', value)}
              />
            </div>

            <div className="grid gap-1 text-xs sm:grid-cols-2" style={{ color: 'var(--color-text-muted)' }}>
              <p>招待: {formatDate(user.invited_at)}</p>
              <p>初回完了: {formatDate(user.accepted_at)}</p>
              <p>作成: {formatDate(user.created_at)}</p>
              <p>更新: {formatDate(user.updated_at)}</p>
            </div>

            {user.onboarding_status === 'pending' && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={actionId === user.user_id}
                  onClick={() => resendInvite(user)}
                  className="btn-secondary disabled:opacity-60"
                >
                  {actionId === user.user_id ? '処理中...' : '招待メールを再送'}
                </button>
                <button
                  type="button"
                  disabled={actionId === user.user_id}
                  onClick={() => deleteInvite(user)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
                  style={{ background: '#fef2f2', color: '#dc2626' }}
                >
                  招待を削除
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}

function SelectField<T extends Record<string, string>>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string
  value: keyof T & string
  options: T
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <label>
      <span className="form-label">{label}</span>
      <select
        className="input"
        value={value}
        disabled={disabled}
        onChange={event => onChange(event.target.value)}
      >
        {Object.entries(options).map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  )
}

function StatusBadge({ status }: { status: UserProfile['subscription_status'] }) {
  const style =
    status === 'active' || status === 'trialing'
      ? { background: '#dcfce7', color: '#166534' }
      : status === 'past_due'
        ? { background: '#fef3c7', color: '#92400e' }
        : { background: '#fee2e2', color: '#991b1b' }

  return (
    <span className="badge self-start" style={style}>
      {SUBSCRIPTION_LABELS[status]}
    </span>
  )
}

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('ja-JP')
}
