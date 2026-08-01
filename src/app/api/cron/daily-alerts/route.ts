import { NextRequest, NextResponse } from 'next/server'
import { buildDailyAlert } from '@/lib/notify/daily-alerts'
import { isLineConfigured, sendLineMessage } from '@/lib/notify/line'

// 毎朝のアラートをLINEへ送る。
// Vercel Cron から呼ばれる想定（vercel.json の crons を参照）。
// 認証はログインセッションではなく CRON_SECRET で行う。

export const dynamic = 'force-dynamic'
export const maxDuration = 30

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  // 秘密が設定されていない環境では、外から叩かれないよう常に拒否する
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isLineConfigured()) {
    return NextResponse.json({ error: 'LINE notification is not configured' }, { status: 503 })
  }

  try {
    const alert = await buildDailyAlert()

    if (!alert.text) {
      return NextResponse.json({ sent: false, reason: 'nothing_to_report', counts: alert.counts })
    }

    const result = await sendLineMessage(alert.text)
    if (!result.sent) {
      return NextResponse.json({ sent: false, reason: result.reason }, { status: 502 })
    }

    return NextResponse.json({ sent: true, counts: alert.counts })
  } catch (error) {
    // 内部の詳細は返さず、ログにだけ残す
    console.error('[cron/daily-alerts]', error)
    return NextResponse.json({ error: 'Alert job failed' }, { status: 500 })
  }
}
