// LINE Messaging API でのメッセージ送信。
//
// 必要な環境変数（設定手順は docs/line-notification-setup.md）
//   LINE_CHANNEL_ACCESS_TOKEN  LINE公式アカウントのチャネルアクセストークン
//   LINE_NOTIFY_TO             送信先のLINEユーザーID（Uから始まる文字列）
//
// どちらか欠けているときは送信せず、理由を返す。
// トークンは絶対にクライアント側へ出さない（NEXT_PUBLIC_ を付けない）。

const PUSH_ENDPOINT = 'https://api.line.me/v2/bot/message/push'

/** LINEの1メッセージあたりの上限。超える分は切る */
const MAX_TEXT_LENGTH = 4900

export type LineSendResult =
  | { sent: true }
  | { sent: false; reason: 'not_configured' | 'empty' | 'failed'; detail?: string }

export function isLineConfigured(): boolean {
  return Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_NOTIFY_TO)
}

export async function sendLineMessage(text: string): Promise<LineSendResult> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const to = process.env.LINE_NOTIFY_TO

  if (!token || !to) return { sent: false, reason: 'not_configured' }
  if (!text.trim()) return { sent: false, reason: 'empty' }

  const body = text.length > MAX_TEXT_LENGTH
    ? `${text.slice(0, MAX_TEXT_LENGTH)}\n…(以下省略)`
    : text

  const response = await fetch(PUSH_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to,
      messages: [{ type: 'text', text: body }],
    }),
  })

  if (!response.ok) {
    // LINEの応答にトークンは含まれないが、念のため本文はログにだけ残す
    const detail = await response.text().catch(() => '')
    console.error('[line] push failed', response.status, detail)
    return { sent: false, reason: 'failed', detail: `status ${response.status}` }
  }

  return { sent: true }
}
