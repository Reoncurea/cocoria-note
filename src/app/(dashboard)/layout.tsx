import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BottomNav from '@/components/layout/BottomNav'
import Sidebar from '@/components/layout/Sidebar'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      {/* PC: サイドバー */}
      <Sidebar />

      {/* メインコンテンツ */}
      <div className="md:ml-52">
        <main className="pb-20 md:pb-8">
          {children}
        </main>
      </div>

      {/* モバイル: ボトムナビ */}
      <BottomNav />
    </div>
  )
}
