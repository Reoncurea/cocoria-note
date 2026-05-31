import { CocoriaLogo } from '@/components/CocoriaLogo'
import { AuthCallbackClient } from './AuthCallbackClient'

export const dynamic = 'force-dynamic'

export default function AuthCallbackPage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-6 py-10"
      style={{ background: 'linear-gradient(160deg, #fdf2f8 0%, #fff5f9 100%)' }}
    >
      <section className="card w-full max-w-sm text-center space-y-4">
        <div className="flex justify-center">
          <CocoriaLogo size={64} />
        </div>
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>
            cocoria note
          </p>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
            招待を確認しています
          </h1>
          <p className="text-sm leading-relaxed mt-3" style={{ color: 'var(--color-text-muted)' }}>
            初回設定画面へ進む準備をしています。
          </p>
        </div>
        <div className="flex justify-center py-2">
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--color-primary)' }}
          />
        </div>
        <AuthCallbackClient />
      </section>
    </main>
  )
}
