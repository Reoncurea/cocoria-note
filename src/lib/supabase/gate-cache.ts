// ログイン判定と利用状態チェックの短時間キャッシュ。
//
// 目的:
//   middleware は全ページ・全APIで動くため、毎回 auth.getUser()（Supabaseへの往復）と
//   user_profiles の照会（もう1往復）が走っていた。ページ移動のたびに待ち時間が乗るので、
//   同じログインセッションについては数十秒だけ結果を使い回す。
//
// 安全性:
//   - 判定結果は Cookie に置くが、必ず HMAC 署名を付けて改ざんを検出する
//   - Supabase の認証Cookie（sb-*）の中身をハッシュ化して署名に含める。
//     ログアウト・トークン更新でCookieが変われば、キャッシュは自動的に外れる
//   - 署名鍵が無い環境ではキャッシュを使わない（毎回ちゃんと問い合わせる）
//   - そもそもデータ本体は Supabase の RLS で守られている。ここは画面遷移の可否だけ

const COOKIE_NAME = 'cocoria-gate'
const TTL_MS = 60_000

function getSecret(): string | null {
  return process.env.APP_SESSION_CACHE_SECRET
    ?? process.env.SUPABASE_SERVICE_ROLE_KEY
    ?? null
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return toHex(digest)
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return toHex(signature)
}

/** 長さ非依存の比較。タイミングから中身を推測されないようにする */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/** Supabaseの認証Cookieから、このログインセッションを表す指紋を作る */
export async function sessionFingerprint(
  cookies: { name: string; value: string }[],
): Promise<string | null> {
  const authCookies = cookies
    .filter(cookie => cookie.name.startsWith('sb-'))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(cookie => `${cookie.name}=${cookie.value}`)
    .join('&')

  if (!authCookies) return null
  return (await sha256Hex(authCookies)).slice(0, 32)
}

export type GateCacheValue = {
  userId: string
  allowed: boolean
}

/**
 * キャッシュされた判定結果を読む。
 * 署名が合わない・期限切れ・別セッションのものは null を返す。
 */
export async function readGateCache(
  rawCookie: string | undefined,
  fingerprint: string | null,
): Promise<GateCacheValue | null> {
  const secret = getSecret()
  if (!secret || !rawCookie || !fingerprint) return null

  const [payload, signature] = rawCookie.split('.')
  if (!payload || !signature) return null

  const expected = await sign(payload, secret)
  if (!safeEqual(signature, expected)) return null

  const [expiresAt, cachedFingerprint, userId, allowed] = payload.split(':')
  if (!expiresAt || !cachedFingerprint || !userId) return null
  if (!safeEqual(cachedFingerprint, fingerprint)) return null
  if (Number(expiresAt) < Date.now()) return null

  return { userId, allowed: allowed === '1' }
}

/** 判定結果をCookieに書ける形にする。鍵が無い環境では null（キャッシュしない） */
export async function buildGateCache(
  fingerprint: string | null,
  value: GateCacheValue,
): Promise<{ name: string; value: string; maxAge: number } | null> {
  const secret = getSecret()
  if (!secret || !fingerprint) return null

  const payload = [Date.now() + TTL_MS, fingerprint, value.userId, value.allowed ? '1' : '0'].join(':')
  const signature = await sign(payload, secret)

  return {
    name: COOKIE_NAME,
    value: `${payload}.${signature}`,
    maxAge: Math.floor(TTL_MS / 1000),
  }
}

export const GATE_COOKIE_NAME = COOKIE_NAME
