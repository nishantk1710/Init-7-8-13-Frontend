"use client"

import Link from "next/link"
import { useState } from "react"
import { Download, Loader2 } from "lucide-react"

import { StickyScrollTable } from "@/components/shared/sticky-scroll-table"
import { TablePagination } from "@/components/shared/table-pagination"
import { Button } from "@/components/ui/button"
import { TableBody, TableHeader, TableRow } from "@/components/ui/table"
import { InfoPopover } from "@/features/initiative-8/components/kit/info-popover"
import { FilterChips, MaterialCell, ResultsCard } from "@/features/initiative-8/components/kit/list"
import { Dot, I08Page } from "@/features/initiative-8/components/kit/page"
import { Actor } from "@/features/initiative-8/components/kit/status"
import { I08Cell as Cell, I08Head as Head } from "@/features/initiative-8/components/kit/table"
import { UrlSearchInput, UrlSelect, useUrlFilters, withSelected } from "@/features/initiative-8/components/url-filters"
import {
  fetchAllJustifications,
  JUSTIFICATIONS_PATH,
  justificationsHref,
  type JustificationFacets,
  type JustificationFilters,
} from "@/features/initiative-8/data/live-justifications"
import { actorLabel, i08DateTime, plural, reasonLabel } from "@/features/initiative-8/utils/format"
import type { ApiJustification } from "@/lib/api/assistant"
import { sapPlantName } from "@/lib/shared-data/sap-plants"
import { downloadExcel, formatCount } from "@/lib/utils"

const EXPORT_FILENAME = "i08-new-acquisition-justifications.xlsx"

/**
 * Justifications (FR-7) -- I08_Live_UI_Redesign_Plan.md, L7, Q3 and Q12.
 *
 * A table, like every other I08 screen: when, the material with its
 * description, plant, the reason in words, the note, who recorded it, and the
 * session as a link to its trace. It was a stack of cards showing the bare
 * material number, "@ plant", upper-case reasons, a placeholder author spelled
 * out on every card and a session id that went nowhere -- under one lone tile
 * whose count now sits in the summary line.
 *
 * One server page at a time: the filters write the URL and the server renders
 * the page for it (`url-filters.tsx`). The descriptions are looked up for the
 * page on screen by the route, best-effort -- see `loadMaterialDescriptions`.
 *
 * Its own component rather than the shared one I13 renders: I13's log merges
 * two sources in the browser, so it cannot page on the server. An audit view
 * only: nothing is changed from here.
 */
