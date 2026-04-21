import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import CustomerTabNav from '@/components/layout/CustomerTabNav'

export const dynamic = 'force-dynamic'

const STATUS_BADGE: Record<string, string> = {
  '活動中': 'badge-active',
  '契約済み': 'badge-contracted',
  '終了': 'badge-ended',
}

type Props = {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

export default async function CustomerLayout({ children, params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: customer } = await supabase
    .from('customers')
    .select('name_kanji, name_kana, status')
    .eq('id', id)
    .single()

  return (
    <div>
      {/* 顧客名ヘッダー（常に表示） */}
      <div
        className="sticky top-0 z-30 bg-white"
        style={{ borderBottom: '1px solid var(--color-border)', boxShadow: '0 1px 4px rgba(249,168,201,0.1)' }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href="/customers" className="p-1 -ml-1 flex-shrink-0">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
              style={{ color: 'var(--color-text-muted)' }}>
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base truncate" style={{ color: 'var(--color-text)' }}>
                {customer?.name_kanji ?? ''}
              </h1>
              {customer?.status && (
                <span className={`badge ${STATUS_BADGE[customer.status] ?? 'badge-active'} flex-shrink-0`}>
                  {customer.status}
                </span>
              )}
            </div>
            {customer?.name_kana && (
              <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                {customer.name_kana}
              </p>
            )}
          </div>
          <Link href={`/customers/${id}/edit`} className="btn-secondary text-xs px-3 py-1.5 flex-shrink-0">
            編集
          </Link>
        </div>

        {/* タブナビ（一覧ページのみ表示） */}
        <CustomerTabNav customerId={id} />
      </div>

      {children}
    </div>
  )
}
