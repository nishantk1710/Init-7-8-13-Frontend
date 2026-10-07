"use client"

import { useMemo, useState } from "react"
import { Download } from "lucide-react"

import { EmptyState } from "@demo/components/shared/empty-state"
import { FilterBar } from "@demo/components/shared/filter-bar"
import { SAPDocumentChip } from "@demo/components/shared/sap-document-chip"
import { Button } from "@demo/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@demo/components/ui/select"
import { JUSTIFICATIONS } from "@demo/features/initiative-8/data/justifications"
import type { JustificationSource } from "@demo/features/initiative-8/types/repair"
import { cn, downloadCsv, formatCount } from "@demo/lib/utils"

const ALL = "all"

const SOURCE_LABELS: Record<JustificationSource, string> = {
  ASSISTANT: "At reservation time",
  EXCEPTION: "Chasing an exception",
}

/**
 * The new-acquisition justification log (FR-7) — every reason recorded for
 * buying new while a repairable unit already existed.
 *
 * Each row says which moment it was captured in, because "explained before the
 * request went through" and "explained weeks later when chased" are different
 * kinds of evidence about the same person's reasoning, and a log that flattens
 * them invites a reader to treat the second as the first.
 *
 * An audit view only: nothing is changed from here.
 */
export function JustificationLog() {
  const [source, setSource] = useState<string>(ALL)
  const [plant, setPlant] = useState<string>(ALL)

  const plantOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const j of JUSTIFICATIONS) seen.set(j.plant.plantId, j.plant.name)
    return [...seen.entries()].map(([plantId, name]) => ({ plantId, name }))
  }, [])

  const filtered = useMemo(
    () =>
      JUSTIFICATIONS.filter((j) => {
        if (source !== ALL && j.source !== source) return false
        if (plant !== ALL && j.plant.plantId !== plant) return false
        return true
      }),
    [source, plant]
  )

  const atReservation = filtered.filter((j) => j.source === "ASSISTANT").length

  function exportCsv() {
    downloadCsv(
      "i08-new-acquisition-justifications.csv",
      [
        "Captured",
        "Material",
        "Description",
        "Plant",
        "Reason category",
        "Free text",
        "Author",
        "Recorded at",
        "Acquisition line",
        "Session",
        "Exception",
      ],
      filtered.map((j) => [
        SOURCE_LABELS[j.source],
        j.material.materialId,
        j.material.description,
        j.plant.name,
        j.reasonCategory,
        j.freeText,
        j.author,
        j.recordedAt,
        `${j.acquisitionLine.documentNumber}${j.acquisitionLine.line ? `/${j.acquisitionLine.line}` : ""}`,
        j.sessionId ?? "",
        j.exceptionId ?? "",
      ])
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <Select value={source} onValueChange={(v) => setSource(v ?? ALL)}>
          <SelectTrigger className="h-9 w-full sm:w-56">
            <SelectValue placeholder="Captured">
              {(value: string) =>
                value === ALL
                  ? "Captured any time"
                  : SOURCE_LABELS[value as JustificationSource]
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Captured any time</SelectItem>
            <SelectItem value="ASSISTANT">{SOURCE_LABELS.ASSISTANT}</SelectItem>
            <SelectItem value="EXCEPTION">{SOURCE_LABELS.EXCEPTION}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={plant} onValueChange={(v) => setPlant(v ?? ALL)}>
          <SelectTrigger className="h-9 w-full sm:w-48">
            <SelectValue placeholder="Plant">
              {(value: string) =>
                value === ALL
                  ? "All plants"
                  : (plantOptions.find((p) => p.plantId === value)?.name ?? value)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All plants</SelectItem>
            {plantOptions.map((p) => (
              <SelectItem key={p.plantId} value={p.plantId}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-3 sm:ml-auto">
          <span className="text-xs text-muted-foreground">
            {formatCount(filtered.length)} justification
            {filtered.length === 1 ? "" : "s"} · {formatCount(atReservation)} at
            reservation time, {formatCount(filtered.length - atReservation)} chasing an
            exception
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={exportCsv}
            disabled={filtered.length === 0}
          >
            <Download className="size-3.5" />
            Export CSV
          </Button>
        </div>
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState
          title="No justifications match these filters."
          description="Nobody has gone ahead against the assistant's advice for this plant, or recorded a reason at this point in the process."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((j) => (
            <div key={j.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium text-foreground">
                  {j.material.materialId}
                </span>
                <span className="truncate text-muted-foreground">
                  {j.material.description}
                </span>
                <span className="text-muted-foreground">@ {j.plant.name}</span>
                {/* Which moment this was captured in. See the note above. */}
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[11px]",
                    j.source === "ASSISTANT"
                      ? "bg-accent text-accent-foreground"
                      : "border border-border text-muted-foreground"
                  )}
                >
                  {SOURCE_LABELS[j.source]}
                </span>
                <SAPDocumentChip doc={j.acquisitionLine} />
                <span className="ml-auto whitespace-nowrap text-muted-foreground">
                  {j.recordedAt}
                </span>
              </div>

              <p className="mt-1.5 text-xs font-medium text-foreground">
                {j.reasonCategory.replace(/_/g, " ")}
              </p>
              {/* The part a person actually reads when this is reviewed. A
                  category on its own records only that a box was ticked. */}
              <p className="mt-0.5 text-xs text-muted-foreground">{j.freeText}</p>

              <p className="mt-1 text-[11px] text-muted-foreground">
                Recorded by {j.author}
                {j.sessionId && ` · session ${j.sessionId}`}
                {j.exceptionId && ` · exception ${j.exceptionId}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
