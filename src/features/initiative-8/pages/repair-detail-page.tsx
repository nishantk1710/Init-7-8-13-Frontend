"use client"

import Link from "next/link"
import { useSyncExternalStore, type ReactNode } from "react"
import { Calendar, Check, Clock, Cog, Copy, SquarePen, TriangleAlert, Truck, Warehouse } from "lucide-react"
import { toast } from "sonner"

import type { TimelineEvent } from "@/components/shared/timeline"
import { buttonVariants } from "@/components/ui/button"
import { DeclareConditionButton } from "@/features/initiative-8/components/declare-condition-button"
import { InfoPopover } from "@/features/initiative-8/components/kit/info-popover"
import { Card, Dot, I08Page, type Crumb } from "@/features/initiative-8/components/kit/page"
import { Actor, StatusDot } from "@/features/initiative-8/components/kit/status"
import { REGISTER_RETURN_KEY } from "@/features/initiative-8/components/repair-register-table"
import { exceptionsHref } from "@/features/initiative-8/data/live-exceptions"
import { REGISTER_PATH } from "@/features/initiative-8/data/live-register"
import type { ExceptionQueueRow, RepairChain } from "@/features/initiative-8/types/repair"
import { conditionLabel, humanize, isUnsigned, plural, stageLabel } from "@/features/initiative-8/utils/format"
import {
  JUSTIFICATION_CELL_NOTE,
  exceptionTypeLabel,
  hasNoDueDate,
  isOpenRepair,
  isRepairOverdue,
  justificationCellOf,
  vendorLabel,
} from "@/features/initiative-8/utils/status"
import { cn, formatZAR } from "@/lib/utils"

export type RepairDetailPageProps = {
  repairId: string
  /**
   * The line and its lifecycle, fetched by the route. Absent means the backend
   * answered and has no such line, which renders the not-found state.
   */
  detail?: { chain: RepairChain; timeline: TimelineEvent[] }
  /** Set when the fetch failed. Rendered as a failure, never as "not found". */
  loadError?: string | null
  /** The declaration form's fault categories; empty when that fetch failed,
   *  and the form then says so rather than offering a list it made up. */
  faultCategories?: string[]
  /** The exception items raised against this line. Null when that fetch
   *  failed -- "could not be checked", never a clean bill of health. */
  exceptions?: ExceptionQueueRow[] | null
}

const noSubscription = () => () => {}

/** The register as it was left, read from this tab's session. */
function storedRegisterHref(): string {
  try {
    return window.sessionStorage.getItem(REGISTER_RETURN_KEY) ?? REGISTER_PATH
  } catch {
    // Storage can be blocked; the plain register is the right fallback.
    return REGISTER_PATH
  }
}

/** Where the breadcrumb goes back to: the register as it was left. */
function useRegisterHref(): string {
  return useSyncExternalStore(noSubscription, storedRegisterHref, () => REGISTER_PATH)
}

/**
 * One repair line -- I08_Live_UI_Redesign_Plan.md, L3 and Q8.
 *
 * A breadcrumb back to the register as it was left (it had no way back but the
 * browser's). The main action, Declare condition, in the header -- it was
 * inside the fourth card. Lateness said once, in the banner; each fact once.
 *
 * The timeline reads plainly: a recorded step is filled, a step SAP does not
 * record is hollow and grey, and red means late. The colours used to run the
 * other way, with the one real event in grey. The SAP evidence behind each
 * step -- which document, which movement -- is behind its ⓘ.
 */
