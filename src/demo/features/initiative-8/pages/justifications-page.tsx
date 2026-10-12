"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { EmptyState } from "@demo/components/shared/empty-state"
import { KPIStatCard } from "@demo/components/shared/kpi-stat-card"
import { MaterialIdentity } from "@demo/components/shared/material-identity"
import { PageHeader } from "@demo/components/shared/page-header"
import { SAPDocumentChip } from "@demo/components/shared/sap-document-chip"
import { buttonVariants } from "@demo/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@demo/components/ui/table"
import { JustificationLog } from "@demo/features/initiative-8/components/justification-log"
import { REFERENCE_DATE } from "@demo/features/initiative-8/data/config"
import { summarise } from "@demo/features/initiative-8/model/metrics"
import type { SessionRow } from "@demo/features/initiative-8/model/snapshot"
import { useI08Snapshot } from "@demo/features/initiative-8/state/snapshot-store"
import type { SessionOutcome } from "@demo/features/initiative-8/types/repair"
import {
  SESSION_OUTCOME_LABEL,
  UNKNOWN,
  isOpenException,
} from "@demo/features/initiative-8/utils/status"
import { useMaterial360 } from "@demo/lib/material-360-context"
import { formatCount, formatZAR, formatZARCompact } from "@demo/lib/utils"
import { SessionChangesBanner } from "@demo/features/initiative-8/components/session-changes-banner"

const DESCRIPTION =
  "Why a new unit was bought while a repairable one existed — on the shelf, out for repair, or at a vendor without a repair PO. Captured at reservation time by the Spares Assistant, or when the exception was chased (FR-7)."

/** The outcomes that are not a purchase avoided, in the order the note reads them. */
const OTHER_OUTCOMES: SessionOutcome[] = ["BOUGHT_NEW", "NO_REPAIRABLE_UNIT", "ABANDONED"]

const LINK_CLASS = "font-medium text-primary underline-offset-2 hover:underline"

/**
 * The justification log (FR-7) on a screen of its own, with the other half of
 * benefit attribution (FRS §8) beside it.
 *
 * The FRS counts a saving only where the requester chose repair after the
 * assistant's advice, so the two sections read together: purchases avoided
 * are the advice landing, and every justification is a case where it did not
 * and somebody said why. Everything here reads this session's snapshot, so a
 * reason recorded on the Exception Queue shows up here at once.
 */
