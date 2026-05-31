import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminUsersClient from './AdminUsersClient'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
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

  const isAdmin =
    profile?.role === 'admin' &&
    profile.onboarding_status === 'completed' &&
    (profile.subscription_status === 'trialing' || profile.subscription_status === 'active')

  if (!isAdmin) {
    redirect('/settings')
  }

  return (
    <div className="px-4 pt-6 space-y-5">
      <div>
        <h1 className="page-title">管理者画面</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
          利用者の権限、利用開始、利用状態を管理します。
        </p>
      </div>

      <div className="card space-y-2">
        <p className="section-label">運用メモ</p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          新しい業務用アカウントはこの画面から招待します。パスワード設定が完了すると、自動で「利用開始済み」になります。
        </p>
      </div>

      <AdminUsersClient />

      <div className="bottom-nav-spacer" />
    </div>
  )
}
