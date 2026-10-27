"use client"

import { DeclarationLogTable } from "@/features/initiative-8/components/declaration-log-table"
import { DeclarationsTable } from "@/features/initiative-8/components/declarations-table"
import { DeclarePartButton } from "@/features/initiative-8/components/declare-part-button"
import { InfoPopover } from "@/features/initiative-8/components/kit/info-popover"
import { Tabs } from "@/features/initiative-8/components/kit/list"
import { Dot, I08Page } from "@/features/initiative-8/components/kit/page"
import { useUrlFilters } from "@/features/initiative-8/components/url-filters"
import {
  DECLARATIONS_PATH,
  type DeclarationFacets,
  type DeclarationFilters,
  type DeclarationLogRow,
} from "@/features/initiative-8/data/live-declarations"
import type { DeclarationQueueRow, DeclarationQueueSummary } from "@/features/initiative-8/types/repair"
import { waitingCount } from "@/features/initiative-8/utils/declaration"
import { plural } from "@/features/initiative-8/utils/format"
import { formatCount } from "@/lib/utils"

/**
 * Repair Declarations (FR-4) -- I08_Live_UI_Redesign_Plan.md, L4 and Q6.
 *
 * Two tabs: "To declare", the repair lines still owed a condition declaration,
 * and "Declaration log", every declaration recorded. The log was four screens
 * down, under 25 queue rows and a pager, with a second filter bar of its own.
 *
 * One summary line replaces the four tiles and the grey band under them, which
 * repeated the same count. What a declaration is, and that the platform cannot
 * block a dispatch, is behind the ⓘ.
 */
export function DeclarationsScreen({
  tab,
  rows,
  total,
  page,
  pageSize,
  summary,
  facets,
  filters,
  faultCategories,
  log,
}: {
  tab: "queue" | "log"
  rows: DeclarationQueueRow[]
  total: number
  page: number
  pageSize: number
  summary: DeclarationQueueSummary
  facets: DeclarationFacets
  filters: DeclarationFilters
  faultCategories: string[]
  /** Null when the log could not be read -- said so, never shown as empty. */
  log: DeclarationLogRow[] | null
}) {
  const { push, isPending } = useUrlFilters(DECLARATIONS_PATH)
  const recorded = log?.filter((row) => !row.supersededBy) ?? null
  const repairable = recorded?.filter((row) => row.condition === "Repairable").length ?? 0

  return (
    <I08Page
      crumbs={[{ label: "Repairable Spares", href: "/repairable-spares" }, { label: "Repair Declarations" }]}
      title="Repair Declarations"
      summary={
        <>
          <span>{plural(waitingCount(summary), "repair line")} waiting for a condition declaration</span>
          {recorded && (
            <>
              <Dot />
              <span>
                {plural(recorded.length, "declaration")} recorded ({formatCount(repairable)} repairable,{" "}
                {formatCount(recorded.length - repairable)} not worth repairing)
              </span>
            </>
          )}
          <InfoPopover title="What a declaration is">
            <p>
              A condition declaration records what state a part was in before it went for repair: repairable, beyond
              economical repair, or scrap.
            </p>
            <p>
              Declared from a repair line, it covers that line. Declared for a part with no repair line, it covers
              the same material at the same plant within {summary.attestationWindowDays} days.
            </p>
            <p>The platform records and reports declarations. It cannot block a dispatch in SAP.</p>
          </InfoPopover>
        </>
      }
      actions={
        facets.plants.length > 0 ? (
          <DeclarePartButton plantOptions={facets.plants} faultCategories={faultCategories} />
        ) : undefined
      }
    >
      <Tabs
        label="Declarations"
        value={tab}
        onSelect={(value) => push({ tab: value === "log" ? "log" : undefined })}
        choices={[
          { value: "queue", label: "To declare", count: summary.outstanding },
          { value: "log", label: "Declaration log", count: log?.length },
        ]}
      />
      {tab === "queue" ? (
        <DeclarationsTable
          rows={rows}
          total={total}
          page={page}
          pageSize={pageSize}
          facets={facets}
          filters={filters}
          faultCategories={faultCategories}
          push={push}
          pending={isPending}
        />
      ) : log === null ? (
        <div role="alert" className="mt-4 rounded-xl border border-i08-crit-border bg-i08-crit-tint p-5 text-sm">
          <p className="text-foreground">The declaration log could not be loaded.</p>
          <p className="mt-1 text-[13px] text-muted-foreground">This is not &ldquo;nothing recorded&rdquo;. Try again in a minute.</p>
        </div>
      ) : (
        <DeclarationLogTable rows={log} faultCategories={faultCategories} />
      )}
    </I08Page>
  )
}
