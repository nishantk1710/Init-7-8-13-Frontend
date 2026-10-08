"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"

import { ClearFiltersButton } from "@demo/components/shared/clear-filters-button"
import { FilterBar } from "@demo/components/shared/filter-bar"
import { MaterialIdentity } from "@demo/components/shared/material-identity"
import { StatusBadge } from "@demo/components/shared/status-badge"
import { Button } from "@demo/components/ui/button"
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
import { CODING_CANDIDATES, CODING_SCREEN } from "@demo/features/initiative-8/data/coding-candidates"
import {
  CODING_CONFIDENCE_TONE,
  CODING_VERDICT_TONE,
} from "@demo/features/initiative-8/utils/status"
import { useMaterial360 } from "@demo/lib/material-360-context"

const ALL = "all"

const VERDICTS = [
  "MISCODED_REPAIRABLE",
  "UNCLEAR",
  "REPAIR_SERVICE",
  "CONSUMABLE_FOR_REPAIR",
  "UNSCREENED",
]

/** How long the snapshot's re-screen shows as running. Nothing is called. */
const SCREEN_DURATION_MS = 1500

/**
 * Coding Candidates (FR-2) — materials whose purchase-order free text talks
 * about repair while the material is not 80-series coded. Advisory only:
 * nothing on this screen writes to SAP or recodes a material.
 */
export function CodingCandidatesTable() {
  const { openMaterial360 } = useMaterial360()
  const [screening, setScreening] = useState(false)
  const [verdict, setVerdict] = useState<string>(ALL)
  const [actionableOnly, setActionableOnly] = useState(false)
  const [corroboratedOnly, setCorroboratedOnly] = useState(false)
  const [meetsThresholdOnly, setMeetsThresholdOnly] = useState(false)

  const filtered = useMemo(
    () =>
      CODING_CANDIDATES.filter((c) => {
        if (verdict !== ALL && c.verdict !== verdict) return false
        if (actionableOnly && !c.isActionable) return false
        if (corroboratedOnly && !c.isCorroborated) return false
        if (meetsThresholdOnly && !c.meetsConfidenceThreshold) return false
        return true
      }),
    [verdict, actionableOnly, corroboratedOnly, meetsThresholdOnly]
  )

  const corroborated = CODING_CANDIDATES.filter((c) => c.isCorroborated).length

  function runScreen() {
    setScreening(true)
    setTimeout(() => {
      setScreening(false)
      toast.success(`Screen complete — ${CODING_CANDIDATES.length} materials, verdicts unchanged.`)
    }, SCREEN_DURATION_MS)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Screened by <strong>{CODING_SCREEN.provider}</strong> ({CODING_SCREEN.model}).{" "}
          {corroborated} candidate{corroborated === 1 ? "" : "s"} corroborated by an 80-series twin.
        </div>
        <Button size="sm" onClick={runScreen} disabled={screening}>
          {screening ? "Screening…" : "Run AI screen"}
        </Button>
      </div>

      <FilterBar>
        <Select value={verdict} onValueChange={(v) => setVerdict(v ?? ALL)}>
          <SelectTrigger className="h-9 w-full sm:w-56">
            <SelectValue placeholder="Verdict">
              {(value: string) => (value === ALL ? "All verdicts" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All verdicts</SelectItem>
            {VERDICTS.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={actionableOnly ? "yes" : ALL}
          onValueChange={(v) => setActionableOnly(v === "yes")}
        >
          <SelectTrigger className="h-9 w-full sm:w-44">
            <SelectValue placeholder="Actionable">
              {(value: string) => (value === "yes" ? "Actionable only" : "All candidates")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All candidates</SelectItem>
            <SelectItem value="yes">Actionable only</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={corroboratedOnly ? "yes" : ALL}
          onValueChange={(v) => setCorroboratedOnly(v === "yes")}
        >
          <SelectTrigger className="h-9 w-full sm:w-48">
            <SelectValue placeholder="Corroborated">
              {(value: string) => (value === "yes" ? "Corroborated only" : "All candidates")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All candidates</SelectItem>
            <SelectItem value="yes">Corroborated only</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={meetsThresholdOnly ? "yes" : ALL}
          onValueChange={(v) => setMeetsThresholdOnly(v === "yes")}
        >
          <SelectTrigger className="h-9 w-full sm:w-56">
            <SelectValue placeholder="Confidence threshold">
              {(value: string) => (value === "yes" ? "Meets confidence threshold" : "All candidates")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All candidates</SelectItem>
            <SelectItem value="yes">Meets confidence threshold</SelectItem>
          </SelectContent>
        </Select>

        <ClearFiltersButton
          activeCount={
            [verdict !== ALL, actionableOnly, corroboratedOnly, meetsThresholdOnly].filter(Boolean)
              .length
          }
          onClear={() => {
            setVerdict(ALL)
            setActionableOnly(false)
            setCorroboratedOnly(false)
            setMeetsThresholdOnly(false)
          }}
        />
      </FilterBar>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No coding candidates match these filters.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Verdict</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Plants</TableHead>
                <TableHead className="text-right">PO Lines</TableHead>
                <TableHead>Screened At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.material.materialId}>
                  <TableCell>
                    <MaterialIdentity material={c.material} onOpen={openMaterial360} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={CODING_VERDICT_TONE[c.verdict] ?? "default"}>
                      {c.verdict}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    {c.confidence ? (
                      <StatusBadge tone={CODING_CONFIDENCE_TONE[c.confidence] ?? "default"}>
                        {c.confidence}
                      </StatusBadge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {c.isCorroborated && <StatusBadge tone="success">Twin found</StatusBadge>}
                      {c.isActionable && <StatusBadge tone="warning">Actionable</StatusBadge>}
                      {c.meetsConfidenceThreshold && (
                        <StatusBadge tone="default">Meets threshold</StatusBadge>
                      )}
                      {!c.isCorroborated && !c.isActionable && !c.meetsConfidenceThreshold && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate text-muted-foreground" title={c.reason}>
                    {c.reason || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.plants.length > 0 ? c.plants.join(", ") : "—"}
                  </TableCell>
                  <TableCell className="text-right text-foreground">{c.lines.length}</TableCell>
                  <TableCell className="text-muted-foreground">{c.screenedAt}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
