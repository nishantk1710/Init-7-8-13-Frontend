"use client"

import { useMemo, useState } from "react"

import { ClearFiltersButton } from "@/components/shared/clear-filters-button"
import { FilterBar } from "@/components/shared/filter-bar"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toCodingCandidate } from "@/features/initiative-8/data/live-coding-candidates"
import type {
  CodingCandidate,
  CodingCandidateSource,
} from "@/features/initiative-8/types/repair"
import { CODING_CONFIDENCE_TONE, CODING_VERDICT_TONE } from "@/features/initiative-8/utils/status"
import type { ApiCodingCandidateMeta } from "@/lib/api/i8"
import { getCodingCandidates } from "@/lib/api/i8"
import { useMaterial360 } from "@/lib/material-360-context"
import { downloadCsv } from "@/lib/utils"

const ALL = "all"

// Not the closed set the backend could one day return -- these are just the
// verdicts this build's prompt has ever produced. An unrecognised verdict
// value still renders fine (CODING_VERDICT_TONE falls back to "default");
// it just would not appear as a filter option until added here.
const VERDICTS = [
  "MISCODED_REPAIRABLE",
  "UNCLEAR",
  "REPAIR_SERVICE",
  "CONSUMABLE_FOR_REPAIR",
  "UNSCREENED",
]

// How a line's source reads in the table. The raw enum values are shouted
// acronyms; these are what a cataloguer would call them.
const SOURCE_LABEL: Record<CodingCandidateSource, string> = {
  PO: "PO text",
  PR: "PR text",
  MOVEMENT: "Movement text",
}

/**
 * Which sources a candidate's evidence came from, in a fixed order.
 *
 * Fixed rather than first-seen, so two rows with the same mix read the same
 * way and the column can be scanned down rather than read cell by cell.
 */
function sourcesOf(candidate: CodingCandidate): CodingCandidateSource[] {
  const present = new Set(candidate.lines.map((line) => line.source))
  return (["PO", "PR", "MOVEMENT"] as const).filter((s) => present.has(s))
}

