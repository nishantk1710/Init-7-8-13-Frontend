import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { pageWindow } from "@/lib/pagination"
import { cn, formatCount } from "@/lib/utils"

/**
 * The one pager under every paged table:
 *
 *   Showing 26–50 of 42,649 exceptions · Page 2 of 1,706   [Previous] [Next]
 *
 * Two ways to drive it, and a screen picks one:
 *
 *   - `hrefFor` — the page lives in the URL (`?page=`) and the server fetches
 *     it. Previous/Next are links, so back/forward and shared links work. Usable
 *     from a server component: no hooks, no handlers.
 *   - `onPageChange` — the rows are already in the browser and are sliced
 *     there (see `usePaginatedRows`). Previous/Next are buttons.
 *
 * The buttons are hidden when everything fits on one page; the count line is
 * not, because "12 of 12" is still worth saying.
 */
export function TablePagination({
  page,
  pageSize,
  total,
  count,
  noun,
  hrefFor,
  onPageChange,
  className,
}: {
  /** 1-based. */
  page: number
  pageSize: number
  /** Rows across every page. `null` when the backend did not say. */
  total: number | null
  /** Rows on this page. */
  count: number
  /** Plural, e.g. "exceptions". Omitted, the line ends at the number. */
  noun?: string
  hrefFor?: (page: number) => string
  onPageChange?: (page: number) => void
  className?: string
}) {
  if (count === 0 && page === 1) return null

  const w = pageWindow({ page, pageSize, total, count })
  const showButtons = w.hasPrevious || w.hasNext

  const range =
    count === 0
      ? "No rows on this page"
      : `Showing ${formatCount(w.first)}–${formatCount(w.last)}` +
        (total === null ? "" : ` of ${formatCount(total)}`) +
        (noun ? ` ${noun}` : "")
  const pageLabel =
    w.pageCount === null ? `Page ${formatCount(page)}` : `Page ${formatCount(page)} of ${formatCount(w.pageCount)}`

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2", className)}>
      <p className="text-[11px] text-muted-foreground">
        {range}
        {showButtons && <> · {pageLabel}</>}
      </p>
      {showButtons && (
        <div className="flex gap-2">
          <PageButton target={page - 1} enabled={w.hasPrevious} hrefFor={hrefFor} onPageChange={onPageChange}>
            Previous
          </PageButton>
          <PageButton target={page + 1} enabled={w.hasNext} hrefFor={hrefFor} onPageChange={onPageChange}>
            Next
          </PageButton>
        </div>
      )}
    </div>
  )
}

function PageButton({
  target,
  enabled,
  hrefFor,
  onPageChange,
  children,
}: {
  target: number
  enabled: boolean
  hrefFor?: (page: number) => string
  onPageChange?: (page: number) => void
  children: React.ReactNode
}) {
  const className = buttonVariants({ variant: "outline", size: "sm" })
  if (!enabled) {
    return (
      <span data-slot="button" aria-disabled="true" className={cn(className, "pointer-events-none opacity-50")}>
        {children}
      </span>
    )
  }
  if (hrefFor) {
    return (
      <Link data-slot="button" href={hrefFor(target)} scroll={false} className={className}>
        {children}
      </Link>
    )
  }
  return (
    <button data-slot="button" type="button" className={className} onClick={() => onPageChange?.(target)}>
      {children}
    </button>
  )
}
