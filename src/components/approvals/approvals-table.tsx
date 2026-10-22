"use client"

import { useEffect } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import { TablePagination } from "@/components/shared/table-pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { usePaginatedRows } from "@/hooks/use-paginated-rows"
import { formatWhen } from "@/lib/api/format"
import type { GlobalAction } from "@/lib/domain/contracts"
import { initiative7Manifest } from "@/features/initiative-7/manifest"
import { initiative8Manifest } from "@/features/initiative-8/manifest"
import { initiative13Manifest } from "@/features/initiative-13/manifest"

const MODULE_LABEL: Record<GlobalAction["initiative"], string> = {
  "initiative-7": initiative7Manifest.name,
  "initiative-8": initiative8Manifest.name,
  "initiative-13": initiative13Manifest.name,
}

const SEVERITY_TONE = {
  critical: "danger",
  warning: "warning",
  info: "default",
} as const

/** The §26 approvals table — Material / Decision Needed / Type — a
 * different presentation of the same shared action feed, not a fork.
 *
 * Paged in the browser, 25 at a time, over the (already capped) list the page
 * hands in. A client component for that reason only. */
export function ApprovalsTable({
  approvals,
  incomplete = false,
  onShownChange,
}: {
  approvals: GlobalAction[]
  /** Some module could not be loaded, so an empty list is not "all clear". */
  incomplete?: boolean
  /** Told how many rows are on screen (this page), and `null` once the table goes away. */
  onShownChange?: (shown: number | null) => void
}) {
  const { paged, page, pageSize, total, setPage } = usePaginatedRows(approvals)

  const shown = paged.length
  useEffect(() => {
    onShownChange?.(shown)
  }, [onShownChange, shown])
  useEffect(() => () => onShownChange?.(null), [onShownChange])

  if (approvals.length === 0) {
    return incomplete ? (
      <EmptyState
        title="Nothing to show"
        description="A module could not be loaded, so this is not a statement that nothing is waiting on your decision."
      />
    ) : (
      <EmptyState title="You're up to date — nothing is waiting on your decision." />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Decision needed</TableHead>
              <TableHead className="w-[160px]">Module</TableHead>
              <TableHead className="w-[100px]">Priority</TableHead>
              <TableHead className="w-[100px]">Raised</TableHead>
              <TableHead className="w-[84px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="text-foreground">{a.title}</TableCell>
                <TableCell className="text-muted-foreground">{MODULE_LABEL[a.initiative]}</TableCell>
                <TableCell>
                  <StatusBadge tone={SEVERITY_TONE[a.severity]}>{a.severity}</StatusBadge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatWhen(a.createdAt)}</TableCell>
                <TableCell>
                  <Link
                    href={a.href}
                    className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
                  >
                    Review
                    <ArrowRight className="size-3" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        count={paged.length}
        noun="decisions"
        onPageChange={setPage}
      />
    </div>
  )
}
