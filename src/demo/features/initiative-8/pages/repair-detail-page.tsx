"use client"

import Link from "next/link"
import { useState, type ReactNode } from "react"
import {
  ArrowLeft,
  Bot,
  ClipboardCheck,
  FileText,
  ReceiptText,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react"

import { AlertBanner } from "@demo/components/shared/alert-banner"
import { EmptyState } from "@demo/components/shared/empty-state"
import { MaterialIdentity } from "@demo/components/shared/material-identity"
import { PageHeader } from "@demo/components/shared/page-header"
import { SAPDocumentChip } from "@demo/components/shared/sap-document-chip"
import { StatusBadge } from "@demo/components/shared/status-badge"
import { Timeline, type TimelineEvent } from "@demo/components/shared/timeline"
import { Button } from "@demo/components/ui/button"
import {
  DeclarationFormDialog,
  type DeclarationFormTarget,
} from "@demo/features/initiative-8/components/declaration-form-dialog"
import {
  ASSISTANT_CUTOVER,
  ATTESTATION_CUTOVER,
  OVERDUE_GRACE_DAYS,
  REFERENCE_DATE,
} from "@demo/features/initiative-8/data/config"
import { isOpenLine } from "@demo/features/initiative-8/model/metrics"
import { isTerminalStage } from "@demo/features/initiative-8/model/rules"
import type { I8Snapshot } from "@demo/features/initiative-8/model/snapshot"
import { useI08Snapshot } from "@demo/features/initiative-8/state/snapshot-store"
import type { RepairChain, StageStep } from "@demo/features/initiative-8/types/repair"
import { dayOf, labelOfDay } from "@demo/features/initiative-8/utils/dates"
import {
  CRITICALITY_TONE,
  DECLARATION_CONDITION_TONE,
  DECLARATION_STATUS_TONE,
  EXCEPTION_STATUS_LABEL,
  EXCEPTION_STATUS_TONE,
  JUSTIFICATION_CELL_LABEL,
  JUSTIFICATION_CELL_NOTE,
  JUSTIFICATION_CELL_TONE,
  OVERDUE_STATUS_LABEL,
  OVERDUE_STATUS_TONE,
  REPAIR_STATUS_TONE,
  SESSION_LINK_LABEL,
  SESSION_LINK_TONE,
  SESSION_OUTCOME_LABEL,
  STAGE_LABEL,
  UNKNOWN,
  codeLabel,
  exceptionTypeLabel,
  isPartiallyReceived,
  justificationCellOf,
} from "@demo/features/initiative-8/utils/status"
import { useMaterial360 } from "@demo/lib/material-360-context"
import { cn, formatZAR } from "@demo/lib/utils"
import { SessionChangesBanner } from "@demo/features/initiative-8/components/session-changes-banner"

const REGISTER_HREF = "/repairable-spares/repair-register"
const DECLARATIONS_HREF = "/repairable-spares/declarations"
const JUSTIFICATIONS_HREF = "/repairable-spares/justifications"

function exceptionHref(exceptionId: string): string {
  return `/repairable-spares/exceptions?id=${encodeURIComponent(exceptionId)}`
}

/** "1 day", "12 days". */
function daysLabel(days: number): string {
  return days === 1 ? "1 day" : `${days} days`
}

/** The last day of the grace after the expected return; undefined with no date. */
function graceEndOf(line: RepairChain): string | undefined {
  const due = dayOf(line.expectedReturn)
  return due === undefined ? undefined : labelOfDay(due + OVERDUE_GRACE_DAYS)
}

// ---------------------------------------------------------------------------
// Lifecycle (FR-3, FR-9)
// ---------------------------------------------------------------------------

/**
 * Each dated stage the line has reached, oldest first, with the days it spent
 * there — FR-9's aging per stage, not just per line. A terminal stage takes
 * its own colour even when it is the current one: "back in stock" is the good
 * ending, "scrapped" the bad one, and neither is waiting on anybody.
 */
function stageTone(step: StageStep): TimelineEvent["tone"] {
  if (step.stage === "SCRAPPED") return "danger"
  if (step.stage === "BACK_IN_STOCK") return "success"
  if (step.current) return "warning"
  if (step.stage === "RETURNED") return "success"
  return "default"
}

function stageDescription(step: StageStep): string {
  let text: string
  if (isTerminalStage(step.stage)) {
    text =
      step.stage === "SCRAPPED"
        ? "The vendor found it not worth repairing; the repair line was cancelled."
        : "Back on the shelf (MARD); the line is closed."
  } else if (step.current) {
    text = `${daysLabel(step.days)} in this stage so far.`
  } else {
    text = `${daysLabel(step.days)} in this stage.`
  }
  return step.note ? `${text} ${step.note}.` : text
}

function buildLifecycle(line: RepairChain): TimelineEvent[] {
  const events: TimelineEvent[] = line.stages.map((step) => ({
    id: step.stage,
    label: step.current && !isTerminalStage(step.stage) ? `${STAGE_LABEL[step.stage]} (now)` : STAGE_LABEL[step.stage],
    timestamp: step.at,
    description: stageDescription(step),
    tone: stageTone(step),
  }))
  // The date the unit is owed back, after the steps reached so far — the
  // promise FR-9's overdue check measures against.
  if (isOpenLine(line) && line.expectedReturn) {
    const graceEnd = graceEndOf(line)
    events.push({
      id: "due",
      label: "Due back from vendor (EKET)",
      timestamp: line.expectedReturn,
      description:
        line.overdueStatus === "OVERDUE"
          ? `${daysLabel(line.daysPastDue ?? 0)} past due; the ${OVERDUE_GRACE_DAYS}-day grace ended ${graceEnd}.`
          : line.inGrace
            ? `Passed ${daysLabel(line.daysPastDue ?? 0)} ago; inside the grace until ${graceEnd}.`
            : `Reads overdue after ${graceEnd}, once the ${OVERDUE_GRACE_DAYS}-day grace runs out.`,
      tone: line.overdueStatus === "OVERDUE" ? "danger" : "default",
    })
  }
  return events
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

/**
 * One repair line, end to end: where it is in the FRS lifecycle and how long
 * each stage took (FR-3, FR-9), the trace from reservation to session to
 * declaration to exception (FR-8), the vendor and money, the condition
 * declaration — recorded or amended here (FR-4) — and the justifications for
 * anything bought new while it was out (FR-7).
 *
 * It reads `useI08Snapshot()`, so a declaration saved from this page re-renders
 * it straight away: the status, the lifecycle's Attested step, the trace and
 * the exception that the declaration resolves all move together.
 */
export function RepairDetailPage({ repairId }: { repairId: string }) {
  const snapshot = useI08Snapshot()
  const { openMaterial360 } = useMaterial360()
  // The form is mounted with a new key per opening, so a second declaration
  // never starts from the first one's half-typed fields.
  const [dialog, setDialog] = useState<{ open: boolean; mode: "declare" | "amend"; key: number }>({
    open: false,
    mode: "declare",
    key: 0,
  })
  const line = snapshot.lines.find((l) => l.id === repairId)

  if (!line) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <BackToRegister />
          <PageHeader title="Repair not found" />
          <EmptyState
            title={`No repair line "${repairId}"`}
            description="This repair line does not exist in the repair register."
          />
        </div>
      </div>
    )
  }

  const inForce = line.declarationId
    ? snapshot.declarations.find((d) => d.id === line.declarationId)
    : undefined
  const target: DeclarationFormTarget = {
    lineId: line.id,
    materialId: line.material.materialId,
    plantId: line.plant.plantId,
    label: `${line.material.materialId} — ${line.material.description} (repair ${line.id})`,
    defaultQuantity: line.qtyUnderRepair || line.quantity,
    sessionId: line.sessionId,
  }

  function openDialog(mode: "declare" | "amend") {
    setDialog((current) => ({ open: true, mode, key: current.key + 1 }))
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <BackToRegister />
        <PageHeader
          title={`Repair ${line.id}`}
          description={`${STAGE_LABEL[line.stage]} — ${line.vendor}. The repair's lifecycle, its trace back to the reservation and session, and its declaration, as at ${REFERENCE_DATE}.`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={REPAIR_STATUS_TONE[line.repairStatus]}>
                {line.repairStatus}
              </StatusBadge>
              <StatusBadge tone={DECLARATION_STATUS_TONE[line.declarationStatus]}>
                Declaration: {line.declarationStatus}
              </StatusBadge>
            </div>
          }
        />
        <SessionChangesBanner />

        <MaterialCard line={line} onOpenMaterial={openMaterial360} />

        <LineBanners line={line} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <LifecycleCard line={line} />
            <TraceabilityCard line={line} snapshot={snapshot} />
          </div>

          <div className="flex flex-col gap-4">
            <VendorCostCard line={line} />
            <DeclarationCard
              line={line}
              snapshot={snapshot}
              canAmend={!!inForce}
              onDeclare={() => openDialog("declare")}
              onAmend={() => openDialog("amend")}
            />
            <JustificationPanel line={line} />
          </div>
        </div>
      </div>

      <DeclarationFormDialog
        key={dialog.key}
        open={dialog.open}
        onClose={() => setDialog((current) => ({ ...current, open: false }))}
        target={dialog.mode === "declare" ? target : undefined}
        amend={dialog.mode === "amend" ? inForce : undefined}
      />
    </div>
  )
}

