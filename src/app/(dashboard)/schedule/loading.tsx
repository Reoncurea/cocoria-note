import { SkeletonLine, SkeletonList } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="px-4 pt-6 space-y-4">
      <h1 className="page-title">訪問予定</h1>
      <SkeletonLine height="2.25rem" />
      <SkeletonList count={5} lines={1} />
    </div>
  )
}
