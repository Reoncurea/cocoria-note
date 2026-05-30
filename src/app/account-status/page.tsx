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
}

function canEnterApp(profile: Profile | null) {
  if (!profile) return false
  if (profile.onboarding_status !== 'completed') return false
  return profile.subscription_status === 'trialing' || profile.subscription_status === 'active'
}

function statusMessage(profile: Profile | null) {
  if (!profile) {
    return {
      title: '利用設定を確認中です',
      body: 'アカウントは作成されていますが、利用者プロフィールがまだ準備できていません。管理者に確認してください。',
    }
  }

  if (profile.onboarding_status !== 'completed') {
    return {
      title: '初回確認がまだ完了していません',
      body: '個人情報や写真の取り扱い、利用範囲の説明が完了すると利用を開始できます。',
    }
  }

  if (profile.subscription_status === 'past_due') {
    return {
      title: 'お支払い状況の確認が必要です',
      body: '継続利用の前に、支払い状況の確認が必要です。管理者に連絡してください。',
    }
  }

  if (profile.subscription_status === 'canceled') {
    return {
      title: '現在このアカウントは停止中です',
      body: '再開を希望する場合は、管理者に連絡してください。',
    }
  }

  return {
    title: '利用状態を確認してください',
    body: '現在のアカウント状態ではアプリを利用できません。管理者に確認してください。',
  }
}

export default async function AccountStatusPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, onboarding_status, subscription_status')
    .eq('user_id', user.id)
    .maybeSingle()

  if (canEnterApp(profile)) {
    redirect('/dashboard')
  }

  const message = statusMessage(profile)

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
        </div>

        <div className="space-y-3">
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