function BackToRegister() {
  return (
    <Link
      href={REGISTER_HREF}
      className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" />
      Repair Register
    </Link>
  )
}

/** A label over a value, the way the material card lays out its figures. */
function Figure({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold text-foreground">{value}</div>
      {note && <div className="text-[11px] text-muted-foreground">{note}</div>}
    </div>
  )
}

/**
 * The part, the plant, and what is on the shelf against what is out. The
 * fourth figure is whichever date matters for where the line is: the date it
 * was scrapped, received, or is owed back.
 */
function MaterialCard({
  line,
  onOpenMaterial,
}: {
  line: RepairChain
  onOpenMaterial: (materialId: string) => void
}) {
  const dateFigure = line.scrappedAt
    ? { label: "Scrapped", value: line.scrappedAt, note: "at the vendor" }
    : line.overdueStatus === "RECEIVED"
      ? { label: "Received", value: line.receivedAt ?? UNKNOWN, note: line.backInStockAt ? `back in stock ${line.backInStockAt}` : "not yet back in stock" }
      : {
          label: "Expected return",
          value: line.expectedReturn ?? "No date",
          note: line.expectedReturn ? undefined : "no EKET schedule line",
        }
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <MaterialIdentity material={line.material} onOpen={onOpenMaterial} className="max-w-none" />
          <div className="mt-1 text-xs text-muted-foreground">{line.plant.name}</div>
        </div>
        {line.criticality ? (
          <StatusBadge tone={CRITICALITY_TONE[line.criticality] ?? "default"}>{line.criticality}</StatusBadge>
        ) : (
          <span className="text-xs text-muted-foreground" title="No criticality rating is recorded for this material">
            Criticality not recorded
          </span>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure
          label="Stock on hand"
          value={line.stockOnHand ?? UNKNOWN}
          note={line.stockOnHand === undefined ? "no MARD row at this plant" : undefined}
        />
        <Figure
          label="Reorder point"
          value={line.reorderPoint ?? UNKNOWN}
          note={line.reorderPoint === undefined ? "none maintained (MARC.MINBE)" : undefined}
        />
        <Figure
          label="Under repair"
          value={`${line.qtyUnderRepair} of ${line.quantity}`}
          note={isPartiallyReceived(line) ? "partly received" : undefined}
        />
        <Figure {...dateFigure} />
      </div>
    </div>
  )
}

/**
 * What a person should notice before reading anything else, loudest first.
 * Overdue is the FR-9 state; inside the grace is said plainly so "on time"
 * does not hide a missed date; no date means the line can never read overdue.
 */
function LineBanners({ line }: { line: RepairChain }) {
  const graceEnd = graceEndOf(line)
  return (
    <>
      {line.overdueStatus === "OVERDUE" && (
        <AlertBanner tone="critical" title="Repair overdue">
          {daysLabel(line.daysPastDue ?? 0)} past {line.expectedReturn}; the {OVERDUE_GRACE_DAYS}-day
          grace ended {graceEnd}, follow up with {line.vendor}. {line.qtyUnderRepair} unit(s) still out.
        </AlertBanner>
      )}
      {line.inGrace && (
        <AlertBanner tone="info" title="Past the expected return, inside the grace">
          Due back {line.expectedReturn}, now {daysLabel(line.daysPastDue ?? 0)} past. It stays On time
          until the {OVERDUE_GRACE_DAYS}-day grace ends on {graceEnd}, and reads Overdue the day after.
        </AlertBanner>
      )}
      {line.overdueStatus === "NO_DUE_DATE" && (
        <AlertBanner tone="warning" title="No expected return date">
          {line.repairPO
            ? `No EKET schedule line was agreed on the repair PO, so this repair has no date to be overdue against. Agree a delivery date with ${line.vendor}.`
            : "No repair PO yet, so no EKET schedule line has been agreed. The line cannot read overdue until a PO with a delivery date is issued."}
        </AlertBanner>
      )}
      {line.poBlocked && (
        <AlertBanner tone="warning" title="Repair PO blocked in SAP">
          The repair PO line is blocked, not deleted: it is still a live line and still counted, so it
          is flagged here rather than hidden. Ask the buyer why it is blocked.
        </AlertBanner>
      )}
      {line.scrappedAt && (
        <AlertBanner tone="info" title="Scrapped at the vendor">
          {line.vendor} found the unit not worth repairing on {line.scrappedAt}, and the repair line was
          cancelled. Nothing is owed back.
        </AlertBanner>
      )}
      {line.preAutomation && (
        <AlertBanner tone="info" title="Raised before the declaration control">
          This line was raised on {line.raisedAt}, before the condition-declaration control went live on{" "}
          {ATTESTATION_CUTOVER}. Nobody could have declared it at the time, so a missing declaration here
          is a reason, not a violation.
        </AlertBanner>
      )}
    </>
  )
}

function Card({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-sm font-medium text-foreground">{title}</div>
        {actions}
      </div>
      {children}
    </div>
  )
}

function LifecycleCard({ line }: { line: RepairChain }) {
  const terminal = isTerminalStage(line.stage)
  return (
    <Card title="Lifecycle">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {line.reservation && <SAPDocumentChip doc={line.reservation} />}
        <SAPDocumentChip doc={line.repairPR} />
        {line.repairPO ? (
          <SAPDocumentChip doc={line.repairPO} />
        ) : (
          <span className="italic">Repair PO not yet raised</span>
        )}
        {isPartiallyReceived(line) && <StatusBadge tone="warning">Partially received</StatusBadge>}
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        {terminal
          ? `${STAGE_LABEL[line.stage]} on ${line.stageEnteredAt}.`
          : `${STAGE_LABEL[line.stage]} since ${line.stageEnteredAt} — ${daysLabel(line.daysInStage)}, aging band ${line.stageAgingBucket} days.`}
      </p>
      <Timeline events={buildLifecycle(line)} />
      {/* Said, not left as a gap: the timeline starts at the PR when nobody
          recorded the part coming off the machine. */}
      {!line.removedAt && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          No removal from the machine is on record for this line, so the timeline starts at the repair PR.
        </p>
      )}
    </Card>
  )
}

