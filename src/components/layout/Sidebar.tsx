'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CocoriaLogo } from '@/components/CocoriaLogo'

const navItems = [
  {
    href: '/dashboard',
    label: 'ホーム',
    icon: (active: boolean) => (
      <svg width="20" height="20" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" strokeLinejoin="round" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: '/customers',
    label: '顧客一覧',
    icon: (active: boolean) => (
      <svg width="20" height="20" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    href: '/settings',
    label: '設定',
    icon: (active: boolean) => (
      <svg width="20" height="20" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-52 z-40 print:hidden"
      style={{ background: 'white', borderRight: '1px solid var(--color-border)' }}
    >
      {/* ロゴ */}
      <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <CocoriaLogo size={32} />
        <span className="font-bold text-base" style={{ color: 'var(--color-text)' }}>cocoria note</span>
      </div>

      {/* ナビ */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const active = pathname === item.href ||
            (item.href === '/customers' && pathname.startsWith('/customers') && pathname !== '/customers/new')
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
              style={{
                background: active ? 'var(--color-primary-light)' : 'transparent',
                color: active ? 'var(--color-primary-dark)' : 'var(--color-text-muted)',
              }}
            >
              {item.icon(active)}
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* 顧客登録ボタン */}
      <div className="p-3" style={{ borderTop: '1px solid var(--color-border)' }}>
        <Link href="/customers/new" className="btn-primary block text-center text-sm py-2.5 w-full">
          ＋ 顧客登録
        </Link>
      </div>
    </aside>
  )
}
