"use client"

import { Fragment, useMemo, useState } from "react"
import { ChevronDown, ChevronRight, Download, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { ClearFiltersButton } from "@demo/components/shared/clear-filters-button"
import { EmptyState } from "@demo/components/shared/empty-state"
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
import { CODING_SCREEN, I8_PLANTS } from "@demo/features/initiative-8/data/config"
import { ALL } from "@demo/features/initiative-8/model/metrics"
import { snapshotStore, useI08Snapshot } from "@demo/features/initiative-8/state/snapshot-store"
import type {
  CodingCandidateLine,
  CodingTextSource,
  RankedCodingCandidate,
} from "@demo/features/initiative-8/types/repair"
import { instantOf } from "@demo/features/initiative-8/utils/dates"
import {
  CODING_CONFIDENCE_TONE,
  CODING_SOURCE_LABEL,
  CODING_VERDICTS,
  CODING_VERDICT_TONE,
  UNKNOWN,
  codeLabel,
} from "@demo/features/initiative-8/utils/status"
import { cn, downloadExcel, formatCount } from "@demo/lib/utils"

const SOURCES = Object.keys(CODING_SOURCE_LABEL) as CodingTextSource[]

/** How long the Snapshot's re-screen shows as running. Nothing is called. */
const SCREEN_DURATION_MS = 1500

/** Columns in the table, so the expanded evidence row spans all of them. */
const COLUMN_COUNT = 10

/** "MISCODED_REPAIRABLE" -> "Miscoded repairable", for dropdowns and the CSV. */
function verdictLabel(verdict: string): string {
  const words = codeLabel(verdict)
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function lineLabel(line: CodingCandidateLine): string {
  const mvt = line.movementType ? ` mvt ${line.movementType}` : ""
  return `${line.source} ${line.document}/${line.item}${mvt} @ ${line.plant.name}: ${line.shortText} (${line.raisedAt})`
}

function flagsOf(c: RankedCodingCandidate): string[] {
  return [
    c.isCorroborated && "Twin found",
    c.isActionable && "Actionable",
  ].filter((flag): flag is string => !!flag)
}

/**
 * Coding Candidates (FR-2) — materials whose purchase-requisition, purchase-
 * order or goods-movement free text talks about repair while the material is
 * not 80-series coded, ranked so the likeliest miscodings come first.
 *
 * Every row shows the text that raised it and the screen's reason in full,
 * because a cataloguer deciding whether to recode a part needs the evidence,
 * not a score. A twin — an 80-series material carrying the identical text —
 * is called out separately: it is SAP's own counter-example and owes nothing
 * to the model.
 *
 * Advisory only: nothing on this screen writes to SAP or recodes a material.
 * "Run AI screen" moves the screening time on; the kept verdicts do not change.
 */
export function CodingCandidatesTable() {
  const candidates = useI08Snapshot().codingCandidates
  const [screening, setScreening] = useState(false)
  const [verdict, setVerdict] = useState<string>(ALL)
  const [source, setSource] = useState<string>(ALL)
  const [plant, setPlant] = useState<string>(ALL)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())

  const filtered = useMemo(
    () =>
      candidates.filter((c) => {
        if (verdict !== ALL && c.verdict !== verdict) return false
        if (source !== ALL && !c.sources.includes(source as CodingTextSource)) return false
        if (plant !== ALL && !c.plants.some((p) => p.plantId === plant)) return false
        return true
      }),
    [candidates, verdict, source, plant]
  )

  const corroborated = candidates.filter((c) => c.isCorroborated).length
  const lastScreened = candidates.reduce<string | undefined>(
    (latest, c) => (!latest || instantOf(c.screenedAt) > instantOf(latest) ? c.screenedAt : latest),
    undefined
  )
  const activeFilters = [verdict, source, plant].filter((v) => v !== ALL).length

  function runScreen() {
    setScreening(true)
    setTimeout(() => {
      snapshotStore.rescreenCodingCandidates()
      setScreening(false)
      toast.success(`Screen complete — ${formatCount(candidates.length)} materials, verdicts unchanged`)
    }, SCREEN_DURATION_MS)
  }

  function toggleRow(materialId: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(materialId)) next.delete(materialId)
      else next.add(materialId)
      return next
    })
  }

  function clearFilters() {
    setVerdict(ALL)
    setSource(ALL)
    setPlant(ALL)
  }

  function exportExcel() {
    downloadExcel(
      "i08-coding-candidates.xlsx",
      [
        "Rank",
        "Material",
        "Description",
        "Verdict",
        "Confidence",
        "Flags",
        "Reason",
        "Plants",
        "Text sources",
        "Evidence",
        "Twins",
        "Screened at",
      ],
      filtered.map((c) => [
        c.rank,
        c.material.materialId,
        c.material.description,
        verdictLabel(c.verdict),
        c.confidence,
        flagsOf(c).join("; "),
        c.reason,
        c.plants.map((p) => p.name).join("; "),
        c.sources.map((s) => CODING_SOURCE_LABEL[s]).join("; "),
        c.lines.map(lineLabel).join(" | "),
        c.twins.map((t) => `${t.materialId}: ${t.sharedText}`).join(" | "),
        c.screenedAt,
      ])
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Screened by <strong className="text-foreground">{CODING_SCREEN.provider}</strong> (
          {CODING_SCREEN.model}) · last screened{" "}
          <strong className="text-foreground">{lastScreened ?? UNKNOWN}</strong> ·{" "}
          {formatCount(corroborated)} corroborated by an 80-series twin · text sources: PR, PO
          and movement text
        </p>
        <Button size="sm" onClick={runScreen} disabled={screening} className="shrink-0">
          <Sparkles className={cn("size-3.5", screening && "animate-pulse")} />
          {screening ? "Screening…" : "Run AI screen"}
        </Button>
      </div>

      <FilterBar>
        <Select value={verdict} onValueChange={(v) => setVerdict(v ?? ALL)}>
          <SelectTrigger className="h-9 w-full sm:w-56">
            <SelectValue placeholder="Verdict">
              {(value: string) => (value === ALL ? "All verdicts" : verdictLabel(value))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All verdicts</SelectItem>
            {CODING_VERDICTS.map((v) => (
              <SelectItem key={v} value={v}>
                {verdictLabel(v)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={source} onValueChange={(v) => setSource(v ?? ALL)}>
          <SelectTrigger className="h-9 w-full sm:w-44">
            <SelectValue placeholder="Text source">
              {(value: string) =>
                value === ALL ? "All text sources" : CODING_SOURCE_LABEL[value as CodingTextSource]
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All text sources</SelectItem>
            {SOURCES.map((s) => (
              <SelectItem key={s} value={s}>
                {CODING_SOURCE_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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

        <ClearFiltersButton activeCount={activeFilters} onClear={clearFilters} />

        <div className="flex items-center gap-3 sm:ml-auto">
          <span className="text-xs text-muted-foreground">
            {formatCount(filtered.length)} of {formatCount(candidates.length)} materials
          </span>
          <Button size="sm" variant="outline" onClick={exportExcel} disabled={filtered.length === 0}>
            <Download className="size-3.5" />
            Export Excel
          </Button>
        </div>
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState
          title="No coding candidates match these filters."
          description="Widen the verdict, source or plant filter."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-right">#</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Verdict</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Plants</TableHead>
                <TableHead>Text Sources</TableHead>
                <TableHead className="text-right">Evidence</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Show evidence</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const id = c.material.materialId
                const open = expanded.has(id)
                const flags = flagsOf(c)
                return (
                  <Fragment key={id}>
                    {/* The whole row opens the evidence, not only the chevron
                        at the end -- so the row is the control, and carries
                        the aria state the chevron button used to. The material
                        cell used to open the Material 360 drawer instead,
                        which on a coding candidate has nothing to show: these
                        materials are raised from PR, PO and movement text, not
                        from the shared catalogue. */}
                    <TableRow
                      tabIndex={0}
                      aria-expanded={open}
                      aria-label={`${open ? "Hide" : "Show"} evidence for ${id}`}
                      onClick={() => toggleRow(id)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return
                        // Space scrolls the page otherwise, and here it opens a row.
                        event.preventDefault()
                        toggleRow(id)
                      }}
                      className="cursor-pointer align-top aria-expanded:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                    >
                      <TableCell className="text-right align-top font-medium tabular-nums text-foreground">
                        {c.rank}
                      </TableCell>
                      <TableCell className="align-top">
                        <MaterialIdentity material={c.material} />
                      </TableCell>
                      <TableCell className="align-top">
                        <StatusBadge tone={CODING_VERDICT_TONE[c.verdict] ?? "default"}>
                          {codeLabel(c.verdict)}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="align-top">
                        <StatusBadge tone={CODING_CONFIDENCE_TONE[c.confidence] ?? "default"}>
                          {c.confidence || UNKNOWN}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex max-w-[180px] flex-wrap gap-1">
                          {c.isCorroborated && <StatusBadge tone="success">Twin found</StatusBadge>}
                          {c.isActionable && <StatusBadge tone="warning">Actionable</StatusBadge>}
                          {flags.length === 0 && (
                            <span className="text-xs text-muted-foreground">{UNKNOWN}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[260px] max-w-[360px] align-top text-xs whitespace-normal text-muted-foreground">
                        {c.reason || UNKNOWN}
                      </TableCell>
                      <TableCell className="align-top text-xs text-muted-foreground">
                        {c.plants.map((p) => (
                          <span key={p.plantId} className="block">
                            {p.name}
                          </span>
                        ))}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex max-w-[150px] flex-wrap gap-1">
                          {c.sources.map((s) => (
                            <StatusBadge key={s}>{CODING_SOURCE_LABEL[s]}</StatusBadge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right align-top tabular-nums text-foreground">
                        {formatCount(c.lines.length)}
                      </TableCell>
                      <TableCell className="align-top">
                        {/* A marker now, not a second control: the row takes
                            the click, and a button inside it would toggle
                            twice. */}
                        <span
                          aria-hidden="true"
                          className="flex size-8 items-center justify-center text-muted-foreground"
                        >
                          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                        </span>
                      </TableCell>
                    </TableRow>
                    {open && (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={COLUMN_COUNT} className="whitespace-normal">
                          <EvidencePanel candidate={c} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

/**
 * The document lines a candidate was raised on, each with its text and the
 * words that matched, then any 80-series twin. This is what a cataloguer
 * checks before deciding to recode.
 */
function EvidencePanel({ candidate }: { candidate: RankedCodingCandidate }) {
  return (
    <div className="flex flex-col gap-3 px-2 py-1">
      <div>
        <p className="mb-1.5 text-xs font-medium text-foreground">
          Evidence — {formatCount(candidate.lines.length)} line{candidate.lines.length === 1 ? "" : "s"}{" "}
          of free text
        </p>
        <ul className="flex flex-col gap-1.5">
          {candidate.lines.map((line) => (
            <li
              key={`${line.source}-${line.document}-${line.item}`}
              className="flex flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2 text-xs sm:flex-row sm:items-center sm:gap-3"
            >
              <div className="flex shrink-0 flex-wrap items-center gap-2 sm:w-72">
                <StatusBadge>{CODING_SOURCE_LABEL[line.source]}</StatusBadge>
                <span className="font-medium text-foreground">
                  {line.document}/{line.item}
                </span>
                {line.movementType && (
                  <span className="text-muted-foreground">mvt {line.movementType}</span>
                )}
                <span className="text-muted-foreground">{line.plant.name}</span>
              </div>
              <code className="min-w-0 flex-1 font-mono text-[11px] break-words text-foreground">
                <HighlightedText text={line.shortText} keywords={line.matchedKeywords} />
              </code>
              <span className="shrink-0 whitespace-nowrap text-muted-foreground">{line.raisedAt}</span>
            </li>
          ))}
        </ul>
      </div>

      {candidate.twins.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-foreground">80-series twin</p>
          <ul className="flex flex-col gap-1">
            {candidate.twins.map((twin) => (
              <li key={twin.materialId} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{twin.materialId}</span> carries the
                same text:{" "}
                <code className="font-mono text-[11px] text-foreground">{twin.sharedText}</code>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** The short text with every matched keyword marked, case-insensitively. */
function HighlightedText({ text, keywords }: { text: string; keywords: string[] }) {
  const terms = keywords.filter(Boolean).sort((a, b) => b.length - a.length)
  if (terms.length === 0) return <>{text}</>
  // A capturing split puts every match at an odd index.
  const parts = text.split(new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi"))
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <mark key={index} className="rounded-sm bg-warning/20 px-0.5 text-foreground">
            {part}
          </mark>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        )
      )}
    </>
  )
}
