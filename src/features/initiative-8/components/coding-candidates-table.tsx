"use client"

import { useMemo, useState } from "react"

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
import type { CodingCandidate } from "@/features/initiative-8/types/repair"
import { CODING_CONFIDENCE_TONE, CODING_VERDICT_TONE } from "@/features/initiative-8/utils/status"
import type { ApiCodingCandidateMeta } from "@/lib/api/i8"
import { getCodingCandidates } from "@/lib/api/i8"
import { useMaterial360 } from "@/lib/material-360-context"

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
  const [actionableOnly, setActionableOnly] = useState(false)
  const [corroboratedOnly, setCorroboratedOnly] = useState(false)
  const [meetsThresholdOnly, setMeetsThresholdOnly] = useState(false)

  const filtered = useMemo(() => {
    return candidates.filter((c) => {
      if (verdict !== ALL && c.verdict !== verdict) return false
      if (actionableOnly && !c.isActionable) return false
      if (corroboratedOnly && !c.isCorroborated) return false
      if (meetsThresholdOnly && !c.meetsConfidenceThreshold) return false
      return true
    })
  }, [candidates, verdict, actionableOnly, corroboratedOnly, meetsThresholdOnly])

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
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          {isUnscreened ? (
            <>
              Keyword pass only — every verdict reads <strong>UNSCREENED</strong> until the
              language model runs. Roughly 40 materials, about 4 minutes against live gpt-4o.
            </>
          ) : (
            <>
              Screened by <strong>{meta?.provider}</strong>
              {meta?.model ? ` (${meta.model})` : ""}. {meta?.corroborated ?? 0} candidate
              {meta?.corroborated === 1 ? "" : "s"} corroborated by an 80-series twin.
            </>
          )}
        </div>
        <Button size="sm" onClick={() => void runScreen()} disabled={screening}>
          {screening ? "Screening… (~4 min)" : "Run AI screen"}
        </Button>
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
