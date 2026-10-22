"use client"

import { Fragment, useMemo, useRef, useState } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"

import { ClearFiltersButton } from "@/components/shared/clear-filters-button"
import { FilterBar } from "@/components/shared/filter-bar"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { StatusBadge } from "@/components/shared/status-badge"
import { StickyScrollTable } from "@/components/shared/sticky-scroll-table"
import { TablePagination } from "@/components/shared/table-pagination"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
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
import {
  matchesCandidateSearch,
  newItemPriceCell,
  nextPriceSort,
  sortByNewItemPrice,
  type PriceSort,
} from "@/features/initiative-8/utils/coding-candidates-view"
import { CODING_CONFIDENCE_TONE, CODING_VERDICT_TONE, UNKNOWN } from "@/features/initiative-8/utils/status"
import {
  CODING_SCREEN_BATCH,
  CODING_SCREEN_TIMEOUT_MS,
  getCodingCandidates,
} from "@/lib/api/i8"
import { usePaginatedRows } from "@/hooks/use-paginated-rows"
import { downloadExcel, formatCount } from "@/lib/utils"

const ALL = "all"

// Not the closed set the backend could one day return -- these are just the
// verdicts this build's prompt has ever produced. An unrecognised verdict
// value still renders fine (CODING_VERDICT_TONE falls back to "default");
// it just would not appear as a filter option until added here.
/** The absence of a judgement, not a weak one -- and what the batched screen
 *  counts to know where to resume from. */
const UNSCREENED = "UNSCREENED"

const VERDICTS = [
  "MISCODED_REPAIRABLE",
  "UNCLEAR",
  "REPAIR_SERVICE",
  "CONSUMABLE_FOR_REPAIR",
  UNSCREENED,
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
  loadError?: string | null
}

