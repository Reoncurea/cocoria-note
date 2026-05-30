import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CocoriaLogo } from '@/components/CocoriaLogo'
import { SetPasswordForm } from './SetPasswordForm'

export const dynamic = 'force-dynamic'

export default async function SetPasswordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6 py-10"
      style={{ background: 'linear-gradient(160deg, #fdf2f8 0%, #fff5f9 100%)' }}
    >
      <section className="card w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="flex justify-center mb-3">
            <CocoriaLogo size={64} />
          </div>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>
            cocoria note
          </p>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
            パスワード設定
          </h1>
          <p className="text-sm leading-relaxed mt-3" style={{ color: 'var(--color-text-muted)' }}>
            招待されたアカウントで使うパスワードを設定してください。
          </p>
        </div>

        <div className="rounded-xl p-3 text-xs" style={{ background: 'var(--color-surface)' }}>
          <p style={{ color: 'var(--color-text-muted)' }}>対象メール: {user.email}</p>
        </div>

        <SetPasswordForm />
      </section>
    </main>
  )
}
