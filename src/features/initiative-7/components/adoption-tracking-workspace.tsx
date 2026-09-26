// Adoption Tracking (FR-9) -- was implemented end-to-end on the backend
// (app/initiatives/i7/recommendations/adoption.py, exposed via
// app/api/i7/adoption.py) but never surfaced in the UI: the frontend's own
// mapStatus() collapsed ADOPTED/PARTIALLY_ADOPTED/NOT_ADOPTED into a single
// "Implemented" label before any component could see the distinction. This
// page shows the real, unreduced reconciliation result per recommendation.
//
// UNKNOWN is the honest, expected result on the current SAP extract: the
// staged raw_cdpos table has zero MATERIAL/MARC change-document rows (see
// app/initiatives/i7/recommendations/sap_change_documents.py's module
// docstring), so there is no SAP evidence to reconcile against for any
// material-plant today. UNKNOWN is never displayed as NOT_ADOPTED -- absence
// of evidence is not evidence of non-adoption.

"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, RefreshCw, Search } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCount } from "@/lib/utils"
import { useLiveAdoption } from "@/features/initiative-7/hooks/use-live-adoption"
import type { AdoptionDisplayStatus } from "@/features/initiative-7/services/i7-api"

const ALL = "all"
const PAGE_SIZE = 20

const STATUS_OPTIONS: AdoptionDisplayStatus[] = [
  "Adopted",
  "Partially adopted",
  "Not adopted",
  "Unknown",
]

const STATUS_TONE: Record<AdoptionDisplayStatus, "default" | "success" | "warning" | "danger"> = {
  Adopted: "success",
  "Partially adopted": "warning",
  "Not adopted": "danger",
  Unknown: "default",
}

export function AdoptionTrackingWorkspace() {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>(ALL)
  const [query, setQuery] = useState("")

  const { items, total, loading, error, refetch } = useLiveAdoption({ page, pageSize: PAGE_SIZE })

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase()
    return (items ?? []).filter((row) => {
      if (statusFilter !== ALL && row.status !== statusFilter) return false
      if (search) {
        const haystack = `${row.materialId} ${row.plantId}`.toLowerCase()
        if (!haystack.includes(search)) return false
      }
      return true
    })
  }, [items, statusFilter, query])

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        icon={<AlertTriangle className="size-4" />}
        title="Could not load adoption tracking from the backend"
        description={error.message}
        actions={
          <Button size="sm" variant="outline" onClick={refetch}>
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
        }
      />
    )
  }

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
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? ALL)}>
          <SelectTrigger className="h-8 w-full sm:w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
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
            {visible.map((row) => (
              <TableRow key={row.recommendationId}>
                <TableCell className="font-medium text-foreground">{row.materialId}</TableCell>
                <TableCell className="text-muted-foreground">{row.plantId}</TableCell>
                <TableCell className="text-accent-foreground">
                  {row.isConversionAdoption ? "OAR conversion (ND/PD → VB)" : "Planning-field parameters"}
                </TableCell>
                <TableCell>
                  <StatusBadge tone={STATUS_TONE[row.status]}>{row.status}</StatusBadge>
                </TableCell>
                <TableCell className="text-muted-foreground">{row.detail}</TableCell>
              </TableRow>
            ))}
            {visible.length === 0 && (
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
          Showing {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(total, page * PAGE_SIZE)} of{" "}
          {formatCount(total)}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page * PAGE_SIZE >= total}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
