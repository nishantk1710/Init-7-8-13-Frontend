"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight, Download } from "lucide-react"

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
import { CODING_CANDIDATES } from "@demo/features/initiative-8/data/coding-candidates"
import {
  CODING_CONFIDENCE_TONE,
  CODING_VERDICT_TONE,
} from "@demo/features/initiative-8/utils/status"
import { useMaterial360 } from "@demo/lib/material-360-context"
import { downloadCsv, formatCount } from "@demo/lib/utils"

const ALL = "all"

const VERDICTS = [
  "MISCODED_REPAIRABLE",
  "UNCLEAR",
  "REPAIR_SERVICE",
  "CONSUMABLE_FOR_REPAIR",
]

/**
 * Coding Candidates (FR-2) — materials whose purchase-order free text talks
 * about repair while the material is not 80-series coded.
 *
 * Advisory only. Nothing on this screen writes to SAP or recodes a material;
 * a row is a case for a cataloguer to look at, and the evidence is expandable
 * precisely so the call can be checked rather than taken on trust.
 */
export function CodingCandidatesTable() {
  const { openMaterial360 } = useMaterial360()
  const [verdict, setVerdict] = useState<string>(ALL)
  const [actionableOnly, setActionableOnly] = useState(false)
  const [corroboratedOnly, setCorroboratedOnly] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const filtered = useMemo(
    () =>
      CODING_CANDIDATES.filter((c) => {
        if (verdict !== ALL && c.verdict !== verdict) return false
        if (actionableOnly && !c.isActionable) return false
        if (corroboratedOnly && !c.isCorroborated) return false
        return true
      }),
    [verdict, actionableOnly, corroboratedOnly]
  )

  const corroborated = CODING_CANDIDATES.filter((c) => c.isCorroborated).length

  function exportCsv() {
    downloadCsv(
      "i08-coding-candidates.csv",
      [
        "Material",
        "Description",
        "Verdict",
        "Confidence",
        "Reason",
        "Plants",
        "PO Lines",
        "Twin",
        "Actionable",
        "Screened At",
      ],
      filtered.map((c) => [
        c.material.materialId,
        c.material.description,
        c.verdict,
        c.confidence,
        c.reason,
        c.plants.join(" / "),
        c.lines.length,
        c.twins.map((t) => t.materialId).join(" / "),
        c.isActionable ? "Yes" : "No",
        c.screenedAt,
      ])
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div>
          {formatCount(CODING_CANDIDATES.length)} materials screened ·{" "}
          <strong className="text-foreground">{corroborated}</strong> corroborated by an
          80-series twin carrying the same description.
        </div>
        {/* Said on the screen, not only in the handover note: a reader who
            opens this page cold should not have to ask what it may change. */}
        <div className="text-xs">Advisory — nothing here changes SAP coding.</div>
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
              {(value: string) =>
                value === "yes" ? "Corroborated only" : "All candidates"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All candidates</SelectItem>
            <SelectItem value="yes">Corroborated only</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-3 sm:ml-auto">
          <span className="text-xs text-muted-foreground">
            {formatCount(filtered.length)} of {formatCount(CODING_CANDIDATES.length)} shown
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
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No coding candidates match these filters.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
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
              {filtered.map((c) => {
                const isOpen = expanded === c.material.materialId
                return [
                  <TableRow key={c.material.materialId}>
                    <TableCell>
                      <button
                        type="button"
                        aria-label={isOpen ? "Hide evidence" : "Show evidence"}
                        onClick={() =>
                          setExpanded(isOpen ? null : c.material.materialId)
                        }
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {isOpen ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      <MaterialIdentity material={c.material} onOpen={openMaterial360} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={CODING_VERDICT_TONE[c.verdict] ?? "default"}>
                        {c.verdict}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={CODING_CONFIDENCE_TONE[c.confidence] ?? "default"}>
                        {c.confidence}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {c.isCorroborated && <StatusBadge tone="success">Twin found</StatusBadge>}
                        {c.isActionable && <StatusBadge tone="warning">Actionable</StatusBadge>}
                        {!c.meetsConfidenceThreshold && (
                          <StatusBadge>Below threshold</StatusBadge>
                        )}
                        {!c.isCorroborated &&
                          !c.isActionable &&
                          c.meetsConfidenceThreshold && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                      </div>
                    </TableCell>
                    <TableCell
                      className="max-w-[280px] truncate text-muted-foreground"
                      title={c.reason}
                    >
                      {c.reason}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.plants.join(", ")}
                    </TableCell>
                    <TableCell className="text-right text-foreground">
                      {c.lines.length}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {c.screenedAt}
                    </TableCell>
                  </TableRow>,
                  isOpen ? (
                    <TableRow key={`${c.material.materialId}-evidence`}>
                      <TableCell colSpan={9} className="bg-muted/30">
                        <div className="flex flex-col gap-3 py-1">
                          <div>
                            <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-muted-foreground">
                              Purchase-order text this verdict was reached on
                            </p>
                            <div className="mt-1.5 flex flex-col gap-1.5">
                              {c.lines.map((l) => (
                                <div
                                  key={`${l.purchasingDocument}-${l.item}`}
                                  className="flex flex-wrap items-baseline gap-2 text-xs"
                                >
                                  <span className="font-mono text-[11px] text-muted-foreground">
                                    {l.purchasingDocument}/{l.item}
                                  </span>
                                  <span className="text-foreground">{l.shortText}</span>
                                  <span className="text-[11px] text-muted-foreground">
                                    {l.plant.name} · {l.raisedAt}
                                  </span>
                                  {l.matchedKeywords.length > 0 && (
                                    <span className="text-[11px] text-muted-foreground">
                                      matched: {l.matchedKeywords.join(", ")}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* SAP's own counter-example. The strongest evidence
                              this screen produces, and it owes nothing to a
                              language model — so it is shown separately. */}
                          {c.twins.length > 0 && (
                            <div>
                              <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-muted-foreground">
                                80-series twin carrying the same description
                              </p>
                              <div className="mt-1.5 flex flex-col gap-1">
                                {c.twins.map((t) => (
                                  <div key={t.materialId} className="text-xs">
                                    <span className="font-medium text-foreground">
                                      {t.materialId}
                                    </span>
                                    <span className="ml-2 text-muted-foreground">
                                      {t.sharedText}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null,
                ]
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
