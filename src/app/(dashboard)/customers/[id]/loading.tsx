import { SkeletonList } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="px-4 pt-5">
      <SkeletonList count={4} lines={4} />
    </div>
  )
}
