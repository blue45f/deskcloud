import { Spinner } from '@/components/ui/feedback'

export default function Loading() {
  return (
    <div className="grid min-h-[50vh] place-items-center" role="status" aria-label="불러오는 중">
      <Spinner className="size-6" />
    </div>
  )
}
