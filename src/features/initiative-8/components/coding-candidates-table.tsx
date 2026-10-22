"use client"

import { Fragment, useMemo, useRef, useState } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Flag, GitCompareArrows, Sparkles, Square } from "lucide-react"

import { StickyScrollTable } from "@/components/shared/sticky-scroll-table"
import { TablePagination } from "@/components/shared/table-pagination"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table"
import { InfoPopover } from "@/features/initiative-8/components/kit/info-popover"
import { FilterChips, MaterialCell, QuickViews, ResultsCard } from "@/features/initiative-8/components/kit/list"
import { Dot, I08Page } from "@/features/initiative-8/components/kit/page"
import { StatusDot } from "@/features/initiative-8/components/kit/status"
import { I08Cell as Cell, I08Head as Head } from "@/features/initiative-8/components/kit/table"
import { UrlSelect } from "@/features/initiative-8/components/url-filters"
import { toCodingCandidate } from "@/features/initiative-8/data/live-coding-candidates"
import type { CodingCandidate, CodingCandidateSource } from "@/features/initiative-8/types/repair"
import {
  matchesCandidateSearch,
  newItemPriceCell,
  nextPriceSort,
  sortByNewItemPrice,
  type PriceSort,
} from "@/features/initiative-8/utils/coding-candidates-view"
import { i08Date, i08DateTime, plantShort, plural } from "@/features/initiative-8/utils/format"
import { UNKNOWN } from "@/features/initiative-8/utils/status"
import { usePaginatedRows } from "@/hooks/use-paginated-rows"
import { CODING_SCREEN_BATCH, CODING_SCREEN_TIMEOUT_MS, getCodingCandidates } from "@/lib/api/i8"
import { cn, downloadExcel, formatCount } from "@/lib/utils"

/** The absence of a judgement, not a weak one -- and what the batched screen
 *  counts to know where to resume from. */
const UNSCREENED = "UNSCREENED"

/**
 * The verdicts as a reader would say them, in the order they are worth
 * reading: `short` on the quick views, `cell` in the table (every row here is
 * outside the 80-series, which the title says once), `full` in the export.
 * An unrecognised verdict still renders, as its own value, with a quick view.
 */
const VERDICTS: { value: string; short: string; cell: string; full: string }[] = [
  {
    value: "MISCODED_REPAIRABLE",
    short: "Likely repairable",
    cell: "Likely repairable",
    full: "Likely repairable, should be 80-series",
  },
  { value: "UNCLEAR", short: "Unclear", cell: "Unclear", full: "Unclear: worth a person's read" },
  {
    value: "REPAIR_SERVICE",
    short: "Repair service",
    cell: "A repair service, not a part",
    full: "A repair service, not a part",
  },
  {
    value: "CONSUMABLE_FOR_REPAIR",
    short: "Used in repairs",
    cell: "A part used in repairs",
    full: "A part used in repairs, correctly not 80-series",
  },
  { value: UNSCREENED, short: "Not screened", cell: "Not screened yet", full: "Not screened yet" },
]
const VERDICT_CELL = new Map(VERDICTS.map((v) => [v.value, v.cell]))
const VERDICT_FULL = new Map(VERDICTS.map((v) => [v.value, v.full]))

/** How a line's source reads. The raw values are shouted acronyms. */
const SOURCE_LABEL: Record<CodingCandidateSource, string> = {
  PO: "PO text",
  PR: "PR text",
  MOVEMENT: "Movement text",
}
const SOURCE_SHORT: Record<CodingCandidateSource, string> = { PO: "PO", PR: "PR", MOVEMENT: "Movement" }

/** Which sources a candidate's evidence came from, in a fixed order, so two
 *  rows with the same mix read the same way down the column. */
function sourcesOf(candidate: CodingCandidate): CodingCandidateSource[] {
  const present = new Set(candidate.lines.map((line) => line.source))
  return (["PO", "PR", "MOVEMENT"] as const).filter((s) => present.has(s))
}

