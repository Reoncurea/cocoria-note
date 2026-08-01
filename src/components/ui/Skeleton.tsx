// ページ移動中に出す仮表示。
// スピナーだけだと「何も無い画面」に見えるので、出来上がりに近い形を先に出す。

export function SkeletonLine({ width = '100%', height = '0.875rem' }: { width?: string; height?: string }) {
  return (
    <div
      className="rounded animate-pulse"
      style={{ width, height, background: 'var(--color-border)' }}
    />
  )
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card space-y-2.5">
      <SkeletonLine width="45%" height="1rem" />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} width={i === lines - 1 ? '65%' : '100%'} />
      ))}
    </div>
  )
}

export function SkeletonList({ count = 4, lines = 2 }: { count?: number; lines?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </div>
  )
}
