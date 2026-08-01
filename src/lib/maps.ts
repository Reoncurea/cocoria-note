// Googleマップを開くURLを組み立てる。
// 住所は必ずエンコードして渡す（個人情報なので、外部サービスへ渡すのは
// ユーザーがボタンを押したときだけにする）。

const SEARCH_BASE = 'https://www.google.com/maps/search/?api=1'
const DIRECTIONS_BASE = 'https://www.google.com/maps/dir/?api=1'

/** 住所を地図で開く */
export function mapSearchUrl(address: string | null | undefined): string | null {
  const query = address?.trim()
  if (!query) return null
  return `${SEARCH_BASE}&query=${encodeURIComponent(query)}`
}

/**
 * 現在地から住所までの経路を開く。
 * origin を省くと、Googleマップ側で現在地が使われる。
 */
export function mapDirectionsUrl(
  address: string | null | undefined,
  options?: { origin?: string | null; mode?: 'driving' | 'transit' | 'walking' | 'bicycling' },
): string | null {
  const destination = address?.trim()
  if (!destination) return null

  const params = new URLSearchParams({ destination })
  const origin = options?.origin?.trim()
  if (origin) params.set('origin', origin)
  if (options?.mode) params.set('travelmode', options.mode)

  return `${DIRECTIONS_BASE}&${params.toString()}`
}
