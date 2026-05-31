import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CocoriaLogo } from '@/components/CocoriaLogo'
import { SignOutButton } from './SignOutButton'

export const dynamic = 'force-dynamic'

type Profile = {
  role: string
  onboarding_status: string
  subscription_status: string
  accepted_at: string | null
}

type StatusMessage = {
  title: string
  body: string
  actionType?: 'billing' | 'contact'
}

function canEnterApp(profile: Profile | null) {
  if (!profile) return false
  if (profile.onboarding_status !== 'completed') return false
  return profile.subscription_status === 'trialing' || profile.subscription_status === 'active'
}

function statusMessage(profile: Profile | null): StatusMessage {
  if (!profile) {
    return {
      title: '利用設定を確認中です',
      body: 'アカウントは作成されていますが、利用者プロフィールがまだ準備できていません。管理者に確認してください。',
      actionType: 'contact',
    }
  }

  if (profile.onboarding_status !== 'completed') {
    if (profile.accepted_at) {
      return {
        title: '利用開始設定を確認中です',
        body: 'パスワード設定は完了しています。利用開始状態の反映に時間がかかっている可能性があります。時間をおいて再度お試しください。',
        actionType: 'contact',
      }
    }

    return {
      title: 'パスワード設定がまだ完了していません',
      body: '招待メールのリンクからパスワードを設定すると、cocoria noteを利用開始できます。',
    }
  }

  if (profile.subscription_status === 'past_due') {
    return {
      title: 'お支払い状況の確認が必要です',
      body: '継続利用の前に、お支払い状況の確認が必要です。支払方法の変更や確認が必要な場合は、管理者へご連絡ください。',
      actionType: 'billing',
    }
  }

  if (profile.subscription_status === 'canceled') {
    return {
      title: '現在このアカウントは停止中です',
      body: '再開を希望する場合は、管理者に連絡してください。',
      actionType: 'contact',
    }
  }

  return {
    title: '利用状態を確認してください',
    body: '現在のアカウント状態ではアプリを利用できません。管理者に確認してください。',
    actionType: 'contact',
  }
}

function buildMailLink({
  email,
  subject,
  body,
}: {
  email: string
  subject: string
  body: string
}) {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export default async function AccountStatusPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, onboarding_status, subscription_status, accepted_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (canEnterApp(profile)) {
    redirect('/dashboard')
  }

  const message = statusMessage(profile)
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'info@cocoria.net'
  const billingMailLink = buildMailLink({
    email: supportEmail,
    subject: 'cocoria note 支払方法の確認・変更について',
    body: `cocoria noteの支払方法について確認・変更を希望します。\n\nログイン中のメールアドレス: ${user.email ?? ''}\n`,
  })
  const contactMailLink = buildMailLink({
    email: supportEmail,
    subject: 'cocoria note 利用状態について',
    body: `cocoria noteの利用状態について確認をお願いします。\n\nログイン中のメールアドレス: ${user.email ?? ''}\n`,
  })

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6 py-10"
      style={{ background: 'linear-gradient(160deg, #fdf2f8 0%, #fff5f9 100%)' }}
    >
      <section className="card w-full max-w-md text-center space-y-5">
        <div className="flex justify-center">
          <CocoriaLogo size={64} />
        </div>

        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>
            cocoria note
          </p>
          <h1 className="text-xl font-bold leading-snug" style={{ color: 'var(--color-text)' }}>
            {message.title}
          </h1>
          <p className="text-sm leading-relaxed mt-3" style={{ color: 'var(--color-text-muted)' }}>
            {message.body}
          </p>
        </div>

        <div className="rounded-xl p-3 text-left text-xs space-y-1" style={{ background: 'var(--color-surface)' }}>
          <p style={{ color: 'var(--color-text-muted)' }}>ログイン中: {user.email}</p>
          <p style={{ color: 'var(--color-text-muted)' }}>
            状態: {profile?.onboarding_status ?? '未設定'} / {profile?.subscription_status ?? '未設定'}
          </p>
          <p style={{ color: 'var(--color-text-muted)' }}>
            連絡先: {supportEmail}
          </p>
        </div>

        <div className="space-y-3">
          {message.actionType === 'billing' && (
            <a href={billingMailLink} className="btn-primary block w-full">
              支払方法について相談する
            </a>
          )}
          {message.actionType === 'contact' && (
            <a href={contactMailLink} className="btn-primary block w-full">
              管理者に連絡する
            </a>
          )}
          {!profile?.accepted_at && (
            <Link href="/set-password" className="btn-primary block w-full">
              パスワードを設定する
            </Link>
          )}
          <SignOutButton />
          <div className="flex items-center justify-center gap-4 text-xs">
            <Link href="/privacy" className="underline" style={{ color: 'var(--color-primary-dark)' }}>
              プライバシーポリシー
            </Link>
            <Link href="/terms" className="underline" style={{ color: 'var(--color-primary-dark)' }}>
              利用規約
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
