"use client"

import { useState, type ReactNode } from "react"
import { Clock, FileWarning, Fingerprint, ShoppingCart } from "lucide-react"

import { AlertBanner } from "@demo/components/shared/alert-banner"
import { KPIStatCard } from "@demo/components/shared/kpi-stat-card"
import { PageHeader } from "@demo/components/shared/page-header"
import { ExceptionDetailDrawer } from "@demo/features/initiative-8/components/exception-detail-drawer"
import { ACTIVE_STATUSES, ExceptionQueueTable } from "@demo/features/initiative-8/components/exception-queue-table"
import {
  ASSISTANT_CUTOVER,
  ATTESTATION_CUTOVER,
  OVERDUE_GRACE_DAYS,
  REFERENCE_DATE,
} from "@demo/features/initiative-8/data/config"
import { ALL } from "@demo/features/initiative-8/model/metrics"
import { useI08Snapshot } from "@demo/features/initiative-8/state/snapshot-store"
import type { ExceptionType, RepairException } from "@demo/features/initiative-8/types/repair"
import { EXCEPTION_TYPES, exceptionTypeLabel, isOpenException } from "@demo/features/initiative-8/utils/status"
import { formatCount } from "@demo/lib/utils"
import { SessionChangesBanner } from "@demo/features/initiative-8/components/session-changes-banner"

const DESCRIPTION =
  "Every finding the four FRS checks raise — repairs overdue, repair lines with no condition " +
  "declaration, 80-series reservations with no valid session ID, and new units bought while a " +
  "repairable one existed. Each is a stored item with an owner, a status and a history."

const KPI: Record<ExceptionType, { label: string; icon: ReactNode }> = {
  OVERDUE_REPAIR: { label: "Overdue repairs", icon: <Clock className="size-3.5" /> },
  MISSING_ATTESTATION: { label: "Missing attestations", icon: <FileWarning className="size-3.5" /> },
  MISSING_SESSION_ID: { label: "Missing session IDs", icon: <Fingerprint className="size-3.5" /> },
  UNJUSTIFIED_ACQUISITION: { label: "Unjustified acquisitions", icon: <ShoppingCart className="size-3.5" /> },
}

/** How each check decides, in a sentence — so a reader can check a finding. */
const HOW_IT_WORKS: Record<ExceptionType, string> = {
  OVERDUE_REPAIR: `A repair PO line past its EKET delivery date plus the ${OVERDUE_GRACE_DAYS}-day grace, with units still at the vendor.`,
  MISSING_ATTESTATION: `A repair PR or PO with no condition declaration linked to it. The control is live from ${ATTESTATION_CUTOVER}; earlier lines are marked as raised before Spares Automation.`,
  MISSING_SESSION_ID:
    "An 80-series reservation whose item text (SGTXT) carries no valid Spares Assistant session ID for that part — blank, an ID nobody issued, or another part's session.",
  UNJUSTIFIED_ACQUISITION: `A new unit bought while stock, an open repair, or a unit at a vendor with no repair PO existed (FR-6), and no justification names the purchase. The assistant is live from ${ASSISTANT_CUTOVER}.`,
}

/**
 * The Exception Queue (FR-8, FR-9, FR-11): the four checks' findings as
 * worked items. A check finds an item from the data; people own it, comment
 * on it and move it through Open, In progress, Resolved and Closed; and when
 * the data changes so the check stops finding it, the queue resolves it
 * itself and records why.
 *
 * `initialId` (`?id=`) opens one item; `initialRepair` (`?repair=`) narrows
 * the table to one repair line — the links other screens use to land here.
 */