export type CodingCandidatesTableProps = {
  /** Rows to render. There is no fixture data for this screen (see the page
   *  component) -- this is only ever fed live results. */
  candidates?: CodingCandidate[]
  loadError?: string | null
  /** Which free texts the run read (PO, PR, movement), for the ⓘ. */
  sources?: string[]
}

/**
 * Repair Candidates (FR-2 / W5.5) -- I08_Live_UI_Redesign_Plan.md, L6 and Q13.
 *
 * Eleven columns with up to five pills a row became eight: the verdict and
 * the confidence share a cell and say it in words ("Likely repairable, not
 * 80-series", "high confidence"), amber only for the one finding somebody acts
 * on; the Flags pills are two small icons; the reason gets two lines instead
 * of thirty characters; and the plants are named. The ranking paragraph is the
 * ⓘ on "#". "All screened" is a line under the title, not a greyed-out button,
 * and a run shows a progress bar.
 *
 * Kept as they were: Run AI screen with its batches and Stop, the New Item
 * Price column and its sort, the search, the plant and text-source filters,
 * and the row that opens on the text behind it. Read-only, as ruled on
 * 16-Oct-2026: nothing here changes SAP.
 */
export function CodingCandidatesTable({
  candidates: initialCandidates = [],
  loadError = null,
  sources = [],
}: CodingCandidatesTableProps = {}) {
  const [candidates, setCandidates] = useState(initialCandidates)
  const [screening, setScreening] = useState(false)
  const [screenProgress, setScreenProgress] = useState<{ done: number; total: number } | null>(null)
  const [screenError, setScreenError] = useState<string | null>(null)
  // A ref, not state: the running loop reads it between batches, and a state
  // value captured when the loop started would never see the change.
  const stopRef = useRef(false)

  const [verdict, setVerdict] = useState("")
  const [plant, setPlant] = useState("")
  // Which free text the evidence came from. FR-2 names three sources, so
  // "show me only what PR text turned up" is a question this has to answer.
  const [source, setSource] = useState("")
  /** Material number or any of the material's texts -- `matchesCandidateSearch`. */
  const [search, setSearch] = useState("")
  /** The New Item Price column's order; `none` is the backend's ranking. */
  const [priceSort, setPriceSort] = useState<PriceSort>("none")
  /** Materials whose evidence is open. Collapsed by default: the table is a
   *  ranked list first. */
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())

  // Built from the rows rather than hard-coded: the plant scope is a backend
  // setting, and a list typed here would be a second place to change it.
  const plantNames = useMemo(() => {
    const names = new Map<string, string>()
    for (const c of candidates) {
      for (const p of c.plants) if (!names.has(p)) names.set(p, p)
      for (const line of c.lines) if (line.plant?.name) names.set(line.plant.plantId, line.plant.name)
    }
    return names
  }, [candidates])
  const plants = useMemo(() => [...plantNames.keys()].sort(), [plantNames])

  // The backend serves these ranked -- corroborated first, then verdict,
  // confidence and evidence volume. The rank is carried through filtering, so
  // "#3" still means third most worth reading, not third row on screen.
  const rankOf = useMemo(() => {
    const ranks = new Map<string, number>()
    candidates.forEach((c, i) => ranks.set(c.material.materialId, i + 1))
    return ranks
  }, [candidates])

  const verdictCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of candidates) counts.set(c.verdict, (counts.get(c.verdict) ?? 0) + 1)
    return counts
  }, [candidates])

  function toggleExpanded(materialId: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (!next.delete(materialId)) next.add(materialId)
      return next
    })
  }

  const filtered = useMemo(
    () =>
      candidates.filter((c) => {
        if (verdict && c.verdict !== verdict) return false
        if (plant && !c.plants.includes(plant)) return false
        // ANY line from that source: "what did PR text turn up" is still
        // answered by a material that PO text corroborates.
        if (source && !c.lines.some((line) => line.source === source)) return false
        return matchesCandidateSearch(c, search)
      }),
    [candidates, verdict, plant, source, search],
  )

  // Sorted AFTER filtering, and only when the price column asks: the default
  // is the backend's ranking, which "#" keeps showing either way.
  const visible = useMemo(() => sortByNewItemPrice(filtered, priceSort), [filtered, priceSort])
  // Not reset by an AI batch landing -- that merges verdicts into the same
  // rows, and jumping back to page 1 mid-screen would lose the reader's place.
  const { paged, page, pageSize, total, setPage } = usePaginatedRows(visible, {
    resetKey: [verdict, plant, source, search, priceSort].join("|"),
  })

  /**
   * Export what is on screen, in its order: the TEXT and the source it came
   * from go in the file, because "this reads like a repairable" is not a case
   * for the SAP team -- the words somebody typed on a document are. The price
   * is one numeric column per plant; a missing one is an empty cell, never 0.
   */
  function exportExcel() {
    const priceOf = (c: CodingCandidate, p: string) => c.newItemPrices.find((price) => price.plant === p)?.price
    void downloadExcel(
      "i08-coding-candidates.xlsx",
      [
        "Rank",
        "Material",
        "Verdict",
        "Confidence",
        "Twin Material",
        "Plants",
        "Evidence From",
        "Lines",
        ...plants.map((p) => `New Item Price ${p} (R)`),
        "Triggering Text",
        "Reason",
        "Screened At",
      ],
      visible.map((c) => [
        rankOf.get(c.material.materialId) ?? "",
        c.material.materialCode,
        VERDICT_FULL.get(c.verdict) ?? c.verdict,
        c.confidence ?? "",
        c.twins.map((t) => t.materialId).join(" "),
        c.plants.map((p) => plantNames.get(p) ?? p).join(", "),
        sourcesOf(c)
          .map((src) => SOURCE_LABEL[src])
          .join(", "),
        c.lines.length,
        ...plants.map((p) => priceOf(c, p)),
        c.distinctTexts.join(" | "),
        c.reason,
        c.screenedAt ? i08DateTime(c.screenedAt) : "",
      ]),
    )
  }

  /** Still without a judgement: what Run AI screen offers to work through. */
  const unscreenedCount = candidates.filter((c) => c.verdict === UNSCREENED).length
  const lastRun = candidates.reduce<string | undefined>(
    (latest, c) => (c.screenedAt && (!latest || c.screenedAt > latest) ? c.screenedAt : latest),
    undefined,
  )

  /**
   * The slow, opt-in language-judgement pass, run in batches.
   *
   * One model call per material, about 5.5 seconds each; one request for all
   * of them would outlive Azure App Service's ~230-second limit. So each call
   * raises the limit by `CODING_SCREEN_BATCH`, and the materials already done
   * come back from storage. Every batch is kept: stopping -- by the button, a
   * failure or closing the tab -- leaves the work so far on screen and stored,
   * and the next run resumes rather than restarts.
   */
  async function runScreen() {
    setScreening(true)
    setScreenError(null)
    stopRef.current = false

    // A limited response carries ONLY the materials that limit covered, so
    // each batch is MERGED into the list, keyed by material, in the current
    // order: rows that stay put as they resolve are easier to watch.
    const byMaterial = new Map(candidates.map((c) => [c.material.materialId, c]))
    const totalCount = candidates.length
    let done = candidates.filter((c) => c.verdict !== UNSCREENED).length
    setScreenProgress({ done, total: totalCount })

    try {
      while (done < totalCount) {
        if (stopRef.current) break
        const limit = Math.min(done + CODING_SCREEN_BATCH, totalCount)
        const body = await getCodingCandidates({ screen: true, limit }, { timeoutMs: CODING_SCREEN_TIMEOUT_MS })
        for (const row of body.items.map(toCodingCandidate)) byMaterial.set(row.material.materialId, row)
        const merged = [...byMaterial.values()]
        setCandidates(merged)

        const judged = merged.filter((c) => c.verdict !== UNSCREENED).length
        // Nothing new came back: a backend ignoring `limit`, or a batch the
        // model could not judge, would otherwise spin here for ever.
        if (judged <= done) break
        done = judged
        setScreenProgress({ done, total: totalCount })
      }
    } catch (error) {
      // The batches before this one are on screen and stored already.
      setScreenError(error instanceof Error ? error.message : String(error))
    } finally {
      setScreening(false)
      setScreenProgress(null)
      stopRef.current = false
    }
  }

  const crumbs = [{ label: "Repairable Spares", href: "/repairable-spares" }, { label: "Repair Candidates" }]

  if (loadError) {
    return (
      <I08Page crumbs={crumbs} title="Repair Candidates">
        <div role="alert" className="mt-6 rounded-xl border border-i08-crit-border bg-i08-crit-tint p-5">
          <p className="text-sm text-foreground">The repair candidates could not be loaded.</p>
          <p className="mt-1 text-[13px] text-muted-foreground">{loadError}</p>
          <p className="mt-3 text-[13px] text-muted-foreground">
            This is not &ldquo;no candidates found&rdquo;: it is a failed request. Try again in a minute.
          </p>
        </div>
      </I08Page>
    )
  }

  const chips = [
    search.trim() && { key: "q", label: `Search: “${search.trim()}”` },
    plant && { key: "plant", label: `Plant: ${plantNames.get(plant) ?? plant}` },
    source && { key: "source", label: `Found in: ${SOURCE_LABEL[source as CodingCandidateSource] ?? source}` },
  ].filter((chip): chip is { key: string; label: string } => Boolean(chip))
  const remove = (key: string) => {
    if (key === "q") setSearch("")
    if (key === "plant") setPlant("")
    if (key === "source") setSource("")
  }
  const clearAll = () => {
    setSearch("")
    setPlant("")
    setSource("")
  }
  const sourceWords = sources.length
    ? sources.map((s) => SOURCE_SHORT[s as CodingCandidateSource] ?? s).join(" or ")
    : "PO or PR"
  const extraVerdicts = [...verdictCounts.keys()].filter((v) => !VERDICT_CELL.has(v))

  return (
    <I08Page
      crumbs={crumbs}
      title="Repair Candidates"
      summary={
        <>
          <span>
            {plural(candidates.length, "material")} not coded 80-series whose {sourceWords} text mentions repair
          </span>
          <Dot />
          <span>
            {unscreenedCount === 0
              ? `All screened by the AI${lastRun ? `, last run ${i08Date(lastRun)}` : ""}`
              : `${formatCount(unscreenedCount)} not screened yet`}
          </span>
          <InfoPopover title="About this list">
            <p>
              Materials bought under an ordinary number whose requisition, PO or goods-movement text talks about
              repair: a repairable spare that should carry an 80-series number and may not.
            </p>
            <p>
              An AI reads each one&rsquo;s text and gives a verdict. A twin is stronger evidence than any verdict: an
              80-series material in SAP with the very same text.
            </p>
            <p>Advisory only. Nothing here changes SAP.</p>
          </InfoPopover>
        </>
      }
      actions={
        unscreenedCount > 0 && !screening ? (
          <Button size="lg" className="px-3.5" onClick={() => void runScreen()}>
            <Sparkles className="size-4" />
            Run AI screen ({formatCount(unscreenedCount)} left)
          </Button>
        ) : undefined
      }
    >
      {/* Progress, not a guess: a count of what is done cannot go stale the
          way the old "~4 min" label did when the pool grew. */}
      {screening && (
        <div className="i08-settle mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card px-4 py-3">
          <span className="text-[13.5px] text-foreground">
            Screening with the AI
            {screenProgress && (
              <span className="text-muted-foreground">
                {" "}
                · {formatCount(screenProgress.done)} of {formatCount(screenProgress.total)} done
              </span>
            )}
          </span>
          <div
            role="progressbar"
            aria-label="AI screening progress"
            aria-valuemin={0}
            aria-valuemax={screenProgress?.total ?? 0}
            aria-valuenow={screenProgress?.done ?? 0}
            className="h-1.5 min-w-40 flex-1 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{
                width: `${screenProgress && screenProgress.total ? (screenProgress.done / screenProgress.total) * 100 : 0}%`,
              }}
            />
          </div>
          <Button
            size="lg"
            variant="outline"
            onClick={() => {
              stopRef.current = true
            }}
          >
            <Square className="size-3.5" />
            Stop after this batch
          </Button>
        </div>
      )}

      {screenError && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-i08-crit-border bg-i08-crit-tint px-4 py-3 text-[13.5px] text-foreground"
        >
          The screen stopped before the end: {screenError} What was screened before it is kept; run it again to carry
          on.
        </div>
      )}

      <QuickViews
        label="Verdicts"
        value={verdict}
        onSelect={setVerdict}
        choices={[
          { value: "", label: "All", count: candidates.length },
          ...VERDICTS.filter((v) => (verdictCounts.get(v.value) ?? 0) > 0 || v.value === verdict).map((v) => ({
            value: v.value,
            label: v.short,
            count: verdictCounts.get(v.value) ?? 0,
          })),
          ...extraVerdicts.map((v) => ({ value: v, label: v, count: verdictCounts.get(v) ?? 0 })),
        ]}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {/* Number or name. The name of a material here is the text people
            typed on its PO and PR lines -- there is no master description. */}
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search material number or text"
          aria-label="Search the repair candidates by material number or text"
          className="h-9 w-full bg-background sm:w-72"
        />
        <UrlSelect
          value={plant}
          onChange={setPlant}
          allLabel="All plants"
          options={plants.map((p) => ({ value: p, label: plantShort(plantNames.get(p) ?? p) }))}
          className="sm:w-44"
        />
        {/* Which document the words were found on changes what a finding is
            worth: one seen only on a requisition is earlier, and cheaper. */}
        <UrlSelect
          value={source}
          onChange={setSource}
          allLabel="Any text"
          options={(["PO", "PR", "MOVEMENT"] as const).map((s) => ({ value: s, label: `Found in ${SOURCE_LABEL[s]}` }))}
          className="sm:w-48"
        />
        <Button
          size="lg"
          variant="outline"
          className="px-3.5 sm:ml-auto"
          onClick={exportExcel}
          disabled={visible.length === 0}
        >
          <Download className="size-4" />
          Export Excel
        </Button>
      </div>

      <FilterChips chips={chips} onRemove={remove} onClear={clearAll} />

      <ResultsCard>
        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <p className="text-[15px] font-semibold text-foreground">
              {candidates.length === 0 ? "No candidates found" : "No candidates match"}
            </p>
            <p className="max-w-md text-[13.5px] text-muted-foreground">
              {candidates.length === 0
                ? "No PO or PR text mentions repair on a material outside the 80-series."
                : "Change or clear the filters to see more."}
            </p>
            {candidates.length > 0 && (chips.length > 0 || verdict) && (
              <Button
                variant="outline"
                size="lg"
                className="mt-1"
                onClick={() => {
                  clearAll()
                  setVerdict("")
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <>
            <StickyScrollTable tableClassName="table-fixed min-w-[1000px]">
              <colgroup>
                {[4, 21, 15, 5, 28, 9, 8, 10].map((width, index) => (
                  <col key={index} style={{ width: `${width}%` }} />
                ))}
              </colgroup>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Head right>
                    <span className="inline-flex items-center gap-0.5">
                      #
                      <InfoPopover title="How the list is ranked" className="size-6">
                        <p>Most worth reading first:</p>
                        <ol className="list-decimal space-y-1 pl-5">
                          <li>a twin: SAP itself has the same text on an 80-series material;</li>
                          <li>then the verdict, likely repairable first;</li>
                          <li>then the AI&rsquo;s confidence;</li>
                          <li>then how much text there is to go on.</li>
                        </ol>
                        <p>Sorting by New Item Price reorders the rows; # keeps the rank.</p>
                      </InfoPopover>
                    </span>
                  </Head>
                  <Head frozen>Material</Head>
                  <Head>Verdict</Head>
                  <Head>
                    <span className="sr-only">Signals</span>
                  </Head>
                  <Head>Reason</Head>
                  <Head>Plants</Head>
                  <Head>Found in</Head>
                  <Head right sort={priceSort === "desc" ? "descending" : priceSort === "asc" ? "ascending" : "none"}>
                    {/* The one sortable column: highest first, lowest first,
                        then back to the ranking. */}
                    <button
                      type="button"
                      onClick={() => setPriceSort(nextPriceSort)}
                      className="inline-flex items-center gap-1 rounded-sm hover:text-foreground"
                      title={
                        priceSort === "none"
                          ? "Sort by new item price, highest first"
                          : priceSort === "desc"
                            ? "Sort by new item price, lowest first"
                            : "Back to the ranking"
                      }
                    >
                      New item price
                      {priceSort === "desc" ? (
                        <ArrowDown className="size-3.5" aria-hidden="true" />
                      ) : priceSort === "asc" ? (
                        <ArrowUp className="size-3.5" aria-hidden="true" />
                      ) : (
                        <ArrowUpDown className="size-3.5" aria-hidden="true" />
                      )}
                    </button>
                  </Head>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((c) => {
                  const open = expanded.has(c.material.materialId)
                  return (
                    <Fragment key={c.material.materialId}>
                      {/* The whole row opens the text behind it. The material
                          used to open Material 360, which has nothing for these:
                          they come from PO and PR text, not the catalogue. */}
                      <TableRow
                        data-i08-row
                        tabIndex={0}
                        aria-expanded={open}
                        aria-label={`${open ? "Hide" : "Show"} the text behind ${c.material.materialCode}`}
                        onClick={() => toggleExpanded(c.material.materialId)}
                        onKeyDown={(event) => {
                          if (event.target !== event.currentTarget) return
                          if (event.key !== "Enter" && event.key !== " ") return
                          event.preventDefault()
                          toggleExpanded(c.material.materialId)
                        }}
                        className={cn(
                          "cursor-pointer align-top focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                          open && "bg-accent/50",
                        )}
                      >
                        <Cell right className="text-[13px] text-muted-foreground">
                          {rankOf.get(c.material.materialId)}
                        </Cell>
                        <Cell frozen>
                          <MaterialCell code={c.material.materialCode} description={c.material.description} />
                        </Cell>
                        <Cell wrap>
                          <div className="flex flex-col gap-0.5 leading-snug">
                            {c.verdict === "MISCODED_REPAIRABLE" ? (
                              <StatusDot tone="warn" wrap>
                                <span title={VERDICT_FULL.get(c.verdict)}>{VERDICT_CELL.get(c.verdict)}</span>
                              </StatusDot>
                            ) : (
                              <span
                                className={cn(
                                  "text-[13.5px]",
                                  c.verdict === UNSCREENED ? "text-muted-foreground" : "text-foreground",
                                )}
                              >
                                {VERDICT_CELL.get(c.verdict) ?? c.verdict}
                              </span>
                            )}
                            {c.confidence && (
                              <span
                                className={cn(
                                  "text-[12.5px] text-muted-foreground",
                                  c.verdict === "MISCODED_REPAIRABLE" && "pl-3.5",
                                )}
                              >
                                {c.confidence} confidence
                              </span>
                            )}
                          </div>
                        </Cell>
                        <Cell>
                          <div className="flex items-center gap-1.5 pt-0.5">
                            {c.isCorroborated && (
                              <span
                                title={`Twin found: ${c.twins.map((t) => t.materialId).join(", ")} is coded 80-series with the same text`}
                                className="text-i08-good-ink"
                              >
                                <GitCompareArrows className="size-4" aria-hidden="true" />
                                <span className="sr-only">Twin found</span>
                              </span>
                            )}
                            {c.isActionable && (
                              <span title="Worth a person's read: likely repairable, or the AI could not tell" className="text-i08-warn-ink">
                                <Flag className="size-4" aria-hidden="true" />
                                <span className="sr-only">Actionable</span>
                              </span>
                            )}
                          </div>
                        </Cell>
                        <Cell wrap>
                          <p className="line-clamp-2 text-[13.5px] text-muted-foreground" title={c.reason}>
                            {c.reason || "—"}
                          </p>
                        </Cell>
                        <Cell wrap>
                          {c.plants.length > 0 ? (
                            c.plants.map((p) => plantShort(plantNames.get(p) ?? p)).join(", ")
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </Cell>
                        <Cell>
                          <div className="flex flex-col leading-snug">
                            <span>
                              {sourcesOf(c)
                                .map((src) => SOURCE_SHORT[src])
                                .join(", ")}
                            </span>
                            <span className="text-[12.5px] text-muted-foreground">{plural(c.lines.length, "line")}</span>
                          </div>
                        </Cell>
                        {/* What the part costs new, per plant, from MBEW. Where
                            it came from -- or why there is none -- is on hover. */}
                        <Cell right>
                          <div className="flex flex-col items-end gap-0.5">
                            {newItemPriceCell(c.newItemPrices).map((line, i) => (
                              <span
                                key={line.plant ?? i}
                                title={line.title}
                                className={line.label === UNKNOWN ? "text-muted-foreground" : "text-foreground"}
                              >
                                {line.plant && (
                                  <span className="mr-1.5 text-[12px] text-muted-foreground">{line.plant}</span>
                                )}
                                {line.label}
                              </span>
                            ))}
                          </div>
                        </Cell>
                      </TableRow>
                      {open && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={8} className="bg-accent/30 px-4 py-3 whitespace-normal">
                            <CandidateEvidence candidate={c} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })}
              </TableBody>
            </StickyScrollTable>
            <div className="border-t border-border px-4 py-2.5">
              <TablePagination
                page={page}
                pageSize={pageSize}
                total={total}
                count={paged.length}
                noun="candidates"
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </ResultsCard>
    </I08Page>
  )
}

/**
 * The text a candidate's verdict was reached on, under its row.
 *
 * FR-2 is a judgement about words, so the words have to be readable next to
 * the judgement. Twins come first when there are any: SAP's own counter-example,
 * the one piece of evidence here that owes nothing to a model.
 */
function CandidateEvidence({ candidate }: { candidate: CodingCandidate }) {
  return (
    <div className="i08-settle flex max-w-[1100px] flex-col gap-3.5 text-[13.5px]">
      {candidate.reason && (
        <div>
          <h3 className="text-[12.5px] font-semibold text-foreground">Why the AI says so</h3>
          <p className="mt-0.5 text-muted-foreground">{candidate.reason}</p>
        </div>
      )}

      {candidate.twins.length > 0 && (
        <div>
          <h3 className="text-[12.5px] font-semibold text-foreground">Already coded 80-series with the same text</h3>
          <ul className="mt-0.5 flex flex-col gap-0.5">
            {candidate.twins.map((twin) => (
              <li key={twin.materialId} className="text-muted-foreground">
                <span className="font-mono text-foreground">{twin.materialId}</span> {twin.sharedText}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="text-[12.5px] font-semibold text-foreground">
          {candidate.lines.length === 1
            ? "The line it was found on"
            : `The ${formatCount(candidate.lines.length)} lines it was found on`}
        </h3>
        <ul className="mt-1 flex flex-col gap-1">
          {candidate.lines.map((line) => (
            <li
              key={`${line.source}-${line.document}-${line.documentItem}`}
              className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5"
            >
              <span className="w-24 shrink-0 text-[12.5px] text-muted-foreground">{SOURCE_LABEL[line.source]}</span>
              <span className="font-mono text-foreground">
                {line.document}
                {line.documentItem ? `/${line.documentItem}` : ""}
              </span>
              {line.plant && <span className="text-muted-foreground">{plantShort(line.plant.name)}</span>}
              {line.raisedAt && <span className="text-muted-foreground">{line.raisedAt}</span>}
              <span className="text-foreground">{line.shortText}</span>
              {line.matchedKeywords.length > 0 && (
                <span className="text-[12.5px] text-muted-foreground">matched “{line.matchedKeywords.join("”, “")}”</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {candidate.screenedAt && (
        <p className="text-[12.5px] text-muted-foreground">Screened {i08DateTime(candidate.screenedAt)}</p>
      )}
    </div>
  )
}
