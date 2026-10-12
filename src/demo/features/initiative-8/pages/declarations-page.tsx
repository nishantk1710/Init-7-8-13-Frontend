"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ClipboardCheck } from "lucide-react"

import { KPIStatCard } from "@demo/components/shared/kpi-stat-card"
import { MaterialIdentity } from "@demo/components/shared/material-identity"
import { PageHeader } from "@demo/components/shared/page-header"
import { StatusBadge } from "@demo/components/shared/status-badge"
import { Button } from "@demo/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@demo/components/ui/table"
import {
  DeclarationFormDialog,
  type DeclarationFormTarget,
} from "@demo/features/initiative-8/components/declaration-form-dialog"
import { DeclarationLogTable } from "@demo/features/initiative-8/components/declaration-log-table"
import { DeclarePartButton } from "@demo/features/initiative-8/components/declare-part-button"
import { ATTESTATION_CUTOVER, REFERENCE_DATE } from "@demo/features/initiative-8/data/config"
import { summarise } from "@demo/features/initiative-8/model/metrics"
import { useI08Snapshot } from "@demo/features/initiative-8/state/snapshot-store"
import type { RepairChain } from "@demo/features/initiative-8/types/repair"
import { instantOf } from "@demo/features/initiative-8/utils/dates"
import { summariseDeclarations } from "@demo/features/initiative-8/utils/declaration-log"
import { REPAIR_STATUS_TONE, UNKNOWN } from "@demo/features/initiative-8/utils/status"
import { useMaterial360 } from "@demo/lib/material-360-context"
import { formatCount } from "@demo/lib/utils"
import { SessionChangesBanner } from "@demo/features/initiative-8/components/session-changes-banner"

const DESCRIPTION =
  "Condition-to-repair declarations (FR-4). A part is assessed when it comes off the machine, before it is sent for repair — including parts judged Beyond Economical Repair or Scrap, which may never get a repair PO."

/** The repair detail page for a line. */
function lineHref(id: string): string {
  return `/repairable-spares/repair-register/${encodeURIComponent(id)}`
}

function targetOf(line: RepairChain): DeclarationFormTarget {
  return {
    lineId: line.id,
    materialId: line.material.materialId,
    plantId: line.plant.plantId,
    label: `${line.id}: ${line.material.materialId} — ${line.material.description} at ${line.plant.name}, ${formatCount(line.quantity)} unit(s) with ${line.vendor} (${line.repairStatus}).`,
    defaultQuantity: line.quantity,
    sessionId: line.sessionId,
  }
}

/**
 * The Declarations screen (FR-4), Snapshot.
 *
 * Starts from the part, as the FRS asks — "Declare a part" needs no repair
 * line — and keeps the other half of the control beside it: the repair lines
 * that went out with nothing declared, each with a button to declare it now.
 *
 *   owed      repair lines whose Declaration status reads Required
 *   record    every declaration, with where it stands against the register,
 *             amendable (a new record that supersedes it) while it is in force
 *
 * A declaration made here goes into this browser session's Snapshot, so the
 * register, the exception queue and the overview read it at once. Nothing is
 * posted to SAP or the backend.
 */