export function ExceptionQueuePage({
  initialId,
  initialRepair,
}: {
  initialId?: string
  initialRepair?: string
}) {
  const snapshot = useI08Snapshot()
  const exceptions = snapshot.exceptions

  // Only the id is held: the item itself is re-read from the snapshot every
  // render, so the drawer and the row show each action as it is recorded.
  const [selectedId, setSelectedId] = useState<string | undefined>(initialId)
  const [drawerOpen, setDrawerOpen] = useState(initialId !== undefined)

  const linked = initialId ? exceptions.find((e) => e.id === initialId) : undefined
  // A linked item that is no longer open would sit behind the default
  // "Open + In progress" filter; so would a repair line's resolved items.
  const initialStatus = (linked && !isOpenException(linked)) || initialRepair ? ALL : ACTIVE_STATUSES

  function openItem(id: string) {
    setSelectedId(id)
    setDrawerOpen(true)
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-[1920px] flex-col gap-4">
        <PageHeader title="Exception Queue" description={DESCRIPTION} />
        <SessionChangesBanner />

        {initialId && !linked && (
          <AlertBanner tone="warning" title={`No exception ${initialId} in the Snapshot`}>
            The link names an item none of the four checks has raised. The full queue is below.
          </AlertBanner>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {EXCEPTION_TYPES.map((type) => (
            <TypeCard key={type} type={type} exceptions={exceptions} />
          ))}
        </div>

        <StatusSummary exceptions={exceptions} />
        <HowChecksWork />

        <ExceptionQueueTable
          exceptions={exceptions}
          initialRepair={initialRepair}
          initialStatus={initialStatus}
          selectedId={drawerOpen ? selectedId : undefined}
          onOpen={openItem}
        />
      </div>

      <ExceptionDetailDrawer exceptionId={selectedId} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  )
}

/** One check's open items, with how many it has raised and how many were dealt with. */
function TypeCard({ type, exceptions }: { type: ExceptionType; exceptions: RepairException[] }) {
  const ofType = exceptions.filter((e) => e.type === type)
  const open = ofType.filter(isOpenException).length
  const resolved = ofType.filter((e) => e.status === "RESOLVED" || e.status === "CLOSED").length
  return (
    <KPIStatCard
      label={KPI[type].label}
      icon={KPI[type].icon}
      value={formatCount(open)}
      hint={`${formatCount(ofType.length)} raised · ${formatCount(resolved)} resolved`}
    />
  )
}

/** The headline numbers, always together: the total, by status, and the pre-automation share. */
function StatusSummary({ exceptions }: { exceptions: RepairException[] }) {
  const count = (status: RepairException["status"]) => exceptions.filter((e) => e.status === status).length
  const preAutomation = exceptions.filter((e) => e.preAutomation).length
  return (
    <p className="text-sm text-muted-foreground">
      <strong className="text-foreground">{formatCount(exceptions.length)}</strong> items:{" "}
      <strong className="text-foreground">{formatCount(count("OPEN"))}</strong> open,{" "}
      <strong className="text-foreground">{formatCount(count("IN_PROGRESS"))}</strong> in progress,{" "}
      <strong className="text-foreground">{formatCount(count("RESOLVED"))}</strong> resolved,{" "}
      <strong className="text-foreground">{formatCount(count("CLOSED"))}</strong> closed ·{" "}
      <strong className="text-foreground">{formatCount(preAutomation)}</strong> raised before Spares Automation, as
      at {REFERENCE_DATE}.
    </p>
  )
}

function HowChecksWork() {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <h2 className="text-xs font-medium text-foreground">How each check works</h2>
      <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2 xl:grid-cols-4">
        {EXCEPTION_TYPES.map((type) => (
          <div key={type}>
            <dt className="text-xs font-medium text-foreground">{exceptionTypeLabel(type)}</dt>
            <dd className="mt-0.5 text-xs text-muted-foreground">{HOW_IT_WORKS[type]}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">
        Items are found by the checks, never typed in. When the data changes so a check stops finding an item, the
        item resolves itself and its history says why — recording the declaration resolves a missing attestation, a
        justification naming the purchase resolves an unjustified acquisition, and the goods receipt resolves an
        overdue repair.
      </p>
    </div>
  )
}