export function CodingCandidatesTable({
  candidates: initialCandidates = [],
  loadError = null,
}: CodingCandidatesTableProps = {}) {
  const [candidates, setCandidates] = useState(initialCandidates)
  const [screening, setScreening] = useState(false)
  const [screenProgress, setScreenProgress] = useState<{ done: number; total: number } | null>(null)
  const [screenError, setScreenError] = useState<string | null>(null)
  // A ref, not state: the running loop reads it between batches, and a state
  // value captured when the loop started would never see the change.
  const stopRef = useRef(false)

  const [verdict, setVerdict] = useState<string>(ALL)
  const [plant, setPlant] = useState<string>(ALL)
  // Which free text the evidence came from. FR-2 names three sources and the
  // backend reads all three, so "show me only what PR text turned up" is a
  // question the screen has to be able to answer.
  const [source, setSource] = useState<string>(ALL)
  /** Material number or any of the material's texts — see
   *  `matchesCandidateSearch`. */
  const [search, setSearch] = useState("")
  /** The New Item Price column's order; `none` is the backend's ranking. */
  const [priceSort, setPriceSort] = useState<PriceSort>("none")
  /** Materials whose evidence is open. Collapsed by default: the table is a
   *  ranked list first, and 20 expanded rows of SAP free text is not one. */
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())

  // FR-10 asks for a plant filter on every screen and this one had none.
  // Built from the rows rather than hard-coded: the plant scope is a backend
  // setting (1300 and 1500 today) and a list typed here would be a second
  // place to change it.
  const plants = useMemo(() => {
    const seen = new Set<string>()
    for (const c of candidates) for (const p of c.plants) seen.add(p)
    return [...seen].sort()
  }, [candidates])

  // The backend serves these already ranked -- corroborated first, then
  // verdict, confidence and evidence volume. The rank is taken from that
  // order and carried through filtering, so "#3" still means third most worth
  // reading, not third row on screen. Without it the ordering is invisible
  // and reads as arbitrary.
  const rankOf = useMemo(() => {
    const ranks = new Map<string, number>()
    candidates.forEach((c, i) => ranks.set(c.material.materialId, i + 1))
    return ranks
  }, [candidates])

  function toggleExpanded(materialId: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (!next.delete(materialId)) next.add(materialId)
      return next
    })
  }

  const filtered = useMemo(() => {
    return candidates.filter((c) => {
      if (verdict !== ALL && c.verdict !== verdict) return false
      if (plant !== ALL && !c.plants.includes(plant)) return false
      // Matches a candidate with ANY line from that source, rather than only
      // candidates found solely there: the question is "what did PR text turn
      // up", and a material corroborated by two sources still answers it.
      if (source !== ALL && !c.lines.some((line) => line.source === source)) return false
      if (!matchesCandidateSearch(c, search)) return false
      return true
    })
  }, [candidates, verdict, plant, source, search])

  // Sorted AFTER filtering, and only when the price column asks: the default
  // is the backend's ranking, which the `#` column keeps showing either way.
  const visible = useMemo(() => sortByNewItemPrice(filtered, priceSort), [filtered, priceSort])
  // Paged on screen only: the export and the `#` rank still cover the whole
  // list. Not reset by an AI screening batch landing -- that merges verdicts
  // into the same rows, and jumping back to page 1 mid-screen would lose
  // the reader's place.
  const { paged, page, pageSize, total, setPage } = usePaginatedRows(visible, {
    resetKey: [verdict, plant, source, search, priceSort].join("|"),
  })

  /**
   * Export what is on screen.
   *
   * The TEXT goes in the file, and so does the source it came from: a
   * cataloguer takes this to the SAP team, and "material 5000094118 reads like
   * a repairable" is not a case -- the words somebody typed on a specific
   * document are.
   *
   * In the on-screen order, so a sort by price survives into the file. The
   * price is one numeric column per plant -- built from the rows, like the
   * plant filter -- so it can be summed and sorted in Excel; a missing price
   * is an empty cell, never 0.
   */
  function exportExcel() {
    const priceOf = (c: CodingCandidate, p: string) =>
      c.newItemPrices.find((price) => price.plant === p)?.price
    downloadExcel(
      "i08-coding-candidates.xlsx",
      [
        "Material",
        "Verdict",
        "Confidence",
        "Corroborated",
        "Twin Material",
        "Plants",
        "Evidence From",
        "Lines",
        ...plants.map((p) => `New Item Price ${p} (R)`),
        "Triggering Text",
        "Reason",
        "Provider",
        "Screened At",
      ],
      visible.map((c) => [
        c.material.materialCode,
        c.verdict,
        c.confidence,
        c.isCorroborated ? "Yes" : "No",
        c.twins.map((t) => t.materialId).join(" "),
        c.plants.join(" "),
        sourcesOf(c).map((src) => SOURCE_LABEL[src]).join(" "),
        c.lines.length,
        ...plants.map((p) => priceOf(c, p)),
        c.distinctTexts.join(" | "),
        c.reason,
        c.provider,
        c.screenedAt ?? "",
      ])
    )
  }

  /** How many materials still carry no judgement -- what the button offers to
   *  work through, and what makes "All screened" an honest end state. */
  const unscreenedCount = candidates.filter((c) => c.verdict === UNSCREENED).length

  /**
   * The slow, opt-in language-judgement pass, run in batches.
   *
   * One model call per material, strictly sequential, about 5.5 seconds each
   * measured against the deployed backend on 13-Oct-2026. With 113 materials
   * in the pool that is roughly ten minutes -- and it used to be attempted as
   * ONE request, which could not work on any timeout setting: Azure App
   * Service ends a request at about 230 seconds and answers 504 itself.
   *
   * So it is split. Each call raises the limit by `CODING_SCREEN_BATCH`, and
   * because a verdict is stored against the exact text it judged, the
   * materials already done come back from storage instead of being re-bought.
   * Verified: `limit=3` took 38.8s cold, `limit=6` took 18.0s -- three served
   * from storage, three newly judged.
   *
   * Three things this does deliberately:
   *
   * **It keeps every batch.** State is updated after each one, so stopping
   * halfway -- by the button, by a failure, by closing the tab -- leaves the
   * work done so far both on screen and stored. Pressing the button again
   * resumes rather than restarting.
   *
   * **It reports a failure without discarding progress.** A batch that throws
   * sets the error and stops the loop; the batches before it stay.
   *
   * **It can be stopped.** A ten-minute operation with no way out is one
   * nobody will start twice.
   */
  async function runScreen() {
    setScreening(true)
    setScreenError(null)
    stopRef.current = false

    // A limited response carries ONLY the materials that limit covered -- ten
    // rows, not all 113 -- so each batch is MERGED into the list rather than
    // replacing it. Replacing it shrank the table to the batch while the
    // screen ran, which looked like the other candidates had been lost.
    //
    // Keyed by material and seeded from the current list, so the original
    // order holds while verdicts fill in underneath. Rows that stay put as
    // they resolve are easier to watch than rows that re-sort under the
    // cursor; the backend's ranking applies again on the next full load.
    const byMaterial = new Map(candidates.map((c) => [c.material.materialId, c]))
    const total = candidates.length
    // Resume from whatever is already judged -- an earlier run, or a
    // colleague's. Never from zero.
    let done = candidates.filter((c) => c.verdict !== UNSCREENED).length

    try {
      while (done < total) {
        if (stopRef.current) break

        const limit = Math.min(done + CODING_SCREEN_BATCH, total)
        const body = await getCodingCandidates(
          { screen: true, limit },
          { timeoutMs: CODING_SCREEN_TIMEOUT_MS },
        )

        for (const row of body.items.map(toCodingCandidate)) {
          byMaterial.set(row.material.materialId, row)
        }
        const merged = [...byMaterial.values()]
        setCandidates(merged)

        const judged = merged.filter((c) => c.verdict !== UNSCREENED).length
        // Nothing new came back. A backend that ignores `limit`, or a batch
        // the model could not judge, would otherwise spin here for ever.
        if (judged <= done) break
        done = judged
        setScreenProgress({ done, total })
      }
    } catch (error) {
      // The batches before this one are already on screen and already stored.
      // Reporting the failure must not throw them away.
      setScreenError(error instanceof Error ? error.message : String(error))
    } finally {
      setScreening(false)
      setScreenProgress(null)
      stopRef.current = false
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="outline" onClick={exportExcel}>
          Export Excel
        </Button>
        {/* Progress, not a guess. The old label said "~4 min", calibrated
            when the pool was 41 materials; it is 113 now and the estimate
            was quietly wrong by six minutes. A count of what is actually
            done cannot go stale that way. */}
        {screening ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              stopRef.current = true
            }}
          >
            {screenProgress
              ? `Stop (${formatCount(screenProgress.done)} of ${formatCount(screenProgress.total)})`
              : "Stop"}
          </Button>
        ) : (
          <Button size="sm" onClick={() => void runScreen()} disabled={unscreenedCount === 0}>
            {unscreenedCount === 0
              ? "All screened"
              : `Run AI screen (${formatCount(unscreenedCount)} left)`}
          </Button>
        )}
      </div>

      {screenError && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          The screen did not complete: {screenError}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Ranked most worth reading first: a candidate SAP itself contradicts
        (same description, coded both ways) outranks any model verdict, then
        verdict, then the model&rsquo;s own confidence, then how much text
        there is to go on.
      </p>

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

        {/* FR-2 reads PO, PR and goods-movement free text. Which one turned a
            material up changes how much the finding is worth, so it filters. */}
        <Select value={source} onValueChange={(v) => setSource(v ?? ALL)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All text sources">
              {(value: string) =>
                value === ALL
                  ? "All text sources"
                  : SOURCE_LABEL[value as CodingCandidateSource] ?? value
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All text sources</SelectItem>
            {(["PO", "PR", "MOVEMENT"] as const).map((s) => (
              <SelectItem key={s} value={s}>
                {SOURCE_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Number or name. The name of a material here is the text people
            typed on its PO and PR lines -- there is no master description. */}
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search material number or text…"
          aria-label="Search the coding candidates by material number or text"
          className="h-9 w-full sm:w-64"
        />

        <ClearFiltersButton
          activeCount={
            [
              verdict !== ALL,
              plant !== ALL,
              source !== ALL,
              search.trim() !== "",
            ].filter(Boolean).length
          }
          onClear={() => {
            setVerdict(ALL)
            setPlant(ALL)
            setSource(ALL)
            setSearch("")
          }}
        />
      </FilterBar>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No coding candidates match these filters.
        </div>
      ) : (
        <StickyScrollTable>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[48px] text-right">#</TableHead>
              <TableHead data-frozen-column>Material</TableHead>
              <TableHead>Verdict</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Flags</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Plants</TableHead>
              <TableHead>Evidence From</TableHead>
              <TableHead className="text-right">Lines</TableHead>
              <TableHead
                className="text-right"
                aria-sort={
                  priceSort === "desc" ? "descending" : priceSort === "asc" ? "ascending" : "none"
                }
              >
                {/* The one sortable column. A click goes highest first,
                    lowest first, then back to the ranking. */}
                <button
                  type="button"
                  onClick={() => setPriceSort(nextPriceSort)}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                  title={
                    priceSort === "none"
                      ? "Sort by new item price, highest first"
                      : priceSort === "desc"
                        ? "Sort by new item price, lowest first"
                        : "Back to the ranking"
                  }
                >
                  New Item Price
                  {priceSort === "desc" ? (
                    <ArrowDown className="size-3.5" aria-hidden="true" />
                  ) : priceSort === "asc" ? (
                    <ArrowUp className="size-3.5" aria-hidden="true" />
                  ) : (
                    <ArrowUpDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  )}
                </button>
              </TableHead>
              <TableHead>Screened At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((c) => (
              <Fragment key={c.material.materialId}>
              {/* The whole row opens the evidence, so the row is the control
                  and carries the aria state. The chevron column that used to
                  end each row is gone: once the row took the click it was
                  only a marker, and the other I08 tables open on a row click
                  without one. The open row's tint, and the evidence under it,
                  show which row is open. The material cell used to open the
                  Material 360 drawer instead, which on a coding
                  candidate has nothing to show: these materials are raised
                  from PO, PR and movement text, not from the shared
                  catalogue, so the drawer opened on "no catalog record". */}
              <TableRow
                tabIndex={0}
                aria-expanded={expanded.has(c.material.materialId)}
                aria-label={`${expanded.has(c.material.materialId) ? "Hide" : "Show"} the text behind ${c.material.materialCode}`}
                onClick={() => toggleExpanded(c.material.materialId)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return
                  // Space scrolls the page otherwise, and here it opens a row.
                  event.preventDefault()
                  toggleExpanded(c.material.materialId)
                }}
                className="cursor-pointer aria-expanded:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
              >
                <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                  {rankOf.get(c.material.materialId)}
                </TableCell>
                <TableCell data-frozen-column>
                  <MaterialIdentity material={c.material} />
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
                    {!c.isCorroborated && !c.isActionable && (
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
                    {sourcesOf(c).map((src) => (
                      <StatusBadge key={src} tone="default">
                        {SOURCE_LABEL[src]}
                      </StatusBadge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right text-foreground">{c.lines.length}</TableCell>
                {/* What the part costs new, per plant, from MBEW. Where it
                    came from -- or why there is none -- is on hover. */}
                <TableCell className="text-right tabular-nums">
                  <div className="flex flex-col items-end gap-0.5">
                    {newItemPriceCell(c.newItemPrices).map((line, i) => (
                      <span
                        key={line.plant ?? i}
                        title={line.title}
                        className={line.label === UNKNOWN ? "text-muted-foreground" : "text-foreground"}
                      >
                        {line.plant && (
                          <span className="mr-1.5 text-xs text-muted-foreground">{line.plant}</span>
                        )}
                        {line.label}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatScreenedAt(c.screenedAt)}
                </TableCell>
              </TableRow>
              {expanded.has(c.material.materialId) && (
                <TableRow>
                  {/* The evidence itself. Until now the only way to read the
                      text a verdict was reached on was to export the CSV,
                      which is a poor place to check a model's judgement. */}
                  <TableCell colSpan={11} className="bg-muted/30">
                    <CandidateEvidence candidate={c} />
                  </TableCell>
                </TableRow>
              )}
              </Fragment>
            ))}
          </TableBody>
        </StickyScrollTable>
      )}
      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        count={paged.length}
        noun="candidates"
        onPageChange={setPage}
      />
    </div>
  )
}

/**
 * The text a candidate's verdict was reached on, under its row.
 *
 * FR-2 is a judgement about words, so the words have to be readable next to
 * the judgement. Until this landed they existed only in the CSV export, which
 * is a poor place to check a model: by the time anyone opens it they have
 * already decided whether to trust the verdict.
 *
 * Twins come first when there are any. A twin is SAP's own counter-example —
 * an 80-series material carrying the identical description — and it is the one
 * piece of evidence here that owes nothing to a model's opinion.
 */
function CandidateEvidence({ candidate }: { candidate: CodingCandidate }) {
  return (
    <div className="flex flex-col gap-3 py-1">
      {candidate.twins.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-foreground">
            Already coded 80-series with the same text
          </h3>
          <ul className="mt-1 flex flex-col gap-1">
            {candidate.twins.map((twin) => (
              <li key={twin.materialId} className="text-xs text-muted-foreground">
                <span className="font-mono text-foreground">{twin.materialId}</span>
                {" — "}
                {twin.sharedText}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="text-xs font-medium text-foreground">
          {candidate.lines.length === 1
            ? "The line it was found on"
            : `The ${candidate.lines.length} lines it was found on`}
        </h3>
        <ul className="mt-1 flex flex-col gap-1.5">
          {candidate.lines.map((line) => (
            <li
              key={`${line.source}-${line.document}-${line.documentItem}`}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs"
            >
              <StatusBadge tone="default">{SOURCE_LABEL[line.source]}</StatusBadge>
              <span className="font-mono text-foreground">
                {line.document}
                {line.documentItem ? `/${line.documentItem}` : ""}
              </span>
              {line.plant && <span className="text-muted-foreground">{line.plant.name}</span>}
              {line.raisedAt && <span className="text-muted-foreground">{line.raisedAt}</span>}
              <span className="text-muted-foreground">{line.shortText}</span>
              {line.matchedKeywords.length > 0 && (
                <span className="text-muted-foreground">
                  (matched {line.matchedKeywords.join(", ")})
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
