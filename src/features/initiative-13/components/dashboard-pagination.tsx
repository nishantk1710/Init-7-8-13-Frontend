import { Button } from "@/components/ui/button"

export function DashboardPagination({
  page,
  pageCount,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
}: {
  page: number
  pageCount: number
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
}) {
  if (pageCount <= 1) return null
  return (
    <div className="flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
      <span>
        Page {page + 1} of {pageCount}
      </span>
      <Button size="xs" variant="outline" disabled={!hasPrevious} onClick={onPrevious}>
        Previous
      </Button>
      <Button size="xs" variant="outline" disabled={!hasNext} onClick={onNext}>
        Next
      </Button>
    </div>
  )
}
