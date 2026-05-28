'use client'
interface Props { centered?: boolean }
export function LoadingSpinner({ centered = true }: Props) {
  const spinner = (
    <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
      style={{ borderColor: 'var(--color-primary)' }} />
  )
  if (!centered) return spinner
  return <div className="flex justify-center py-16">{spinner}</div>
}