/** One link in the FR-8 chain: an icon, what it is, and what the data says. */
function TraceStep({
  icon: Icon,
  label,
  missing,
  children,
}: {
  icon: LucideIcon
  label: string
  missing?: boolean
  children: ReactNode
}) {
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full",
          missing ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1 text-xs">
        <div className="mb-1 font-medium text-foreground">{label}</div>
        <div className="flex flex-col gap-1 text-muted-foreground">{children}</div>
      </div>
    </li>
  )
}

/**
 * FR-8, followed link by link: the reservation that started the repair, the
 * assistant session its item text quoted, the declarations naming this line,
 * the reasons recorded for anything bought new while it was out, and the
 * exceptions raised on it. Where a link is missing the card says so, and why,
 * rather than leaving a blank — the gap is the finding.
 */
function TraceabilityCard({ line, snapshot }: { line: RepairChain; snapshot: I8Snapshot }) {
  const reservation = snapshot.reservations.find((r) => r.repairId === line.id)
  const session = line.sessionId ? snapshot.sessions.find((s) => s.id === line.sessionId) : undefined
  const declarations = snapshot.declarations.filter((d) => d.repairLineIds.includes(line.id))
  const exceptions = snapshot.exceptions.filter((e) => e.repairId === line.id)
  const sessionException = exceptions.find((e) => e.type === "MISSING_SESSION_ID")
  const entries = line.justification?.entries ?? []
  const unjustified = line.justification?.unjustifiedPurchases ?? []

  return (
    <Card title="Traceability (FR-8)">
      <ol className="flex flex-col">
        <TraceStep icon={FileText} label="Reservation" missing={!line.reservation}>
          {line.reservation ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <SAPDocumentChip doc={line.reservation} />
                {reservation && (
                  <StatusBadge tone={SESSION_LINK_TONE[reservation.sessionLink]}>
                    {SESSION_LINK_LABEL[reservation.sessionLink]}
                  </StatusBadge>
                )}
              </div>
              {reservation && (
                <span>
                  Raised {reservation.createdAt} by {reservation.requester}
                  {reservation.itemText ? `; item text "${reservation.itemText}"` : "; item text blank"}.
                </span>
              )}
            </>
          ) : (
            <span>No 80-series reservation is linked — the repair PR was raised directly.</span>
          )}
        </TraceStep>

        <TraceStep icon={Bot} label="Assistant session" missing={!session}>
          {session ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] text-foreground">{session.id}</span>
                <StatusBadge tone={session.outcome === "ABANDONED" ? "warning" : "default"}>
                  {SESSION_OUTCOME_LABEL[session.outcome]}
                </StatusBadge>
              </div>
              <span>
                Opened {session.openedAt} by {session.requester}, for {session.quantity} unit(s).
              </span>
            </>
          ) : line.sessionId ? (
            <span>
              Session <span className="font-mono">{line.sessionId}</span> is quoted, but the assistant has no
              record of it.
            </span>
          ) : line.reservation ? (
            <span>
              No session ID on the reservation
              {sessionException ? (
                <>
                  {" "}— raised on the Exception Queue as{" "}
                  <Link href={exceptionHref(sessionException.id)} className="text-primary hover:underline">
                    {sessionException.id}
                  </Link>
                  .
                </>
              ) : reservation?.preAutomation ? (
                <>, raised before the Spares Assistant went live on {ASSISTANT_CUTOVER}.</>
              ) : (
                "."
              )}
            </span>
          ) : (
            <span>No reservation, so there is no session to trace.</span>
          )}
        </TraceStep>

        <TraceStep icon={ClipboardCheck} label="Condition declaration" missing={declarations.length === 0}>
          {declarations.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {declarations.map((d) => (
                <li key={d.id}>
                  <Link href={DECLARATIONS_HREF} className="font-medium text-primary hover:underline">
                    {d.id}
                  </Link>{" "}
                  · {d.condition} · {d.declaredBy}, {d.declaredAt}
                  {d.sessionId && ` · session ${d.sessionId}`}
                  {d.supersededBy && <span className="italic"> — amended by {d.supersededBy}</span>}
                  {d.supersedes && <span className="italic"> — amends {d.supersedes}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <span>
              No declaration names this line
              {line.preAutomation ? ", and none could: it predates the control." : "."}
            </span>
          )}
        </TraceStep>

        <TraceStep icon={ReceiptText} label="Justifications while it was out" missing={unjustified.some((p) => !p.preAutomation)}>
          {entries.length + unjustified.length === 0 ? (
            <span>No new unit was bought while this repair was out.</span>
          ) : (
            <ul className="flex flex-col gap-1">
              {entries.map((entry, index) => (
                <li key={entry.id ?? index}>
                  <Link href={JUSTIFICATIONS_HREF} className="font-medium text-primary hover:underline">
                    {entry.id ?? "Justification"}
                  </Link>{" "}
                  · {codeLabel(entry.reasonCategory)} · {entry.author ?? UNKNOWN}
                  {entry.sessionId && ` · session ${entry.sessionId}`}
                </li>
              ))}
              {unjustified.map((p) => (
                <li key={p.exceptionId}>
                  {p.purchase.documentNumber} bought {p.raisedAt ?? "on an unknown date"} with no reason —{" "}
                  <Link href={exceptionHref(p.exceptionId)} className="text-primary hover:underline">
                    {p.exceptionId}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TraceStep>

        <TraceStep icon={TriangleAlert} label="Exceptions on this line">
          {exceptions.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {exceptions.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2">
                  <Link href={exceptionHref(e.id)} className="font-medium text-primary hover:underline">
                    {e.id}
                  </Link>
                  <span className="text-foreground">{exceptionTypeLabel(e.type)}</span>
                  <StatusBadge tone={EXCEPTION_STATUS_TONE[e.status]}>{EXCEPTION_STATUS_LABEL[e.status]}</StatusBadge>
                  {e.owner && <span>· {e.owner}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <span>No exception has been raised on this line.</span>
          )}
        </TraceStep>
      </ol>
    </Card>
  )
}

/** A two-column definition row for the side cards. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{children}</dd>
    </>
  )
}

/**
 * The vendor and the money: how long the line has been open and in its stage,
 * the vendor's turnaround once it is back (FR-3), the planned-delivery verdict
 * (a second signal, independent of overdue), and what repairing saved against
 * buying new.
 */
function VendorCostCard({ line }: { line: RepairChain }) {
  const saving = line.newUnitCost > 0 ? line.newUnitCost - line.repairCost : undefined
  const leadTime =
    line.leadTimeStatus === undefined || line.leadTimeStatus === "NO_LEAD_TIME" || line.leadTimeDays === undefined
      ? "No planned delivery time maintained"
      : line.leadTimeStatus === "BEYOND_LEAD_TIME"
        ? `Beyond — ${line.daysElapsed ?? line.daysOpen} of ${line.leadTimeDays} planned days (+${line.daysOverLeadTime})`
        : `Within — ${line.daysElapsed ?? line.daysOpen} of ${line.leadTimeDays} planned days`
  return (
    <Card title="Vendor, cost & timing">
      <dl className="grid grid-cols-2 gap-y-2 text-xs">
        <Row label="Vendor">{line.vendor}</Row>
        <Row label="Requester">{line.requester}</Row>
        <Row label="Days open">
          {daysLabel(line.daysOpen)}
          {!isOpenLine(line) && <span className="text-muted-foreground"> (closed)</span>}
        </Row>
        <Row label="Stage">
          {STAGE_LABEL[line.stage]}
          {!isTerminalStage(line.stage) && <span className="text-muted-foreground"> · {daysLabel(line.daysInStage)}</span>}
        </Row>
        <Row label="Due date status">
          <StatusBadge tone={OVERDUE_STATUS_TONE[line.overdueStatus]}>
            {OVERDUE_STATUS_LABEL[line.overdueStatus]}
          </StatusBadge>
        </Row>
        <Row label="Vendor turnaround">
          {line.turnaroundDays !== undefined ? (
            `${daysLabel(line.turnaroundDays)}, dispatch to receipt`
          ) : (
            <span className="text-muted-foreground">
              {line.sentToVendorAt ? "Not back yet" : "Not yet dispatched"}
            </span>
          )}
        </Row>
        <Row label="Lead time">{leadTime}</Row>
        <Row label="Repair cost">{formatZAR(line.repairCost)}</Row>
        <Row label="New-unit cost">{line.newUnitCost > 0 ? formatZAR(line.newUnitCost) : UNKNOWN}</Row>
        <Row label="Saving by repairing">
          {saving === undefined ? (
            UNKNOWN
          ) : (
            <span className={saving < 0 ? "text-destructive" : "text-success"}>
              {formatZAR(saving)}
              {line.newUnitCost > 0 && (
                <span className="text-muted-foreground"> ({Math.round((saving / line.newUnitCost) * 100)}%)</span>
              )}
            </span>
          )}
        </Row>
        <Row label="New-unit lead time">{daysLabel(line.newUnitLeadTimeDays)}</Row>
      </dl>
      {line.notes && (
        <p className="mt-3 rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">{line.notes}</p>
      )}
    </Card>
  )
}

/**
 * FR-4 on this line. The condition is declared here, beside the evidence — the
 * Declaration Queue was the register's own lines with other columns, so it was
 * folded into the register (08-Oct-2026). A recorded declaration is locked; a
 * change is an amendment, a new record with a reason that supersedes it.
 */
function DeclarationCard({
  line,
  snapshot,
  canAmend,
  onDeclare,
  onAmend,
}: {
  line: RepairChain
  snapshot: I8Snapshot
  canAmend: boolean
  onDeclare: () => void
  onAmend: () => void
}) {
  const record = line.declarationId ? snapshot.declarations.find((d) => d.id === line.declarationId) : undefined
  return (
    <Card
      title="Condition declaration"
      actions={
        line.declarationStatus === "Required" ? (
          <Button size="sm" onClick={onDeclare}>
            Declare condition
          </Button>
        ) : canAmend ? (
          <Button size="sm" variant="outline" onClick={onAmend}>
            Amend declaration
          </Button>
        ) : undefined
      }
    >
      <StatusBadge tone={DECLARATION_STATUS_TONE[line.declarationStatus]}>{line.declarationStatus}</StatusBadge>
      {line.declaredBy && (
        <dl className="mt-3 grid grid-cols-2 gap-y-2 text-xs">
          <Row label="Declaration">{line.declarationId ?? UNKNOWN}</Row>
          <Row label="Declared by">{line.declaredBy}</Row>
          <Row label="Declared at">{line.declaredAt ?? UNKNOWN}</Row>
          <Row label="Condition">
            {line.condition ? (
              <StatusBadge tone={DECLARATION_CONDITION_TONE[line.condition]}>{line.condition}</StatusBadge>
            ) : (
              UNKNOWN
            )}
          </Row>
          {record && <Row label="Fault">{codeLabel(record.faultCategory)}</Row>}
        </dl>
      )}
      {record?.conditionDescription && (
        <p className="mt-2 text-xs text-muted-foreground">&ldquo;{record.conditionDescription}&rdquo;</p>
      )}
      {record?.supersedes && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Amends {record.supersedes}
          {record.amendmentReason && `: ${record.amendmentReason}`}
        </p>
      )}
      {line.declarationNextAction && (
        <p className="mt-3 text-xs text-foreground">
          <span className="font-medium">Next: </span>
          {line.declarationNextAction}
        </p>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">
        Every declaration, amended ones included, is on the{" "}
        <Link href={DECLARATIONS_HREF} className="text-primary hover:underline">
          Declarations screen
        </Link>
        .
      </p>
    </Card>
  )
}

/**
 * FR-7 on this line: the reasons recorded for buying new while it was out, and
 * the purchases made with none — each of which is an item on the Exception
 * Queue, so it links straight to it.
 */
function JustificationPanel({ line }: { line: RepairChain }) {
  const cell = justificationCellOf(line)
  const entries = line.justification?.entries ?? []
  const purchases = line.justification?.unjustifiedPurchases ?? []

  return (
    <Card title="Justification">
      {cell !== "NONE" && (
        <StatusBadge tone={JUSTIFICATION_CELL_TONE[cell]}>{JUSTIFICATION_CELL_LABEL[cell]}</StatusBadge>
      )}
      <p className={cell === "NONE" ? "text-xs text-muted-foreground" : "mt-2 text-xs text-muted-foreground"}>
        {JUSTIFICATION_CELL_NOTE[cell]}
      </p>

      {purchases.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {purchases.map((purchase) => (
            <li key={purchase.exceptionId} className="flex flex-wrap items-center gap-2 text-xs">
              <SAPDocumentChip doc={purchase.purchase} />
              <span className="text-muted-foreground">
                bought {purchase.raisedAt ?? "on an unknown date"}
                {purchase.preAutomation ? ", before the control existed" : ", no reason recorded"}
              </span>
              <Link href={exceptionHref(purchase.exceptionId)} className="text-primary hover:underline">
                {purchase.exceptionId} on the Exception Queue
              </Link>
            </li>
          ))}
        </ul>
      )}

      {entries.length > 0 && (
        <ul className="mt-3 flex flex-col gap-3">
          {entries.map((entry, index) => (
            <li key={entry.id ?? index} className="rounded-lg border border-border p-3">
              <p className="text-xs font-medium text-foreground first-letter:uppercase">
                {entry.reasonCategory ? codeLabel(entry.reasonCategory) : "Reason recorded"}
              </p>
              {/* The part a person actually reads. A category on its own
                  records that a box was ticked. */}
              {entry.freeText && <p className="mt-0.5 text-xs text-muted-foreground">{entry.freeText}</p>}
              <p className="mt-1 text-[11px] text-muted-foreground">
                {entry.id && `${entry.id} · `}Recorded by {entry.author ?? UNKNOWN}
                {entry.recordedAt && ` · ${entry.recordedAt}`}
                {entry.sessionId && ` · session ${entry.sessionId}`}
              </p>
            </li>
          ))}
        </ul>
      )}

      {/* Why some reasons are not here: one recorded while a unit was on the
          shelf, with nothing out for repair, has no line to sit on. */}
      <p className="mt-3 text-[11px] text-muted-foreground">
        Reasons recorded while a unit was on the shelf, with nothing out for repair, are in the{" "}
        <Link href={JUSTIFICATIONS_HREF} className="text-primary hover:underline">
          Justifications screen
        </Link>
        .
      </p>
    </Card>
  )
}
