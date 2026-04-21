'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { label: '基本情報', suffix: '' },
  { label: 'プランニング', suffix: '/planning' },
  { label: '対応記録', suffix: '/activities' },
  { label: '訪問履歴', suffix: '/visits' },
]

export default function CustomerTabNav({ customerId }: { customerId: string }) {
  const pathname = usePathname()
  const base = `/customers/${customerId}`
  const suffix = pathname.slice(base.length)

  // タブ一覧ページ以外（個別詳細・編集ページなど）は非表示
  const isTabPage = TABS.some(t => t.suffix === suffix)
  if (!isTabPage) return null

  return (
    <div className="flex overflow-x-auto" style={{ borderBottom: '1px solid var(--color-border)' }}>
      {TABS.map(tab => {
        const href = `${base}${tab.suffix}`
        const active = suffix === tab.suffix
        return (
          <Link
            key={tab.suffix}
            href={href}
            className="px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors"
            style={{
              borderColor: active ? 'var(--color-primary-dark)' : 'transparent',
              color: active ? 'var(--color-primary-dark)' : 'var(--color-text-muted)',
            }}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
