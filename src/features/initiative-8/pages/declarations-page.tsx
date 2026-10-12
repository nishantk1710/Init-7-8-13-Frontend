import { connection } from "next/server"
import type { ReactNode } from "react"

import { KPIStatCard } from "@/components/shared/kpi-stat-card"
import { PageHeader } from "@/components/shared/page-header"
import { DeclarationLogTable } from "@/features/initiative-8/components/declaration-log-table"
import { DeclarePartButton } from "@/features/initiative-8/components/declare-part-button"
import {
  loadLiveDeclarationLog,
  type LiveDeclarationLog,
} from "@/features/initiative-8/data/live-declaration-log"
import { summariseDeclarations } from "@/features/initiative-8/utils/declaration-log"
import { UNKNOWN } from "@/features/initiative-8/utils/status"
import { PLANTS } from "@/lib/shared-data/plants"
import { formatCount } from "@/lib/utils"

const DESCRIPTION =
  "Condition-to-repair declarations (FR-4). A part is assessed when it comes off the machine, before it is sent for repair — including parts judged Beyond Economical Repair or Scrap, which never get a repair PO."

/** The two in-scope plants, by SAP code — the codes the backend accepts. */
const PLANT_OPTIONS = PLANTS.map((p) => ({ plantId: p.sapPlantCode, name: p.name }))

/**
 * The Declarations screen (FR-4) — live.
 *
 * Its own screen again, and a different one from the Declaration Queue that
 * was folded into the register on 08-Oct-2026. That queue listed repair PO
 * lines, so a part could only be declared once its PO existed — after the
 * point the FRS asks for. This one starts from the part:
 *
 *   capture   "Declare a part" — material and plant, no repair line needed
 *   record    every declaration, with where it stands against the register
 *
 * The register keeps the other half of the control: each repair line's
 * Declaration status (Required / Completed / Flagged) is the check that a
 * part did not go out undeclared.
 */
export async function DeclarationsPage() {
  // Not statically prerendered: every declaration recorded changes it.
  await connection()

  // The try/catch wraps ONLY the fetch -- see the note on the register page.
  let live: LiveDeclarationLog | null = null
  let loadError: string | null = null
  try {
    live = await loadLiveDeclarationLog()
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }

  if (live === null) {
    return (
      <Shell>
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center text-sm"
        >
          <p className="font-medium text-foreground">The declarations could not be loaded.</p>
          <p className="mt-1 text-muted-foreground">{loadError}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            This is not an empty list — it is a failed request. Check that the backend is
            running and that NEXT_PUBLIC_API_BASE_URL points at it.
          </p>
        </div>
      </Shell>
    )
  }

  const { records, faultCategories, repairLines } = live
  const summary = summariseDeclarations(records)
  const amended = records.length - summary.current
  const undeclaredLines = repairLines ? (repairLines.byStatus.Required ?? 0) : undefined

  return (
    <Shell
      actions={
        <DeclarePartButton faultCategories={faultCategories} plantOptions={PLANT_OPTIONS} />
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KPIStatCard
          label="Declarations recorded"
          value={formatCount(summary.current)}
          hint={amended > 0 ? `${formatCount(amended)} amended, kept as history` : "in force"}
        />
        <KPIStatCard
          label="Repairable"
          value={formatCount(summary.repairable)}
          hint={`${formatCount(summary.awaitingPo)} awaiting a repair PO`}
        />
        <KPIStatCard
          label="Not worth repairing"
          value={formatCount(summary.notRepairable)}
          hint={`Beyond Economical Repair or Scrap · ${formatCount(summary.notForRepair)} not sent`}
        />
        <KPIStatCard
          label="Sent for repair anyway"
          value={formatCount(summary.sentAnyway)}
          trend={summary.sentAnyway > 0 ? "down" : "flat"}
          trendLabel={summary.sentAnyway > 0 ? "Flagged" : undefined}
          hint="assessed not repairable, repair PO raised"
        />
        {/* The other half of the control, from the register: repair lines that
            went out with no declaration to match. */}
        <KPIStatCard
          label="Repair lines undeclared"
          value={undeclaredLines === undefined ? UNKNOWN : formatCount(undeclaredLines)}
          hint={
            undeclaredLines === undefined
              ? "Could not be loaded"
              : "Declaration status Required in the register"
          }
        />
      </div>

      {repairLines && (
        <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          A repair PO line is matched to a declaration for the same material and plant recorded
          within {repairLines.attestationWindowDays} days of the line&apos;s creation date. A
          declaration the register has not matched reads “Awaiting repair PO” here until one is
          raised.
        </p>
      )}

      <DeclarationLogTable records={records} plantOptions={PLANT_OPTIONS} />
    </Shell>
  )
}

function Shell({ actions, children }: { actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-[1920px] flex-col gap-4">
        <PageHeader title="Declarations" description={DESCRIPTION} actions={actions} />
        {children}
      </div>
    </div>
  )
}
