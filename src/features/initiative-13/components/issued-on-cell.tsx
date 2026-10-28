import { StatusBadge } from "@/components/shared/status-badge"
import { TableCell } from "@/components/ui/table"
import { formatApiDate } from "@/lib/api/format"
import type { IssueMatch } from "@/lib/api/i13"
import { ISSUE_MATCH_EXPLANATIONS, NEXT_PLANNED_ISSUE_TITLE } from "@/features/initiative-13/utils/issue-match"
import { formatCount } from "@/lib/utils"

/**
 * The "Issued on" cell: the latest goods-issue date counted against the line,
 * with the first underneath when there were several -- the issue side of
 * "Delivered on". A line delivered before the issue history says so rather
 * than showing a blank that would read as "never issued".
 */
export function IssuedOnCell({
  firstDate,
  lastDate,
  received,
  issueMatch,
}: {
  firstDate: string | null
  lastDate: string | null
  received: boolean
  issueMatch: IssueMatch | null
}) {
  if (issueMatch === "BEFORE_ISSUE_HISTORY") {
    return (
      <TableCell title={ISSUE_MATCH_EXPLANATIONS.BEFORE_ISSUE_HISTORY}>
        <StatusBadge>Before issue history</StatusBadge>
      </TableCell>
    )
  }
  if (!lastDate) {
    return (
      <TableCell>
        <span className="text-xs text-muted-foreground">{received ? "Not issued yet" : "Nothing received"}</span>
      </TableCell>
    )
  }
  const several = firstDate && firstDate !== lastDate
  return (
    <TableCell title={several ? `First issued ${formatApiDate(firstDate)}, latest ${formatApiDate(lastDate)}` : undefined}>
      <div className="flex flex-col items-start gap-0.5">
        <span className="whitespace-nowrap text-foreground">{formatApiDate(lastDate)}</span>
        {several && (
          <span className="whitespace-nowrap text-xs text-muted-foreground">First {formatApiDate(firstDate)}</span>
        )}
      </div>
    </TableCell>
  )
}

/**
 * The "Next planned issue" cell: the requirement date (RESB-BDTER) of the
 * earliest open reservation expected to draw on this line's stock, and how
 * much of it. The issue side of "Expected delivery".
 */
export function NextPlannedIssueCell({
  date,
  quantity,
  inStock,
}: {
  date: string | null
  quantity: number | null
  inStock: boolean
}) {
  if (!date) {
    return (
      <TableCell>
        <span className="text-xs text-muted-foreground">{inStock ? "No open reservation" : "Nothing in stock"}</span>
      </TableCell>
    )
  }
  return (
    <TableCell title={NEXT_PLANNED_ISSUE_TITLE}>
      <div className="flex flex-col items-start gap-0.5">
        <span className="whitespace-nowrap text-foreground">{formatApiDate(date)}</span>
        {quantity !== null && (
          <span className="whitespace-nowrap text-xs text-muted-foreground">{formatCount(quantity)} planned</span>
        )}
      </div>
    </TableCell>
  )
}
