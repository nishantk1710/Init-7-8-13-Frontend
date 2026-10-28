import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { pageSummary, pageWindow } from "@/lib/pagination"
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
 *
 * `loading` is for a client-fetched table that keeps the previous page's rows
 * (dimmed) while the next page loads: the line says which page is coming and
 * both buttons switch off, so repeated clicks cannot queue a pile of requests.
 */
export function TablePagination({
  page,
  pageSize,
  total,
  count,
  noun,
  hrefFor,
  onPageChange,
  loading = false,
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
  /** The next page is being fetched while this one's rows are still shown. */
  loading?: boolean
  className?: string
}) {
  if (count === 0 && page === 1) return null

  const w = pageWindow({ page, pageSize, total, count })
  const showButtons = w.hasPrevious || w.hasNext

  const range = pageSummary({ page, pageSize, total, count, noun, loading })
  const pageLabel =
    w.pageCount === null ? `Page ${formatCount(page)}` : `Page ${formatCount(page)} of ${formatCount(w.pageCount)}`

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2", className)}>
      <p className="text-[11px] text-muted-foreground" aria-live={loading ? "polite" : undefined}>
        {range}
        {showButtons && !loading && <> · {pageLabel}</>}
      </p>
      {showButtons && (
        <div className="flex gap-2">
          <PageButton target={page - 1} enabled={!loading && w.hasPrevious} hrefFor={hrefFor} onPageChange={onPageChange}>
            Previous
          </PageButton>
          <PageButton target={page + 1} enabled={!loading && w.hasNext} hrefFor={hrefFor} onPageChange={onPageChange}>
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
