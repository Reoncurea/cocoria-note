export default function PrivacyPage() {
  return (
    <div className="min-h-screen px-6 py-12 max-w-2xl mx-auto" style={{ color: 'var(--color-text)' }}>
      <h1 className="text-2xl font-bold mb-8">プライバシーポリシー</h1>

      <section className="mb-8">
        <h2 className="text-lg font-bold mb-3">1. 収集する情報</h2>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          本サービスでは、ご利用にあたり以下の情報を収集します。
        </p>
        <ul className="mt-2 text-sm leading-relaxed list-disc list-inside space-y-1" style={{ color: 'var(--color-text-muted)' }}>
          <li>メールアドレス（アカウント登録時）</li>
          <li>お客様情報（氏名・連絡先・施術記録など、ご自身が入力した顧客データ）</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-bold mb-3">2. 利用目的</h2>
        <ul className="text-sm leading-relaxed list-disc list-inside space-y-1" style={{ color: 'var(--color-text-muted)' }}>
          <li>本サービスの提供・運営</li>
          <li>アカウントの認証・管理</li>
          <li>お客様データの保存・表示</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-bold mb-3">3. 第三者への提供</h2>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          法令に基づく場合を除き、収集した情報を第三者に提供することはありません。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-bold mb-3">4. データの管理</h2>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          収集したデータはSupabase（セキュアなクラウドデータベース）に保存し、適切なアクセス制御のもとで管理します。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-bold mb-3">5. お問い合わせ</h2>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          プライバシーに関するご質問は、サービス管理者までお問い合わせください。
        </p>
      </section>

      <p className="text-xs mt-12" style={{ color: 'var(--color-text-muted)' }}>
        制定日：2026年4月20日
      </p>

      <div className="mt-8">
        <a href="/login" className="text-sm underline" style={{ color: 'var(--color-primary-dark)' }}>
          ← ログイン画面に戻る
        </a>
      </div>
    </div>
  )
}
