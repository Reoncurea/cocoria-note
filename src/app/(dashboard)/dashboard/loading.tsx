import { SkeletonCard, SkeletonLine } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="px-4 pt-6 space-y-5">
      <SkeletonLine width="70%" height="1.5rem" />
      <div className="grid grid-cols-3 gap-3">
        <SkeletonCard lines={1} />
        <SkeletonCard lines={1} />
        <SkeletonCard lines={1} />
      </div>
      <SkeletonCard lines={3} />
      <SkeletonCard lines={3} />
    </div>
  )
}