export function I08JustificationLog({
  items,
  total,
  overall,
  page,
  pageSize,
  filters,
  facets,
  descriptions = {},
}: {
  items: ApiJustification[]
  /** Matching the filters. */
  total: number
  /** Every I08 justification on record. */
  overall: number
  page: number
  pageSize: number
  filters: JustificationFilters
  facets: JustificationFacets
  /** Material descriptions for the page, by material number. */
  descriptions?: Record<string, string>
}) {
  const { push, isPending } = useUrlFilters(JUSTIFICATIONS_PATH)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  /** Every match, not the page on screen -- see `fetchAllJustifications`. */
  async function exportExcel() {
    setExporting(true)
    setExportError(null)
    try {
      const rows = await fetchAllJustifications(filters)
      const built = await downloadExcel(
        EXPORT_FILENAME,
        ["Recorded At", "Material", "Plant", "Reason", "Note", "Recorded By", "Session", "Exception"],
        rows.map((entry) => [
          i08DateTime(entry.recordedAt, ""),
          entry.materialId,
          sapPlantName(entry.plant),
          reasonLabel(entry.reasonCategory),
          entry.freeText,
          actorLabel(entry.author),
          entry.sessionId ?? "",
          entry.exceptionId ?? "",
        ]),
      )
      if (!built) setExportError("The Excel file could not be built.")
    } catch (error) {
      setExportError(error instanceof Error ? error.message : String(error))
    } finally {
      setExporting(false)
    }
  }

  const chips = [
    filters.q && { key: "q", label: `Search: “${filters.q}”` },
    filters.plant && { key: "plant", label: `Plant: ${sapPlantName(filters.plant)}` },
    filters.reason && { key: "reason", label: `Reason: ${reasonLabel(filters.reason)}` },
  ].filter((chip): chip is { key: string; label: string } => Boolean(chip))
  const clearAll = () => push({ q: undefined, plant: undefined, reason: undefined })

  return (
    <I08Page
      crumbs={[{ label: "Repairable Spares", href: "/repairable-spares" }, { label: "Justifications" }]}
      title="Justifications"
      summary={
        <>
          <span>
            {plural(overall, "reason")} recorded for buying a new unit while a repairable one existed
          </span>
          {chips.length > 0 && (
            <>
              <Dot />
              <span>{formatCount(total)} match the filters</span>
            </>
          )}
          <InfoPopover title="About this log">
            <p>
              When someone chooses to buy a new unit although a repairable one exists, the Spares Assistant asks them
              why, at the reservation. Each answer is recorded here, with the session it was given in.
            </p>
            <p>
              These are the purchases the repair advice did not avoid, so the log is how anyone finds out whether the
              advice is landing. An audit view only: nothing is changed from here.
            </p>
          </InfoPopover>
        </>
      }
    >
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <UrlSearchInput
          value={filters.q ?? ""}
          onCommit={(value) => push({ q: value })}
          placeholder="Search material, note, person or session"
          ariaLabel="Search justifications"
          className="w-full sm:w-80"
        />
        <UrlSelect
          value={filters.plant ?? ""}
          onChange={(value) => push({ plant: value })}
          allLabel="All plants"
          options={withSelected(facets.plants, filters.plant).map((p) => ({ value: p, label: sapPlantName(p) }))}
          className="sm:w-44"
        />
        <UrlSelect
          value={filters.reason ?? ""}
          onChange={(value) => push({ reason: value })}
          allLabel="All reasons"
          options={withSelected(facets.reasonCategories, filters.reason).map((r) => ({
            value: r,
            label: reasonLabel(r),
          }))}
          className="sm:w-56"
        />
        <div className="flex items-center gap-2 sm:ml-auto">
          {exportError && (
            <span role="alert" className="text-[12.5px] text-i08-crit-ink">
              Export failed: {exportError}
            </span>
          )}
          <Button
            size="lg"
            variant="outline"
            className="px-3.5"
            onClick={() => void exportExcel()}
            disabled={exporting || total === 0}
          >
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Export Excel
          </Button>
        </div>
      </div>

      <FilterChips chips={chips} onRemove={(key) => push({ [key]: undefined })} onClear={clearAll} />

      <ResultsCard pending={isPending}>
        {total === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <p className="text-[15px] font-semibold text-foreground">
              {overall === 0 ? "No justifications recorded yet" : "No justifications match"}
            </p>
            <p className="max-w-md text-[13.5px] text-muted-foreground">
              {overall === 0
                ? "Nobody has yet bought a new unit while a repairable one existed. When someone does, the Spares Assistant asks them why, and the answer appears here."
                : `All ${formatCount(overall)} recorded justifications are filtered out.`}
            </p>
            {overall > 0 && (
              <Button variant="outline" size="lg" className="mt-1" onClick={clearAll}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <>
            <StickyScrollTable tableClassName="table-fixed min-w-[960px]">
              <colgroup>
                {[15, 21, 12, 14, 16, 11, 11].map((width, index) => (
                  <col key={index} style={{ width: `${width}%` }} />
                ))}
              </colgroup>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Head>Recorded</Head>
                  <Head frozen>Material</Head>
                  <Head>Plant</Head>
                  <Head>Reason</Head>
                  <Head>Note</Head>
                  <Head>By</Head>
                  <Head>Session</Head>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((entry) => (
                  <TableRow key={entry.id} data-i08-row className="align-top">
                    <Cell className="tabular-nums">{i08DateTime(entry.recordedAt)}</Cell>
                    <Cell frozen>
                      <MaterialCell code={entry.materialId} description={descriptions[entry.materialId]} />
                    </Cell>
                    <Cell wrap>{sapPlantName(entry.plant)}</Cell>
                    <Cell wrap>{reasonLabel(entry.reasonCategory)}</Cell>
                    <Cell wrap>
                      {/* The part a person actually reads when this is reviewed. */}
                      <p className="line-clamp-2 text-muted-foreground" title={entry.freeText}>
                        {entry.freeText || "—"}
                      </p>
                    </Cell>
                    <Cell>
                      <span className="block truncate" title={actorLabel(entry.author)}>
                        <Actor actor={entry.author} />
                      </span>
                    </Cell>
                    <Cell>
                      {entry.sessionId ? (
                        <Link
                          href={`/assistant/sessions/${encodeURIComponent(entry.sessionId)}`}
                          className="font-mono text-[13px] text-i08-link hover:underline"
                          title="Open the assistant session this was recorded in"
                        >
                          {entry.sessionId}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {entry.exceptionId && (
                        <span className="mt-0.5 block truncate font-mono text-[12px] text-muted-foreground" title={entry.exceptionId}>
                          {entry.exceptionId}
                        </span>
                      )}
                    </Cell>
                  </TableRow>
                ))}
              </TableBody>
            </StickyScrollTable>
            <div className="border-t border-border px-4 py-2.5">
              <TablePagination
                page={page}
                pageSize={pageSize}
                total={total}
                count={items.length}
                noun="justifications"
                hrefFor={(p) => justificationsHref(filters, p)}
              />
            </div>
          </>
        )}
      </ResultsCard>
    </I08Page>
  )
}