export function DeclarationsPage() {
  const snapshot = useI08Snapshot()

  const linesById = useMemo(() => new Map(snapshot.lines.map((l) => [l.id, l])), [snapshot.lines])
  const summary = summariseDeclarations(snapshot.declarations, linesById)
  const compliance = summarise(snapshot).declarationCompliance

  // Raised since the control went live first — those are the real misses —
  // then newest first.
  const owed = snapshot.lines
    .filter((l) => l.declarationStatus === "Required")
    .sort(
      (a, b) => Number(a.preAutomation) - Number(b.preAutomation) || instantOf(b.raisedAt) - instantOf(a.raisedAt),
    )
  const owedSinceCutover = owed.filter((l) => !l.preAutomation).length
  const flaggedLines = snapshot.lines.filter((l) => l.declarationStatus === "Flagged").length

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-[1920px] flex-col gap-4">
        <PageHeader
          title="Declarations"
          description={`${DESCRIPTION} As at ${REFERENCE_DATE}.`}
          actions={<DeclarePartButton />}
        />
        <SessionChangesBanner />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KPIStatCard
            label="Declarations recorded"
            value={formatCount(summary.current)}
            hint={
              summary.amended > 0 ? `in force · ${formatCount(summary.amended)} amended, kept as history` : "in force"
            }
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
            value={formatCount(flaggedLines)}
            trend={flaggedLines > 0 ? "down" : "flat"}
            trendLabel={flaggedLines > 0 ? "Flagged" : undefined}
            hint="repair lines assessed not repairable, repair raised"
          />
          <KPIStatCard
            label="Repair lines undeclared"
            value={formatCount(owed.length)}
            trend={owedSinceCutover > 0 ? "down" : "flat"}
            trendLabel={owedSinceCutover > 0 ? "Required" : undefined}
            hint={`${formatCount(owedSinceCutover)} raised since the control went live`}
          />
        </div>

        <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            Declaration compliance {compliance.percent === undefined ? UNKNOWN : `${compliance.percent}%`}
          </span>{" "}
          — {formatCount(compliance.count)} of {formatCount(compliance.total)} repair lines raised since{" "}
          {ATTESTATION_CUTOVER} carry a declaration. Declarations are linked to their repair line and assistant
          session explicitly; nothing is matched by date.
        </p>

        <section className="flex flex-col gap-3">
          <SectionTitle
            title="Repair lines still owed a declaration"
            note={`Repair lines whose Declaration status reads Required. Lines raised before ${ATTESTATION_CUTOVER} predate the control — nobody could have declared them — but can still be covered now.`}
          />
          <OwedLinesTable lines={owed} />
        </section>

        <section className="flex flex-col gap-3">
          <SectionTitle
            title="Declaration log"
            note="Every declaration ever recorded, newest first. Locked once recorded: an amendment is a new record that supersedes the old one, which stays listed, unchanged."
          />
          <DeclarationLogTable records={snapshot.declarations} lines={snapshot.lines} />
        </section>
      </div>
    </div>
  )
}

function SectionTitle({ title, note }: { title: string; note: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
    </div>
  )
}

/**
 * The repair lines with no declaration, compact: enough to find the part and
 * declare it from here. Declaring a line covers it at once — it leaves this
 * list, reads Completed (or Flagged) in the register, and its
 * missing-attestation exception resolves itself with the reason.
 */
function OwedLinesTable({ lines }: { lines: RepairChain[] }) {
  const { openMaterial360 } = useMaterial360()
  const [target, setTarget] = useState<DeclarationFormTarget | undefined>(undefined)
  // A fresh form for every opening — see DeclarationFormDialog.
  const [formKey, setFormKey] = useState(0)

  if (lines.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
        <ClipboardCheck className="size-4" />
        Every repair line carries a declaration.
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Repair Line</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Plant</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Repair Status</TableHead>
              <TableHead>Raised</TableHead>
              <TableHead />
              <TableHead className="text-right">
                <span className="sr-only">Action</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell>
                  <Link
                    href={lineHref(line.id)}
                    className="text-xs font-medium whitespace-nowrap text-foreground hover:underline"
                    title={line.declarationNextAction}
                  >
                    {line.id}
                  </Link>
                </TableCell>
                <TableCell>
                  <MaterialIdentity material={line.material} onOpen={openMaterial360} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{line.plant.name}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{line.vendor}</TableCell>
                <TableCell>
                  <StatusBadge tone={REPAIR_STATUS_TONE[line.repairStatus]}>{line.repairStatus}</StatusBadge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{line.raisedAt}</TableCell>
                <TableCell>
                  {line.preAutomation && (
                    <span
                      title={`Raised before the declaration control went live on ${ATTESTATION_CUTOVER} — nobody could have declared it then.`}
                    >
                      <StatusBadge tone="default">Pre-automation</StatusBadge>
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => {
                      setFormKey((k) => k + 1)
                      setTarget(targetOf(line))
                    }}
                  >
                    Declare condition
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {target && (
        <DeclarationFormDialog key={formKey} open target={target} onClose={() => setTarget(undefined)} />
      )}
    </>
  )
}
