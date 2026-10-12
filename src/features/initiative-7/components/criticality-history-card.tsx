"use client"

import { useState } from "react"

import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { isPlaceholderActor } from "@/lib/api/actor"
import { formatApiDateTime } from "@/lib/api/format"
import { cn, formatCount } from "@/lib/utils"
import type { CriticalityPlant, CriticalityUpload } from "@/features/initiative-7/types/criticality-reports"
import {
  JULY_DELIVERY_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  filterUploads,
  formatMonth,
  showingLabel,
} from "@/features/initiative-7/utils/criticality-reports"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"

/** Every upload, per plant. The plant toggle filters what is already loaded. */
export function CriticalityHistoryCard({
  plants,
  uploads,
  loading,
  error,
}: {
  plants: CriticalityPlant[] | null
  uploads: CriticalityUpload[] | null
  loading: boolean
  error: string | null
}) {
  const [plant, setPlant] = useState<string | null>(null)

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-medium text-foreground">History</h2>
          <p className="text-xs text-muted-foreground">
            Every upload, per plant. The newest upload for a month becomes current.
          </p>
        </div>
        <nav className="flex flex-wrap items-center gap-2 text-xs" aria-label="Plant">
          <PlantChip active={plant === null} onClick={() => setPlant(null)} label="All plants" />
          {(plants ?? []).map((p) => (
            <PlantChip
              key={p.code}
              active={plant === p.code}
              onClick={() => setPlant(p.code)}
              label={sapPlantLabel(p.code)}
            />
          ))}
        </nav>
      </div>
      <HistoryBody uploads={uploads} plant={plant} loading={loading} error={error} />
    </section>
  )
}

/** The table, its loading and empty states, and the count underneath. Split
 * out so it renders without the toggle's state. */
export function HistoryBody({
  uploads,
  plant,
  loading,
  error,
}: {
  uploads: CriticalityUpload[] | null
  plant: string | null
  loading: boolean
  error: string | null
}) {
  if (error && !uploads) {
    return (
      <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
        The upload history could not be loaded: {error}
      </p>
    )
  }
  if (!uploads) {
    return loading ? <Skeleton className="h-40 w-full" /> : null
  }

  const shown = filterUploads(uploads, plant)
  if (shown.length === 0) {
    return (
      <EmptyState
        title="No reports yet"
        description={
          plant
            ? `Nothing has been uploaded for ${sapPlantLabel(plant)} yet.`
            : "Upload a plant's criticality report above to start the history."
        }
      />
    )
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead>Plant</TableHead>
              <TableHead>File</TableHead>
              <TableHead>Uploaded by</TableHead>
              <TableHead>Date / time</TableHead>
              <TableHead className="text-right">Rows</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((u) => (
              <TableRow key={u.id} className={cn(u.status === "replaced" && "text-muted-foreground")}>
                <TableCell className="font-medium text-foreground">{formatMonth(u.reportMonth)}</TableCell>
                <TableCell>{sapPlantLabel(u.plant)}</TableCell>
                <TableCell className="max-w-64 truncate" title={u.fileName}>
                  {u.source === "july_delivery" ? (
                    <span className="text-muted-foreground">{JULY_DELIVERY_LABEL}</span>
                  ) : (
                    u.fileName
                  )}
                </TableCell>
                <TableCell>
                  <Uploader actor={u.uploadedBy} />
                </TableCell>
                <TableCell>{formatApiDateTime(u.uploadedAt)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(u.rowCount)}</TableCell>
                <TableCell>
                  <StatusBadge tone={STATUS_TONE[u.status]}>{STATUS_LABEL[u.status]}</StatusBadge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">{showingLabel(shown.length)}</p>
    </>
  )
}

function Uploader({ actor }: { actor: string | null }) {
  if (!actor) return <span className="text-muted-foreground">—</span>
  if (!isPlaceholderActor(actor)) return <>{actor}</>
  return (
    <span className="text-muted-foreground">
      <span className="italic">{actor}</span> (no sign-in — provisional)
    </span>
  )
}

function PlantChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-2.5 py-0.5 font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-muted"
      )}
    >
      {label}
    </button>
  )
}
