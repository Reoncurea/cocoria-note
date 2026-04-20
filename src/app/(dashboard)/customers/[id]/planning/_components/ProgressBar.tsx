'use client'

interface Props {
  current: number
  total: number
  title: string
}

export default function ProgressBar({ current, total, title }: Props) {
  const pct = Math.round((current / total) * 100)

  return (
    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
          セクション {current} / {total}
        </span>
        <span className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>
          {pct}%
        </span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: 'var(--color-border)' }}>
        <div
          className="h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: 'var(--color-primary)' }}
        />
      </div>
      <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>{title}</p>
    </div>
  )
}
