"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Download } from "lucide-react"

import { ClearFiltersButton } from "@demo/components/shared/clear-filters-button"
import { EmptyState } from "@demo/components/shared/empty-state"
import { FilterBar } from "@demo/components/shared/filter-bar"
import { SAPDocumentChip } from "@demo/components/shared/sap-document-chip"
import { Button } from "@demo/components/ui/button"
import { Input } from "@demo/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@demo/components/ui/select"
import { I8_PLANTS } from "@demo/features/initiative-8/data/config"
import { JUSTIFICATION_REASONS } from "@demo/features/initiative-8/data/justifications"
import { ALL } from "@demo/features/initiative-8/model/metrics"
import { documentLabel, type PurchaseRow } from "@demo/features/initiative-8/model/snapshot"
import type {
  JustificationEntry,
  JustificationSource,
} from "@demo/features/initiative-8/types/repair"
import {
  BASIS_LABEL,
  JUSTIFICATION_SOURCE_LABEL,
  UNKNOWN,
  codeLabel,
} from "@demo/features/initiative-8/utils/status"
import type { SAPDocumentReference } from "@demo/lib/domain/contracts"
import { cn, downloadExcel, formatCount } from "@demo/lib/utils"

const SOURCES: JustificationSource[] = ["ASSISTANT", "EXCEPTION"]

