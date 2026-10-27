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
 * The FR-8 checks this queue carries, in the order their tabs read. Each gets
 * a tab only once the backend runs it.
 *
 * `UNJUSTIFIED_ACQUISITION` is back since 27-Oct-2026. It was left out from
 * 14-Oct because it never fired (it dated a purchase from a PO-line date the
 * live data does not carry); the backend now checks the new-buy purchase
 * request, so it finds real work. See the header of `live-exceptions.ts`.
 */
const ALL_CHECKS = [
  "MISSING_ATTESTATION",
  "REPAIR_PR_NOT_DECLARED",
  "REPAIRED_AGAINST_ASSESSMENT",
  "DECLARED_NO_REPAIR_PR",
  "OVERDUE_REPAIR",
  "UNJUSTIFIED_ACQUISITION",
  "MISSING_SESSION_ID",
] as const

/** The tabs' short names; the drawer and the rows keep the full ones. */
const TAB_LABEL: Record<string, string> = {
  MISSING_ATTESTATION: "No declaration",
  OVERDUE_REPAIR: "Overdue",
  UNJUSTIFIED_ACQUISITION: "Bought new",
  MISSING_SESSION_ID: "No R-reference",
  REPAIR_PR_NOT_DECLARED: "PR not declared",
  REPAIRED_AGAINST_ASSESSMENT: "Against assessment",
  DECLARED_NO_REPAIR_PR: "No repair PR",
}

/**
 * Repair Exceptions (FR-8, FR-9, FR-11) -- I08_Live_UI_Redesign_Plan.md, L5.
 *
 * Type tabs -- All, No declaration, Overdue, Bought new -- with an Open / Closed / All
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
            {running("REPAIR_PR_NOT_DECLARED") && (
              <p>
                <strong className="font-semibold text-foreground">Repair PR not declared.</strong> A repair requested
                on a purchase requisition, open longer than the grace period, with no condition declaration for it.
              </p>
            )}
            {running("REPAIRED_AGAINST_ASSESSMENT") && (
              <p>
                <strong className="font-semibold text-foreground">Repaired against the assessment.</strong> A unit
                declared beyond economical repair or scrap was sent for repair anyway.
              </p>
            )}
            {running("DECLARED_NO_REPAIR_PR") && (
              <p>
                <strong className="font-semibold text-foreground">Declared, no repair PR yet.</strong> A unit declared
                repairable longer ago than the grace period, with no repair requested for the same part and plant
                since.
              </p>
            )}
            {running("OVERDUE_REPAIR") && (
              <p>
                <strong className="font-semibold text-foreground">Repair overdue.</strong> A repair line SAP still has
                open, more than the grace period past the delivery date on its PO.
              </p>
            )}
            {running("UNJUSTIFIED_ACQUISITION") && (
              <p>
                <strong className="font-semibold text-foreground">Bought new while a repair was open.</strong> A new
                unit of a part was requested (or ordered directly) while a repair of the same part at the same plant
                was still open, and no reason for buying new was recorded
                {summary.justificationWindowDays ? ` within ${plural(summary.justificationWindowDays, "day")}` : ""}.
              </p>
            )}
            {running("MISSING_SESSION_ID") ? (
              <p>
                <strong className="font-semibold text-foreground">Reservation with no R-reference.</strong> A
                reservation for an 80-series part whose item text carries no valid Spares Assistant R-reference, or
                carries one that is mistyped.
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
