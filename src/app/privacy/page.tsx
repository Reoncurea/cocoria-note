const sections = [
  {
    title: '1. 取得する情報',
    body: [
      'cocorianoteでは、サービス提供に必要な範囲で、利用者のメールアドレス、顧客情報、連絡先、住所、訪問記録、支援内容、請求・入金管理情報、写真、メモ等を保存します。',
      '入力する情報には、産後ケア支援に関する機微な内容が含まれる場合があります。不要な情報は入力しない、または必要最小限の記録にしてください。',
    ],
  },
  {
    title: '2. 利用目的',
    body: [
      '取得した情報は、顧客管理、訪問記録の作成、支援内容の振り返り、報告書作成、請求・入金管理、サービス改善、問い合わせ対応のために利用します。',
      '取得した情報を、本人の同意なく広告配信や目的外の営業活動に利用することはありません。',
    ],
  },
  {
    title: '3. 写真の取り扱い',
    body: [
      '訪問記録に写真を添付する場合、利用者は事前に必要な同意を得たうえでアップロードしてください。',
      '写真には、人物、室内、位置情報、生活状況などの個人情報が含まれる可能性があります。不要な写真や第三者が写る写真の保存は避けてください。',
      'アップロードできる写真形式はJPEG、PNG、WebPに限定し、保存先は非公開ストレージとして管理します。',
    ],
  },
  {
    title: '4. 第三者提供',
    body: [
      '法令に基づく場合を除き、保存された個人情報を本人の同意なく第三者へ提供することはありません。',
      'データ保存、認証、ホスティング等のために、Supabase、Vercel等の外部サービスを利用します。これらはサービス提供に必要な範囲で利用します。',
    ],
  },
  {
    title: '5. 安全管理',
    body: [
      '保存データは、認証、アクセス制御、利用者ごとのデータ分離、非公開ストレージ等により管理します。',
      'アカウント情報やパスワードは利用者自身で適切に管理してください。共有端末で利用する場合は、利用後に必ずログアウトしてください。',
    ],
  },
  {
    title: '6. 保存期間と削除',
    body: [
      '保存期間は、サービス提供、契約管理、法令対応、業務上必要な範囲で定めます。',
      '不要になった顧客情報、訪問記録、写真等は、管理者または利用者の操作により削除できます。削除依頼がある場合は、管理者へ連絡してください。',
    ],
  },
  {
    title: '7. 問い合わせ',
    body: [
      '個人情報の確認、修正、削除、利用停止、その他プライバシーに関する問い合わせは、サービス管理者までご連絡ください。',
    ],
  },
]

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-6 py-12 max-w-2xl mx-auto" style={{ color: 'var(--color-text)' }}>
      <h1 className="text-2xl font-bold mb-3">プライバシーポリシー</h1>
      <p className="text-sm leading-relaxed mb-8" style={{ color: 'var(--color-text-muted)' }}>
        cocorianoteは、産後ケア支援に関する顧客情報や訪問記録を扱うサービスです。
        個人情報の重要性を認識し、必要な範囲で適切に取り扱います。
      </p>

      {sections.map((section) => (
        <section key={section.title} className="mb-8">
          <h2 className="text-lg font-bold mb-3">{section.title}</h2>
          <div className="space-y-3">
            {section.body.map((paragraph) => (
              <p key={paragraph} className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                {paragraph}
              </p>
            ))}
          </div>
        </section>
      ))}

      <p className="text-xs mt-12" style={{ color: 'var(--color-text-muted)' }}>
        制定日：2026年5月29日
      </p>

      <div className="mt-8">
        <a href="/login" className="text-sm underline" style={{ color: 'var(--color-primary-dark)' }}>
          ログイン画面に戻る
        </a>
      </div>
    </main>
  )
}
