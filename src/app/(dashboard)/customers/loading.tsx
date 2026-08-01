import { SkeletonLine, SkeletonList } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="px-4 pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">顧客一覧</h1>
      </div>
      <SkeletonLine height="2.75rem" />
      <SkeletonList count={5} lines={2} />
    </div>
  )
}