export function RepairDetailPage({
  repairId,
  detail,
  loadError = null,
  faultCategories = [],
  exceptions = null,
}: RepairDetailPageProps) {
  const registerHref = useRegisterHref()
  const crumbs: Crumb[] = [
    { label: "Repairable Spares", href: "/repairable-spares" },
    { label: "Repair Register", href: registerHref },
    { label: repairId },
  ]
  const chain = detail?.chain

  if (loadError) {
    // NOT the not-found state: a line that does not exist and a backend that
    // cannot be reached are different answers.
    return (
      <I08Page crumbs={crumbs} title={`Repair ${repairId}`}>
        <div role="alert" className="mt-6 rounded-xl border border-i08-crit-border bg-i08-crit-tint p-8 text-center text-sm">
          <p className="font-medium text-foreground">This repair could not be loaded.</p>
          <p className="mt-1 text-muted-foreground">{loadError}</p>
          <p className="mt-3 text-[13px] text-muted-foreground">
            This is not a missing repair, it is a failed request. Try again in a minute.
          </p>
        </div>
      </I08Page>
    )
  }

  if (!chain || !detail) {
    return (
      <I08Page crumbs={crumbs} title="Repair not found">
        <div className="mt-6 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <p className="text-[15px] font-semibold text-foreground">No open repair line &ldquo;{repairId}&rdquo;</p>
          <p className="max-w-md text-[13.5px] text-muted-foreground">
            The register lists only the repair lines SAP still has open. This one may since have been marked
            delivery completed, blocked or deleted in SAP.
          </p>
          <Link href={registerHref} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-1 px-3.5")}>
            Back to the register
          </Link>
        </div>
      </I08Page>
    )
  }

  const late = chain.daysRemainingInRepair !== undefined && chain.daysRemainingInRepair < 0 ? -chain.daysRemainingInRepair : 0
  const overdue = isRepairOverdue(chain)

  return (
    <I08Page
      crumbs={crumbs}
      title={chain.material.description}
      summary={
        <>
          <span className="inline-flex items-center gap-0.5">
            <span className="font-mono text-[14px] font-medium text-foreground">{chain.material.materialCode}</span>
            <CopyButton value={chain.material.materialCode} label="material number" />
          </span>
          <Dot />
          <span>
            {chain.plant.name}
            {chain.plant.plantId !== "—" ? ` (${chain.plant.plantId})` : ""}
          </span>
          <Dot />
          <span>{vendorLabel(chain)}</span>
        </>
      }
      actions={
        <>
          {chain.declarationId ? (
            // An attestation is never edited: an amendment is a new row
            // pointing at the old one, which stays readable.
            <DeclareConditionButton
              chain={chain}
              faultCategories={faultCategories}
              label="Amend declaration"
              size="lg"
              supersedes={chain.declarationId}
            />
          ) : (
            <DeclareConditionButton chain={chain} faultCategories={faultCategories} variant="default" size="lg" icon />
          )}
        </>
      }
    >
      {overdue && (
        <Banner tone="crit" icon={<Clock className="mt-0.5 size-[18px] shrink-0" />}>
          <b className="font-semibold">{late ? `${plural(late, "day")} late.` : "Late."}</b> Expected back{" "}
          {chain.expectedReturn ?? "on an unrecorded date"}. Follow up with {vendorLabel(chain)}.
        </Banner>
      )}
      {!overdue && hasNoDueDate(chain) && isOpenRepair(chain) && (
        // Its own state, not "on time": nobody agreed a return date, so there
        // is nothing to be late against and nothing will chase it.
        <Banner tone="warn" icon={<Calendar className="mt-0.5 size-[18px] shrink-0" />}>
          <b className="font-semibold">No return date agreed.</b> This line can never read as late, so nothing will
          chase it. It has been open {plural(chain.daysOpen, "day")}.
        </Banner>
      )}
      {chain.declarationStatus === "Flagged" && (
        <Banner tone="crit" icon={<TriangleAlert className="mt-0.5 size-[18px] shrink-0" />}>
          <b className="font-semibold">Sent for repair against the assessment.</b> The part was declared{" "}
          {conditionLabel(chain.condition).toLowerCase()}, and the repair went ahead. Confirm the decision with whoever
          declared it.
        </Banner>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-sm text-muted-foreground">
        <span>
          Stage <b className="font-medium text-foreground">{stageLabel(chain.repairStatus)}</b>
          {chain.daysInCurrentStage !== undefined ? `, for ${plural(chain.daysInCurrentStage, "day")}` : ""}
        </span>
        <span>Open {plural(chain.daysOpen, "day")}</span>
        <span className="inline-flex items-center gap-1.5">
          Declaration
          <StatusDot
            tone={chain.declarationStatus === "Completed" ? "good" : chain.declarationStatus === "Flagged" ? "crit" : "warn"}
          >
            {chain.declarationStatus === "Completed"
              ? "Declared"
              : chain.declarationStatus === "Flagged"
                ? "Against assessment"
                : "Required"}
          </StatusDot>
        </span>
      </div>

      <div className="mt-5 grid items-start gap-4 xl:grid-cols-[1.15fr_1fr]">
        <Card className="px-5 pt-4.5 pb-5">
          <h2 className="text-[15.5px] font-semibold text-foreground">Repair progress</h2>
          <p className="mt-0.5 mb-4 text-[13px] text-muted-foreground">From the SAP documents on this line.</p>
          <RepairTimeline chain={chain} stages={detail.timeline} faultCategories={faultCategories} />
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="px-5 pt-4.5 pb-5">
            <h2 className="text-[15.5px] font-semibold text-foreground">Facts</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3.5">
              <Fact label="Stock on hand">{chain.stockOnHand ?? <Faint>Not recorded</Faint>}</Fact>
              <Fact label="Reorder point">{chain.reorderPoint ?? <Faint>Not recorded</Faint>}</Fact>
              <Fact label="Under repair">{chain.qtyUnderRepair}</Fact>
              {/* Unknown when the PO line has no net price: R 0.00 would read as a free repair. */}
              <Fact label="Repair cost">
                {chain.repairCost === undefined ? <Faint>No price on the PO</Faint> : formatZAR(chain.repairCost)}
              </Fact>
              <Fact label="New-unit lead time">
                {chain.newUnitLeadTimeDays === undefined ? <Faint>Not recorded</Faint> : plural(chain.newUnitLeadTimeDays, "day")}
              </Fact>
              <Fact label="Criticality">{chain.criticality ? humanize(chain.criticality) : <Faint>Not rated</Faint>}</Fact>
              <Fact label="Repair PR">
                <span className="font-mono text-[13.5px]">{docRef(chain.repairPR)}</span>
              </Fact>
              <Fact label="Repair PO">
                {chain.repairPO ? <span className="font-mono text-[13.5px]">{docRef(chain.repairPO)}</span> : <Faint>Not yet raised</Faint>}
              </Fact>
              {/* A requisitioner CODE: no person directory was delivered. */}
              <Fact label="Requester">{chain.requester ? <span className="font-mono text-[13.5px]">{chain.requester}</span> : <Faint>Not recorded</Faint>}</Fact>
              <Fact label="Open since">{chain.poIssuedAt ?? chain.raisedAt}</Fact>
            </dl>
          </Card>

          <LineExceptions chain={chain} exceptions={exceptions} />
          <Justification chain={chain} />
        </div>
      </div>
    </I08Page>
  )
}

function docRef(doc: { documentNumber: string; line?: string }): string {
  return doc.line ? `${doc.documentNumber}/${doc.line}` : doc.documentNumber
}

function Faint({ children }: { children: ReactNode }) {
  return <span className="font-normal text-muted-foreground">{children}</span>
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12.5px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-[14.5px] font-medium text-foreground">{children}</dd>
    </div>
  )
}

function Banner({ tone, icon, children }: { tone: "crit" | "warn"; icon: ReactNode; children: ReactNode }) {
  return (
    <div
      role="status"
      className={cn(
        "mt-4 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm",
        tone === "crit"
          ? "border-i08-crit-border bg-i08-crit-tint text-i08-crit-ink"
          : "border-i08-warn-border bg-i08-warn-tint text-i08-warn-ink",
      )}
    >
      {icon}
      <div>{children}</div>
    </div>
  )
}

function CopyButton({ value, label }: { value: string; label: string }) {
  return (
    <button
      type="button"
      aria-label={`Copy the ${label}`}
      title={`Copy the ${label}`}
      onClick={() => {
        navigator.clipboard?.writeText(value).then(
          () => toast.success(`Copied ${value}`),
          () => toast.error("Could not copy: the browser blocked it."),
        )
      }}
      className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-i08-link"
    >
      <Copy className="size-3.5" />
    </button>
  )
}

const STAGE_TITLE: Record<string, string> = {
  removed: "Removed from machine",
  attested: "Condition declared",
  po_raised: "Repair PO raised",
  dispatched: "Sent to vendor",
  at_vendor: "At vendor",
}

const STAGE_ICON: Record<string, typeof Check> = {
  removed: Cog,
  attested: SquarePen,
  po_raised: Check,
  dispatched: Truck,
  at_vendor: Warehouse,
}

type Step = {
  key: string
  title: string
  note: ReactNode
  when?: string
  evidence?: string
  state: "done" | "missing" | "todo" | "late"
  icon: typeof Check
}

/** The lifecycle, one step per stage the backend reports, then the return. */
function RepairTimeline({
  chain,
  stages,
  faultCategories,
}: {
  chain: RepairChain
  stages: TimelineEvent[]
  faultCategories: string[]
}) {
  const steps: Step[] = stages.map((stage) => {
    const happened = stage.timestamp !== "Not recorded"
    const title = STAGE_TITLE[stage.id] ?? stage.label
    const base = { key: stage.id, title, evidence: stage.description, icon: STAGE_ICON[stage.id] ?? Check }
    switch (stage.id) {
      case "removed":
        return { ...base, state: "missing", note: "Not tracked for this line" }
      case "attested":
        if (chain.declarationStatus === "Flagged") {
          return {
            ...base,
            icon: TriangleAlert,
            state: "late",
            when: chain.declaredAt ?? stage.timestamp,
            note: `${conditionLabel(chain.condition)}, declared by ${isUnsigned(chain.declaredBy) ? "someone not signed in" : chain.declaredBy}`,
          }
        }
        if (happened || chain.declarationStatus === "Completed") {
          return {
            ...base,
            icon: Check,
            state: "done",
            when: chain.declaredAt ?? stage.timestamp,
            note: (
              <>
                {conditionLabel(chain.condition)}, declared by <Actor actor={chain.declaredBy} />
              </>
            ),
          }
        }
        return {
          ...base,
          state: "todo",
          note: (
            <span className="inline-flex flex-wrap items-center gap-x-1.5">
              Not yet.
              <DeclareConditionButton chain={chain} faultCategories={faultCategories} variant="link" label="Declare condition" />
            </span>
          ),
        }
      case "po_raised":
        return {
          ...base,
          icon: Check,
          state: "done",
          when: happened ? stage.timestamp : undefined,
          note: `PO ${chain.repairPO ? docRef(chain.repairPO) : "not yet raised"} · from PR ${docRef(chain.repairPR)}`,
        }
      case "dispatched":
        return happened
          ? { ...base, icon: Check, state: "done", when: stage.timestamp, note: vendorLabel(chain) }
          : { ...base, state: "missing", note: "Not recorded in SAP" }
      case "at_vendor":
        return happened
          ? {
              ...base,
              icon: Check,
              state: "done",
              when: stage.timestamp,
              note: chain.daysInCurrentStage !== undefined ? `For ${plural(chain.daysInCurrentStage, "day")}` : "At the vendor",
            }
          : { ...base, state: "missing", note: "Not recorded in SAP" }
      default:
        return happened
          ? { ...base, icon: Check, state: "done", when: stage.timestamp, note: stage.description ?? "" }
          : { ...base, state: "missing", note: "Not recorded" }
    }
  })

  const overdue = isRepairOverdue(chain)
  const late = chain.daysRemainingInRepair !== undefined && chain.daysRemainingInRepair < 0 ? -chain.daysRemainingInRepair : 0
  steps.push({
    key: "expected",
    title: "Expected back",
    icon: overdue ? Clock : Calendar,
    state: overdue ? "late" : "missing",
    when: chain.expectedReturn,
    note: overdue
      ? late
        ? `${plural(late, "day")} late`
        : "Late"
      : chain.expectedReturn
        ? "From the PO delivery schedule"
        : "No date agreed",
  })

  return (
    <ol className="flex flex-col">
      {steps.map((step, index) => {
        const Icon = step.icon
        return (
          <li
            key={step.key}
            style={{ animationDelay: `${index * 70}ms` }}
            className="i08-settle relative grid grid-cols-[24px_minmax(0,1fr)_auto] gap-3 pb-5 last:pb-0"
          >
            {index < steps.length - 1 && (
              <span aria-hidden="true" className="absolute top-6 bottom-0 left-[11px] w-0.5 bg-border" />
            )}
            <span
              aria-hidden="true"
              className={cn(
                "relative z-[1] grid size-6 place-items-center rounded-full border-2 [&_svg]:size-3.5 [&_svg]:stroke-[2.5]",
                step.state === "done" && "border-primary bg-primary text-primary-foreground",
                step.state === "late" && "border-i08-crit bg-i08-crit text-white",
                step.state === "todo" && "border-i08-warn bg-i08-warn-tint text-i08-warn-ink",
                step.state === "missing" && "border-dashed border-border bg-card text-muted-foreground",
              )}
            >
              <Icon />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-[14px] font-medium text-foreground">
                {step.title}
                <span className="sr-only">
                  {step.state === "done" ? "(recorded)" : step.state === "late" ? "(late)" : step.state === "todo" ? "(to do)" : "(not recorded)"}
                </span>
                {step.evidence && (
                  <InfoPopover title={step.title}>
                    <p>{step.evidence}</p>
                  </InfoPopover>
                )}
              </div>
              <div className="mt-0.5 text-[13px] text-muted-foreground">{step.note}</div>
            </div>
            <div
              className={cn(
                "text-right text-[13px] whitespace-nowrap",
                step.state === "late" ? "font-medium text-i08-crit-ink" : "text-muted-foreground",
              )}
            >
              {step.when}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * What the checks raised against this line. Three states, three claims: items
 * found; checks ran and found nothing; the queue could not be read -- which
 * must never render as a clean bill of health.
 */
function LineExceptions({ chain, exceptions }: { chain: RepairChain; exceptions: ExceptionQueueRow[] | null }) {
  return (
    <Card className="px-5 pt-4.5 pb-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15.5px] font-semibold text-foreground">Exceptions on this line</h2>
        {exceptions !== null && exceptions.length > 0 && (
          <Link
            href={exceptionsHref({ status: undefined, repair: chain.id })}
            className="text-[13.5px] font-medium text-i08-link hover:underline"
          >
            Open in the queue
          </Link>
        )}
      </div>
      {exceptions === null ? (
        <p className="mt-2 text-[13.5px] text-i08-warn-ink">
          The exception queue could not be read, so this line&rsquo;s findings are unknown. This is not &ldquo;nothing
          found&rdquo;.
        </p>
      ) : exceptions.length === 0 ? (
        <p className="mt-2 text-[13.5px] text-muted-foreground">The checks ran and found nothing on this line.</p>
      ) : (
        <ul className="mt-2 flex flex-col">
          {exceptions.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 border-t border-border py-2.5 first:border-t-0">
              <Link href={`${exceptionsHref({ status: undefined })}&id=${encodeURIComponent(item.id)}`} className="hover:underline">
                <StatusDot tone={item.status === "OPEN" ? (item.type === "OVERDUE_REPAIR" ? "crit" : "warn") : "good"}>
                  {exceptionTypeLabel(item.type)}
                </StatusDot>
              </Link>
              <span className="text-[13px] text-muted-foreground">
                {item.status === "OPEN" ? (item.owner ? `Open · ${item.owner}` : "Open · unassigned") : "Closed"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/**
 * FR-7 on this line: the reasons recorded for buying new while it was out,
 * and the purchases made with none. One line when there is nothing to show.
 */
function Justification({ chain }: { chain: RepairChain }) {
  const cell = justificationCellOf(chain)
  const entries = chain.justification?.entries ?? []
  const purchases = chain.justification?.unjustifiedPurchases ?? []
  return (
    <Card className="px-5 pt-4.5 pb-4">
      <h2 className="text-[15.5px] font-semibold text-foreground">Justification</h2>
      <p className="mt-1.5 text-[13.5px] text-muted-foreground">
        {JUSTIFICATION_CELL_NOTE[cell]}{" "}
        <Link href="/repairable-spares/justifications" className="font-medium text-i08-link hover:underline">
          All justifications
        </Link>
      </p>
      {purchases.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5 text-[13px]">
          {purchases.map((purchase) => (
            <li key={purchase.exceptionId} className="text-muted-foreground">
              <span className="font-mono text-foreground">{docRef(purchase.purchase)}</span> bought{" "}
              {purchase.raisedAt ?? "on an unknown date"}
              {purchase.preAutomation ? ", before the control existed" : ", no reason recorded"}
            </li>
          ))}
        </ul>
      )}
      {entries.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {entries.map((entry, index) => (
            <li key={entry.id ?? index} className="rounded-lg border border-border px-3 py-2.5 text-[13px]">
              <p className="font-medium text-foreground">{humanize(entry.reasonCategory, "Reason recorded")}</p>
              {entry.freeText && <p className="mt-0.5 text-muted-foreground">{entry.freeText}</p>}
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                Recorded by <Actor actor={entry.author} />
                {entry.recordedAt && ` · ${entry.recordedAt}`}
                {entry.sessionId && (
                  <>
                    {" · "}
                    <Link href={`/assistant/sessions/${encodeURIComponent(entry.sessionId)}`} className="font-medium text-i08-link hover:underline">
                      session {entry.sessionId}
                    </Link>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
