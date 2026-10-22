"use client"

import { ExceptionsTable } from "@/features/initiative-8/components/exceptions-table"
import { InfoPopover } from "@/features/initiative-8/components/kit/info-popover"
import { Segmented, Tabs } from "@/features/initiative-8/components/kit/list"
import { Dot, I08Page } from "@/features/initiative-8/components/kit/page"
import { useUrlFilters } from "@/features/initiative-8/components/url-filters"
import {
  ALL_STATUSES,
  DEFAULT_EXCEPTION_STATUS,
  EXCEPTIONS_PATH,
  type ExceptionFacets,
  type ExceptionFilters,
} from "@/features/initiative-8/data/live-exceptions"
import type { ExceptionQueueRow, ExceptionQueueSummary } from "@/features/initiative-8/types/repair"
import { plural } from "@/features/initiative-8/utils/format"
import { exceptionTypeLabel } from "@/features/initiative-8/utils/status"
import { formatCount } from "@/lib/utils"

/**
 * The FR-8 checks this queue carries, in the order their tabs read.
 *
 * `UNJUSTIFIED_ACQUISITION` is deliberately not among them since 14-Oct-2026:
 * the reason for a new purchase is asked for at the reservation, by the Spares
 * Assistant (FR-5b), so it is a control rather than a queue item -- see
 * `DROPPED_TYPES` in `live-exceptions.ts`. `MISSING_SESSION_ID` gets a tab
 * only once the backend raises it.
 */
const ALL_CHECKS = ["MISSING_ATTESTATION", "OVERDUE_REPAIR", "MISSING_SESSION_ID"] as const

/** The tabs' short names; the drawer and the rows keep the full ones. */
const TAB_LABEL: Record<string, string> = {
  MISSING_ATTESTATION: "No declaration",
  OVERDUE_REPAIR: "Overdue",
  MISSING_SESSION_ID: "No assistant session",
}

/**
 * Repair Exceptions (FR-8, FR-9, FR-11) -- I08_Live_UI_Redesign_Plan.md, L5.
 *
 * Type tabs -- All, No declaration, Overdue -- with an Open / Closed / All
 * switch beside them, in place of a type dropdown, a status dropdown, a
 * summary band and a "How each check works" box above the table. All comes
 * first so the Overview's "open exceptions" card lands on the same number.
 *
 * The tab counts are the backend's `typeCounts`: every filter applied but the
 * type, so a tab's number is the rows it opens on. Without them (an older
 * backend) the tabs show no numbers rather than `meta.byType`, which counts
 * every status and would overstate each tab under Open.
 *
 * Each check's rule is written once, behind the ⓘ; each item's own sentence
 * is in its drawer.
 */
export function ExceptionsScreen({
  rows,
  total,
  page,
  pageSize,
  summary,
  facets,
  filters,
  typeCounts,
  initialItem,
  faultCategories,
}: {
  rows: ExceptionQueueRow[]
  total: number
  page: number
  pageSize: number
  summary: ExceptionQueueSummary
  facets: ExceptionFacets
  filters: ExceptionFilters
  typeCounts?: Record<string, number>
  initialItem?: ExceptionQueueRow
  faultCategories: string[]
}) {
  const { push, isPending } = useUrlFilters(EXCEPTIONS_PATH)
  /** A filter change also ends a `?id=` link, which would otherwise re-open
   *  the linked item on every change. */
  const update = (patch: Record<string, string | undefined>) => push({ ...patch, id: undefined })

  const known: readonly string[] = ALL_CHECKS
  const types = [
    ...ALL_CHECKS.filter((type) => facets.types.includes(type)),
    // A type this build has never heard of still gets a tab, and so does a
    // stale link's, so the selected tab always exists.
    ...facets.types.filter((type) => !known.includes(type)),
    ...(filters.type && !facets.types.includes(filters.type) ? [filters.type] : []),
  ]
  const countOf = (type?: string) =>
    typeCounts === undefined
      ? undefined
      : type
        ? (typeCounts[type] ?? 0)
        : Object.values(typeCounts).reduce((sum, n) => sum + n, 0)

  const running = (type: string) => summary.typesRaised.includes(type)

  return (
    <I08Page
      crumbs={[{ label: "Repairable Spares", href: "/repairable-spares" }, { label: "Repair Exceptions" }]}
      title="Repair Exceptions"
      summary={
        <>
          <span>{plural(summary.total, "item")} found by the checks</span>
          {summary.linesChecked > 0 && (
            <>
              <Dot />
              <span>
                {formatCount(summary.linesCovered)} of {plural(summary.linesChecked, "open repair line")} declared
              </span>
            </>
          )}
          <InfoPopover title="How each check works">
            {running("MISSING_ATTESTATION") && (
              <p>
                <strong className="font-semibold text-foreground">No condition declaration.</strong> A repair line with
                no declaration recorded on it, or for the same material and plant within{" "}
                {summary.attestationWindowDays} days of the line being raised.
              </p>
            )}
            {running("OVERDUE_REPAIR") && (
              <p>
                <strong className="font-semibold text-foreground">Repair overdue.</strong> A repair line SAP still has
                open, more than the grace period past the delivery date on its PO.
              </p>
            )}
            {running("MISSING_SESSION_ID") ? (
              <p>
                <strong className="font-semibold text-foreground">No assistant session.</strong> A reservation for an
                80-series part whose item text names no valid Spares Assistant session.
              </p>
            ) : (
              <p>
                Not checked yet: whether a reservation names its Spares Assistant session. SAP does not send the
                reservation item text that check needs.
              </p>
            )}
            <p>
              An item closes itself when the check stops finding it. Someone can also close it, with a note saying why.
            </p>
          </InfoPopover>
        </>
      }
    >
      <Tabs
        label="Exception type"
        value={filters.type ?? ""}
        onSelect={(value) => update({ type: value || undefined })}
        choices={[
          { value: "", label: "All", count: countOf() },
          ...types.map((type) => ({
            value: type,
            label: TAB_LABEL[type] ?? exceptionTypeLabel(type),
            count: countOf(type),
          })),
        ]}
        end={
          <Segmented
            label="Status"
            value={filters.status ?? ALL_STATUSES}
            onSelect={(value) => update({ status: value === DEFAULT_EXCEPTION_STATUS ? undefined : value })}
            choices={[
              { value: "OPEN", label: "Open" },
              { value: "CLOSED", label: "Closed" },
              { value: ALL_STATUSES, label: "All" },
            ]}
          />
        }
      />
      <ExceptionsTable
        // Keyed by the linked item, so following a second item link while
        // already here opens that item rather than keeping the last one's state.
        key={initialItem?.id ?? ""}
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        facets={facets}
        filters={filters}
        initialItem={initialItem}
        faultCategories={faultCategories}
        update={update}
        pending={isPending}
      />
    </I08Page>
  )
}