export function JustificationsPage() {
  const snapshot = useI08Snapshot()
  const metrics = summarise(snapshot)
  const justifications = snapshot.justifications

  const atReservation = justifications.filter((j) => j.source === "ASSISTANT").length
  const chased = justifications.length - atReservation
  const withSession = justifications.filter((j) => j.sessionId).length
  const traceable =
    justifications.length > 0 ? Math.round((withSession / justifications.length) * 100) : undefined
  const unjustified = snapshot.exceptions.filter(
    (e) => e.type === "UNJUSTIFIED_ACQUISITION" && isOpenException(e)
  ).length
  const compliance = metrics.justificationCompliance

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader title="Justifications" description={`${DESCRIPTION} As at ${REFERENCE_DATE}.`} />
        <SessionChangesBanner />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <KPIStatCard
            label="Justifications recorded"
            value={formatCount(justifications.length)}
            hint={`${formatCount(atReservation)} at reservation time · ${formatCount(chased)} chasing an exception`}
          />
          <KPIStatCard
            label="Linked to a session"
            value={formatCount(withSession)}
            hint={
              traceable === undefined
                ? "no justifications recorded yet"
                : `${traceable}% of justifications traceable to the advice given`
            }
          />
          <KPIStatCard
            label="Purchases still unjustified"
            value={formatCount(unjustified)}
            trend={unjustified > 0 ? "down" : "flat"}
            trendLabel={unjustified > 0 ? "Open" : undefined}
            hint="on the Exception Queue"
          />
          <KPIStatCard
            label="Justification compliance"
            value={compliance.percent === undefined ? UNKNOWN : `${compliance.percent}%`}
            hint={`${formatCount(compliance.count)} of ${formatCount(compliance.total)} purchases made while a repairable unit existed`}
          />
          <KPIStatCard
            label="Purchases avoided"
            value={formatZARCompact(metrics.avoided.value)}
            hint={`${formatCount(metrics.avoided.sessions)} sessions chose repair after the advice`}
          />
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">
            A new unit bought while one was on the shelf, out for repair or at a vendor, with no
            reason recorded, is raised on the Exception Queue as an unjustified acquisition. Recording
            the reason there closes it and adds it here.
          </p>
          <Link
            href="/repairable-spares/exceptions"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Open exception queue
            <ChevronRight className="size-3.5" />
          </Link>
        </div>

        <section className="flex flex-col gap-3">
          <SectionTitle
            title="Justification log"
            note="Every reason recorded for buying new against the advice, newest first."
          />
          <JustificationLog justifications={justifications} purchases={snapshot.purchases} />
        </section>

        <section className="flex flex-col gap-3">
          <SectionTitle
            title="Advice taken — purchases avoided"
            note="The FRS counts a saving only where the requester chose repair after the Spares Assistant's advice: the unit's value times the quantity they would otherwise have bought."
          />
          <AvoidedPurchases sessions={snapshot.sessions} />
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
 * The sessions where the advice was taken, each with the reservation and the
 * repair line it led to, and what buying new would have cost. The other
 * outcomes are counted underneath so the reader sees the whole denominator,
 * not only the wins.
 */
function AvoidedPurchases({ sessions }: { sessions: SessionRow[] }) {
  const { openMaterial360 } = useMaterial360()
  const chose = sessions.filter((s) => s.outcome === "CHOSE_REPAIR")
  const totalUnits = chose.reduce((sum, s) => sum + s.quantity, 0)
  const totalValue = chose.reduce((sum, s) => sum + s.avoidedValue, 0)
  const others = OTHER_OUTCOMES.map(
    (outcome) =>
      `${SESSION_OUTCOME_LABEL[outcome]}: ${formatCount(sessions.filter((s) => s.outcome === outcome).length)}`
  ).join(" · ")

  return (
    <div className="flex flex-col gap-2">
      {chose.length === 0 ? (
        <EmptyState
          title="No session has ended in a repair yet."
          description="A purchase is counted as avoided only when the requester chose repair after the assistant's advice."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Plant</TableHead>
                <TableHead>Requester</TableHead>
                <TableHead>Opened</TableHead>
                <TableHead>Reservation</TableHead>
                <TableHead>Repair Line</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="text-right">Avoided Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chose.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs text-foreground">{s.id}</TableCell>
                  <TableCell>
                    <MaterialIdentity material={s.material} onOpen={openMaterial360} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.plant.name}</TableCell>
                  <TableCell className="text-muted-foreground">{s.requester}</TableCell>
                  <TableCell className="text-muted-foreground">{s.openedAt}</TableCell>
                  <TableCell>
                    {s.reservation ? (
                      <SAPDocumentChip doc={s.reservation} />
                    ) : (
                      <span className="text-xs text-muted-foreground">{UNKNOWN}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {s.repairId ? (
                      <Link href={`/repairable-spares/repair-register/${s.repairId}`} className={LINK_CLASS}>
                        {s.repairId}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">{UNKNOWN}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCount(s.quantity)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-foreground">
                    {formatZAR(s.avoidedValue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={7} className="text-foreground">
                  {formatCount(chose.length)} session{chose.length === 1 ? "" : "s"} chose repair
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(totalUnits)}</TableCell>
                <TableCell className="text-right tabular-nums text-foreground">
                  {formatZAR(totalValue)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Other session outcomes, not counted as savings — {others}.
      </p>
    </div>
  )
}