function formatScreenedAt(iso?: string): string {
  if (!iso) return "Not yet screened"
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return "Not yet screened"
  return parsed.toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export type CodingCandidatesTableProps = {
  /** Rows to render. There is no fixture data for this screen (see the
   *  page component) — this is only ever fed live results. */
  candidates?: CodingCandidate[]
  meta?: ApiCodingCandidateMeta | null
  loadError?: string | null
}

export function CodingCandidatesTable({
  candidates: initialCandidates = [],
  meta: initialMeta = null,
  loadError = null,
}: CodingCandidatesTableProps = {}) {
  const { openMaterial360 } = useMaterial360()
  const [candidates, setCandidates] = useState(initialCandidates)
  const [meta, setMeta] = useState(initialMeta)
  const [screening, setScreening] = useState(false)
  const [screenError, setScreenError] = useState<string | null>(null)

  const [verdict, setVerdict] = useState<string>(ALL)
  const [plant, setPlant] = useState<string>(ALL)
  const [actionableOnly, setActionableOnly] = useState(false)
  const [corroboratedOnly, setCorroboratedOnly] = useState(false)
  const [meetsThresholdOnly, setMeetsThresholdOnly] = useState(false)

  // FR-10 asks for a plant filter on every screen and this one had none.
  // Built from the rows rather than hard-coded: the plant scope is a backend
  // setting (1300 and 1500 today) and a list typed here would be a second
  // place to change it.
  const plants = useMemo(() => {
    const seen = new Set<string>()
    for (const c of candidates) for (const p of c.plants) seen.add(p)
    return [...seen].sort()
  }, [candidates])

  const filtered = useMemo(() => {
    return candidates.filter((c) => {
      if (verdict !== ALL && c.verdict !== verdict) return false
      if (plant !== ALL && !c.plants.includes(plant)) return false
      if (actionableOnly && !c.isActionable) return false
      if (corroboratedOnly && !c.isCorroborated) return false
      if (meetsThresholdOnly && !c.meetsConfidenceThreshold) return false
      return true
    })
  }, [candidates, verdict, plant, actionableOnly, corroboratedOnly, meetsThresholdOnly])

  /**
   * Export what is on screen.
   *
   * The TEXT goes in the file, and so does the source it came from: a
   * cataloguer takes this to the SAP team, and "material 5000094118 reads like
   * a repairable" is not a case -- the words somebody typed on a specific
   * document are.
   */
  function exportCsv() {
    downloadCsv(
      "i08-coding-candidates.csv",
      [
        "Material",
        "Verdict",
        "Confidence",
        "Corroborated",
        "Twin Material",
        "Plants",
        "Evidence From",
        "Lines",
        "Triggering Text",
        "Reason",
        "Provider",
        "Screened At",
      ],
      filtered.map((c) => [
        c.material.materialCode,
        c.verdict,
        c.confidence,
        c.isCorroborated ? "Yes" : "No",
        c.twins.map((t) => t.materialId).join(" "),
        c.plants.join(" "),
        sourcesOf(c).map((src) => SOURCE_LABEL[src]).join(" "),
        c.lines.length,
        c.distinctTexts.join(" | "),
        c.reason,
        c.provider,
        c.screenedAt ?? "",
      ])
    )
  }

  /**
   * The slow, opt-in language-judgement pass -- one model call per material,
   * ~6 seconds each and strictly sequential (246s measured for 41 materials
   * against live gpt-4o). Triggered from the client rather than the page load,
   * exactly because it must not block rendering the fast keyword-only pass.
   */
  async function runScreen() {
    setScreening(true)
    setScreenError(null)
    try {
      const body = await getCodingCandidates({ screen: true })
      setCandidates(body.items.map(toCodingCandidate))
      setMeta(body.meta)
    } catch (error) {
      setScreenError(error instanceof Error ? error.message : String(error))
    } finally {
      setScreening(false)
    }
  }

  if (loadError) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center text-sm"
      >
        <p className="font-medium text-foreground">The coding-candidate screen could not be loaded.</p>
        <p className="mt-1 text-muted-foreground">{loadError}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          This is not &ldquo;no candidates found&rdquo; — it is a failed request. Check
          that the backend is running and that NEXT_PUBLIC_API_BASE_URL points
          at it.
        </p>
      </div>
    )
  }

  const isUnscreened = meta ? meta.provider === "" || meta.provider === "stub" : true

  return (
    <div className="flex flex-col gap-4">
      {/* Before a screen has run there is nothing to report, so the button
          stands alone; after one, what it found sits beside it. */}
      <div
        className={
          isUnscreened
            ? "flex justify-end"
            : "flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between"
        }
      >
        {!isUnscreened && (
          <div className="text-sm text-muted-foreground">
            Screened by <strong>{meta?.provider}</strong>
            {meta?.model ? ` (${meta.model})` : ""}. {meta?.corroborated ?? 0} candidate
            {meta?.corroborated === 1 ? "" : "s"} corroborated by an 80-series twin.
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={exportCsv}>
            Export CSV
          </Button>
          <Button size="sm" onClick={() => void runScreen()} disabled={screening}>
            {screening ? "Screening… (~4 min)" : "Run AI screen"}
          </Button>
        </div>
      </div>

      {screenError && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          The screen did not complete: {screenError}
        </div>
      )}

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

        <Select value={plant} onValueChange={(v) => setPlant(v ?? ALL)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All plants">
              {(value: string) => (value === ALL ? "All plants" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All plants</SelectItem>
            {plants.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <ClearFiltersButton
          activeCount={
            [
              verdict !== ALL,
              plant !== ALL,
              actionableOnly,
              corroboratedOnly,
              meetsThresholdOnly,
            ].filter(Boolean).length
          }
          onClear={() => {
            setVerdict(ALL)
            setPlant(ALL)
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
                <TableHead>Evidence From</TableHead>
                <TableHead className="text-right">Lines</TableHead>
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
                  {/* Which documents the words came from. A candidate seen only
                      on a requisition is a different -- earlier -- finding from
                      one seen on a purchase order, and the column says so
                      rather than leaving a reader to open the row. */}
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {sourcesOf(c).map((source) => (
                        <StatusBadge key={source} tone="default">
                          {SOURCE_LABEL[source]}
                        </StatusBadge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-foreground">{c.lines.length}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatScreenedAt(c.screenedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
