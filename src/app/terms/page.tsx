const sections = [
  {
    title: '1. 本サービスについて',
    body: [
      'cocorianoteは、産後ケア支援に関する顧客情報、訪問記録、支援内容、請求・入金状況などを管理するための業務支援サービスです。',
      '本サービスは医療行為、診断、治療、法律・税務上の助言を提供するものではありません。必要に応じて専門家へ確認してください。',
    ],
  },
  {
    title: '2. 利用資格とアカウント管理',
    body: [
      '本サービスは招待された利用者のみが利用できます。アカウント、パスワード、ログイン情報は利用者自身の責任で管理してください。',
      '第三者へのアカウント共有、貸与、譲渡は禁止します。共有端末で利用する場合は、利用後に必ずログアウトしてください。',
    ],
  },
  {
    title: '3. 入力情報の管理責任',
    body: [
      '利用者は、入力する顧客情報、訪問記録、写真、メモ等について、必要な同意を得たうえで、正確かつ必要最小限の範囲で登録してください。',
      '不要な個人情報、第三者の情報、過度に詳細な生活情報、同意のない写真等を登録しないでください。',
    ],
  },
  {
    title: '4. 写真・ファイルの取り扱い',
    body: [
      '写真をアップロードする場合、人物、住居、位置情報、生活状況などが写り込む可能性を考慮し、事前に必要な同意を得てください。',
      '不適切な写真、権利侵害のある画像、サービス提供に不要な画像のアップロードは禁止します。',
    ],
  },
  {
    title: '5. 禁止事項',
    body: [
      '不正アクセス、他者アカウントの利用、虚偽情報の登録、過度な負荷をかける行為、法令または公序良俗に反する行為を禁止します。',
      '本サービスの運営、セキュリティ、他の利用者の業務を妨げる行為も禁止します。',
    ],
  },
  {
    title: '6. データの保存・削除',
    body: [
      '利用者は、業務上不要になったデータを適切に削除してください。顧客本人から削除や修正の依頼があった場合は、必要に応じて対応してください。',
      'サービス管理上、障害対応、セキュリティ対応、法令対応等のために必要な範囲でデータを確認・保全する場合があります。',
    ],
  },
  {
    title: '7. 料金・サブスクリプション',
    body: [
      '現在、本サービスは招待制の準備・試用段階です。将来的に有料プランやサブスクリプションを導入する場合は、料金、支払方法、解約条件を事前に案内します。',
      '有料化後は、支払い状況に応じて利用範囲を制限する場合があります。',
    ],
  },
  {
    title: '8. 免責',
    body: [
      '本サービスの利用により作成された記録、報告書、判断材料の最終確認と利用責任は利用者にあります。',
      'サービスの不具合、通信環境、外部サービスの障害等により一時的に利用できない場合があります。重要な情報は必要に応じて別途バックアップしてください。',
    ],
  },
  {
    title: '9. 規約の変更',
    body: [
      '本規約は、サービス内容、運用方法、法令等の変更に応じて改定することがあります。重要な変更がある場合は、適切な方法で案内します。',
    ],
  },
]

export default function TermsPage() {
  return (
    <main className="min-h-screen px-6 py-12 max-w-2xl mx-auto" style={{ color: 'var(--color-text)' }}>
      <h1 className="text-2xl font-bold mb-3">利用規約</h1>
      <p className="text-sm leading-relaxed mb-8" style={{ color: 'var(--color-text-muted)' }}>
        この利用規約は、cocorianoteを利用する際の基本的な条件を定めるものです。
        本サービスを利用することで、本規約に同意したものとみなします。
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

      <div className="mt-8 flex gap-4">
        <a href="/login" className="text-sm underline" style={{ color: 'var(--color-primary-dark)' }}>
          ログイン画面に戻る
        </a>
        <a href="/privacy" className="text-sm underline" style={{ color: 'var(--color-primary-dark)' }}>
          プライバシーポリシーを見る
        </a>
      </div>
    </main>
  )
}
