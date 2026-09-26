"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"

import { StatusBadge } from "@demo/components/shared/status-badge"
import { Button } from "@demo/components/ui/button"
import { Input } from "@demo/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@demo/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@demo/components/ui/table"
import { formatCount } from "@demo/lib/utils"
import {
  ADOPTION_CHECK_ROWS,
  type AdoptionStatus,
} from "@demo/features/initiative-7/data/adoption-tracking"

const ALL = "all"
const PAGE_SIZE = 20

const STATUS_LABEL: Record<AdoptionStatus, string> = {
  ADOPTED: "Adopted",
  PARTIALLY_ADOPTED: "Partially adopted",
  NOT_ADOPTED: "Not adopted",
  UNKNOWN: "Unknown",
}

const STATUS_TONE: Record<AdoptionStatus, "success" | "warning" | "danger" | "default"> = {
  ADOPTED: "success",
  PARTIALLY_ADOPTED: "warning",
  NOT_ADOPTED: "danger",
  UNKNOWN: "default",
}

export function AdoptionTrackingWorkspace() {
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<string>(ALL)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ADOPTION_CHECK_ROWS.filter((row) => {
      if (status !== ALL && row.status !== status) return false
      if (q && !row.material.toLowerCase().includes(q)) return false
      return true
    })
  }, [query, status])

  const [page, setPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const rows = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE)
  const rangeStart = filtered.length === 0 ? 0 : currentPage * PAGE_SIZE + 1
  const rangeEnd = Math.min(filtered.length, currentPage * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Track a material..."
            className="h-8 pl-7 text-sm"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v ?? ALL)}>
          <SelectTrigger className="h-8 w-full sm:w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {(Object.keys(STATUS_LABEL) as AdoptionStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Material</TableHead>
              <TableHead>Plant</TableHead>
              <TableHead>Check type</TableHead>
              <TableHead>Adoption status</TableHead>
              <TableHead>Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={`${row.material}-${row.plant}-${i}`}>
                <TableCell className="font-medium text-foreground">{row.material}</TableCell>
                <TableCell className="text-muted-foreground">{row.plant}</TableCell>
                <TableCell className="text-accent-foreground">{row.checkType}</TableCell>
                <TableCell>
                  <StatusBadge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</StatusBadge>
                </TableCell>
                <TableCell className="text-muted-foreground">{row.detail}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  No adoption checks match this filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          Showing {rangeStart}–{rangeEnd} of {formatCount(filtered.length)}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {currentPage + 1} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={currentPage >= pageCount - 1}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