/** "production critical" -> "Production critical", for the reason dropdown. */
function reasonLabel(code: string): string {
  const words = codeLabel(code)
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function sameLine(a: SAPDocumentReference, b: SAPDocumentReference): boolean {
  return a.documentNumber === b.documentNumber && (a.line ?? "") === (b.line ?? "")
}

/** A justification with the purchase it names, as the FR-6 check saw that purchase. */
interface LogRow {
  entry: JustificationEntry
  purchase?: PurchaseRow
}

/**
 * The new-acquisition justification log (FR-7) — every reason recorded for
 * buying new while a repairable unit already existed.
 *
 * Each card says which moment it was captured in, because "explained before
 * the request went through" and "explained weeks later when chased" are
 * different kinds of evidence about the same person's reasoning, and a log
 * that flattens them invites a reader to treat the second as the first.
 *
 * Each card also says what the repairable-unit check found on the day of the
 * purchase, and links the repair lines that were out — so a reviewer can see
 * what the requester was told without leaving the page.
 *
 * An audit view only: reasons are recorded on the Exception Queue, or by the
 * Spares Assistant at reservation time, never from here.
 */
export function JustificationLog({
  justifications,
  purchases,
}: {
  /** Newest first, this session's recordings included. */
  justifications: JustificationEntry[]
  purchases: PurchaseRow[]
}) {
  const [search, setSearch] = useState("")
  const [plant, setPlant] = useState<string>(ALL)
  const [reason, setReason] = useState<string>(ALL)
  const [source, setSource] = useState<string>(ALL)

  const rows = useMemo<LogRow[]>(
    () =>
      justifications.map((entry) => ({
        entry,
        purchase: purchases.find((p) => sameLine(p.line, entry.acquisitionLine)),
      })),
    [justifications, purchases]
  )

  // The configured list first, then any category a recorded reason carries
  // that the list does not — so nothing in the log is unreachable by filter.
  const reasonOptions = useMemo(() => {
    const extra = justifications
      .map((j) => j.reasonCategory)
      .filter((r) => !JUSTIFICATION_REASONS.includes(r))
    return [...JUSTIFICATION_REASONS, ...new Set(extra)]
  }, [justifications])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows.filter(({ entry }) => {
      if (plant !== ALL && entry.plant.plantId !== plant) return false
      if (reason !== ALL && entry.reasonCategory !== reason) return false
      if (source !== ALL && entry.source !== source) return false
      if (term) {
        const haystack = [
          entry.material.materialId,
          entry.material.description,
          entry.author,
          entry.freeText,
        ]
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(term)) return false
      }
      return true
    })
  }, [rows, search, plant, reason, source])

  const atReservation = filtered.filter((r) => r.entry.source === "ASSISTANT").length
  const activeFilters =
    (search.trim() ? 1 : 0) + [plant, reason, source].filter((v) => v !== ALL).length

  function clearFilters() {
    setSearch("")
    setPlant(ALL)
    setReason(ALL)
    setSource(ALL)
  }

  function exportExcel() {
    downloadExcel(
      "i08-new-acquisition-justifications.xlsx",
      [
        "Justification",
        "Captured",
        "Material",
        "Description",
        "Plant",
        "Reason category",
        "Free text",
        "Recorded by",
        "Recorded at",
        "Purchase",
        "Session",
        "Reservation",
        "Exception",
        "Repairable unit at the time",
        "Repair lines out at the time",
      ],
      filtered.map(({ entry, purchase }) => [
        entry.id,
        JUSTIFICATION_SOURCE_LABEL[entry.source],
        entry.material.materialId,
        entry.material.description,
        entry.plant.name,
        entry.reasonCategory,
        entry.freeText,
        entry.author,
        entry.recordedAt,
        documentLabel(entry.acquisitionLine),
        entry.sessionId ?? "",
        documentLabel(entry.reservation),
        entry.exceptionId ?? "",
        purchase ? purchase.basis.map((b) => BASIS_LABEL[b]).join("; ") : "",
        purchase ? purchase.openRepairIds.join("; ") : "",
      ])
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search material, description, author or text"
          className="h-9 w-full sm:w-72"
          aria-label="Search material, description, author or text"
        />

        <Select value={plant} onValueChange={(v) => setPlant(v ?? ALL)}>
          <SelectTrigger className="h-9 w-full sm:w-52">
            <SelectValue placeholder="Plant">
              {(value: string) =>
                value === ALL
                  ? "All plants"
                  : (I8_PLANTS.find((p) => p.plantId === value)?.name ?? value)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All plants</SelectItem>
            {I8_PLANTS.map((p) => (
              <SelectItem key={p.plantId} value={p.plantId}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={reason} onValueChange={(v) => setReason(v ?? ALL)}>
          <SelectTrigger className="h-9 w-full sm:w-56">
            <SelectValue placeholder="Reason">
              {(value: string) => (value === ALL ? "All reasons" : reasonLabel(value))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All reasons</SelectItem>
            {reasonOptions.map((r) => (
              <SelectItem key={r} value={r}>
                {reasonLabel(r)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={source} onValueChange={(v) => setSource(v ?? ALL)}>
          <SelectTrigger className="h-9 w-full sm:w-56">
            <SelectValue placeholder="Captured">
              {(value: string) =>
                value === ALL
                  ? "Captured any time"
                  : JUSTIFICATION_SOURCE_LABEL[value as JustificationSource]
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Captured any time</SelectItem>
            {SOURCES.map((s) => (
              <SelectItem key={s} value={s}>
                {JUSTIFICATION_SOURCE_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <ClearFiltersButton activeCount={activeFilters} onClear={clearFilters} />

        <div className="flex items-center gap-3 sm:ml-auto">
          <span className="text-xs text-muted-foreground">
            {formatCount(filtered.length)} of {formatCount(rows.length)} · {formatCount(atReservation)}{" "}
            at reservation time, {formatCount(filtered.length - atReservation)} chasing an exception
          </span>
          <Button size="sm" variant="outline" onClick={exportExcel} disabled={filtered.length === 0}>
            <Download className="size-3.5" />
            Export Excel
          </Button>
        </div>
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState
          title="No justifications match these filters."
          description="Nobody has gone ahead against the assistant's advice for this selection, or recorded a reason at this point in the process."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((row) => (
            <JustificationCard key={row.entry.id} row={row} />
          ))}
        </div>
      )}
    </div>
  )
}

function JustificationCard({ row: { entry: j, purchase } }: { row: LogRow }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-foreground">{j.material.materialId}</span>
        <span className="truncate text-muted-foreground">{j.material.description}</span>
        <span className="text-muted-foreground">@ {j.plant.name}</span>
        {/* Which moment this was captured in. See the note on the log. */}
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[11px]",
            j.source === "ASSISTANT"
              ? "bg-accent text-accent-foreground"
              : "border border-border text-muted-foreground"
          )}
        >
          {JUSTIFICATION_SOURCE_LABEL[j.source]}
        </span>
        <SAPDocumentChip doc={j.acquisitionLine} />
        {j.reservation && <SAPDocumentChip doc={j.reservation} />}
        <span className="ml-auto whitespace-nowrap text-muted-foreground">{j.recordedAt}</span>
      </div>

      <p className="mt-1.5 text-xs font-medium tracking-[0.3px] text-foreground uppercase">
        {codeLabel(j.reasonCategory)}
      </p>
      {/* The part a person actually reads when this is reviewed. A category on
          its own records only that a box was ticked. */}
      <p className="mt-0.5 text-xs text-muted-foreground">{j.freeText}</p>

      {/* What the requester was up against: the FR-6 check's answer for the
          day the purchase was raised, and the repair lines that were out. */}
      {purchase && (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
          <span>
            At the time:{" "}
            <span className="text-foreground">
              {purchase.basis.length > 0
                ? purchase.basis.map((b) => BASIS_LABEL[b]).join(", ")
                : "no repairable unit"}
            </span>
          </span>
          {purchase.openRepairIds.length > 0 && (
            <>
              <span>· repair out:</span>
              {purchase.openRepairIds.map((id) => (
                <Link
                  key={id}
                  href={`/repairable-spares/repair-register/${id}`}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  {id}
                </Link>
              ))}
            </>
          )}
        </p>
      )}

      <p className="mt-1 text-[11px] text-muted-foreground">
        Recorded by {j.author}
        {j.sessionId ? ` · session ${j.sessionId}` : " · no session"}
        {j.exceptionId && (
          <>
            {" · exception "}
            <Link
              href={`/repairable-spares/exceptions?id=${encodeURIComponent(j.exceptionId)}`}
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              {j.exceptionId}
            </Link>
          </>
        )}
        {!purchase && ` · purchase ${documentLabel(j.acquisitionLine) || UNKNOWN} not in the purchase data`}
      </p>
    </div>
  )
}
