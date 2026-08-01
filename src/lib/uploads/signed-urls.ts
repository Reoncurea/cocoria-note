// 署名付きURLをまとめて発行する。
// 1枚ずつ createSignedUrl を呼ぶと写真の枚数だけ往復が増えるため、必ずこちらを使う。

type StorageClient = {
  storage: {
    from: (bucket: string) => {
      createSignedUrls: (
        paths: string[],
        expiresIn: number,
      ) => Promise<{ data: { path: string | null; signedUrl: string }[] | null; error: unknown }>
    }
  }
}

const ONE_HOUR = 60 * 60

export async function signedUrlMap(
  supabase: unknown,
  bucket: string,
  paths: string[],
  expiresIn: number = ONE_HOUR,
): Promise<Record<string, string>> {
  if (paths.length === 0) return {}

  const client = supabase as StorageClient
  const { data } = await client.storage.from(bucket).createSignedUrls(paths, expiresIn)

  const map: Record<string, string> = {}
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map[item.path] = item.signedUrl
  }
  return map
}
