"use client"

import { DeclarationLogTable } from "@/features/initiative-8/components/declaration-log-table"
import { InfoPopover } from "@/features/initiative-8/components/kit/info-popover"
import { Dot, I08Page } from "@/features/initiative-8/components/kit/page"
import type { DeclarationLogRow } from "@/features/initiative-8/data/live-declarations"
import { plural } from "@/features/initiative-8/utils/format"
import { formatCount } from "@/lib/utils"

/**
 * Repair Declarations (FR-4): the log of every condition declaration recorded.
 *
 * Log only since 3-Nov-2026. Declarations are made in the reservation
 * assistant, by the person taking the faulty unit out, so this screen no
 * longer declares or amends: the "To declare" and "Historical" tabs, "Declare
 * a part" and each row's Declare and Amend buttons went. A repair line with no
 * declaration shows on the register, under its "Not declared" view.
 */
export function DeclarationsScreen({ log }: { log: DeclarationLogRow[] | null }) {
  const recorded = log?.filter((row) => !row.supersededBy) ?? null
  const repairable = recorded?.filter((row) => row.condition === "Repairable").length ?? 0

  return (
    <I08Page
      crumbs={[{ label: "Repairable Spares", href: "/repairable-spares" }, { label: "Repair Declarations" }]}
      title="Repair Declarations"
      summary={
        <>
          {recorded ? (
            <span>
              {plural(recorded.length, "declaration")} recorded ({formatCount(repairable)} repairable,{" "}
              {formatCount(recorded.length - repairable)} not worth repairing)
            </span>
          ) : (
            <span>Declaration log</span>
          )}
          <Dot />
          <span className="text-muted-foreground">Made in the reservation assistant</span>
          <InfoPopover title="What a declaration is">
            <p>
              A condition declaration records what state a part was in when it came off the machine: repairable,
              beyond economical repair, or scrap, with the fault and the quantity.
            </p>
            <p>
              It is made in the reservation assistant by the person taking the faulty unit out, and recorded under
              their name. The repair it is for is linked by the R-reference typed on the repair order, or by
              material, plant and date.
            </p>
            <p>The platform records and reports declarations. It cannot block a dispatch in SAP.</p>
          </InfoPopover>
        </>
      }
    >
      {log === null ? (
        <div role="alert" className="mt-4 rounded-xl border border-i08-crit-border bg-i08-crit-tint p-5 text-sm">
          <p className="text-foreground">The declaration log could not be loaded.</p>
          <p className="mt-1 text-[13px] text-muted-foreground">This is not &ldquo;nothing recorded&rdquo;. Try again in a minute.</p>
        </div>
      ) : (
        <DeclarationLogTable rows={log} />
      )}
    </I08Page>
  )
}
