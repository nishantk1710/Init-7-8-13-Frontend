"use client"

import { useMemo, useState } from "react"
import Link from "next/link"

import { MaterialIdentity } from "@/components/shared/material-identity"
import { RiskBadge } from "@/components/shared/risk-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useMaterial360 } from "@/lib/material-360-context"
import { cn, formatZAR } from "@/lib/utils"
import { APPROVAL_ROLES, approverName, type ApprovalRole } from "@/features/initiative-7/data/approval-chain"
import { RECOMMENDATIONS } from "@/features/initiative-7/data/recommendations"
import { useInventoryWorkflow } from "@/features/initiative-7/context/workflow-context"
import { CIRCUITS, CRITICALITIES, type Recommendation } from "@/features/initiative-7/types/inventory"
import { approvalDueLabel, waitingDays } from "@/features/initiative-7/utils/inventory-calc"

const ALL = "all"

/** The persona this mockup is signed in as — drives "My queue". */
export const DEMO_ROLE: ApprovalRole = "Engineering Manager"

type OutcomeTab = "pending" | "approved" | "adjusted" | "rejected"
type QueueTab = "mine" | "team" | "all"

const OUTCOME_TABS: { key: OutcomeTab; label: string; tone: "warning" | "success" | "default" | "danger" }[] = [
  { key: "pending", label: "Pending", tone: "warning" },
  { key: "approved", label: "Approved", tone: "success" },
  { key: "adjusted", label: "Adjusted", tone: "default" },
  { key: "rejected", label: "Rejected", tone: "danger" },
]

const SORT_OPTIONS = [
  { value: "due", label: "Due date" },
  { value: "impact", label: "Impact" },
  { value: "risk", label: "Risk" },
] as const

const RISK_ORDER: Record<Recommendation["risk"], number> = { critical: 0, high: 1, medium: 2, low: 3 }

const CRITICALITY_CODE: Record<Recommendation["criticality"], string> = {
  Critical: "A",
  High: "B",
  Medium: "C",
  Low: "D",
}

function ChangeSummary({ rec }: { rec: Recommendation }) {
  return (
    <div className="flex flex-col gap-0.5 text-[11px] tabular-nums text-muted-foreground">
      <span>
        SS {rec.current.safetyStock} → <span className="font-medium text-foreground">{rec.recommended.safetyStock}</span>
      </span>
      <span>
        ROP {rec.current.rop} → <span className="font-medium text-foreground">{rec.recommended.rop}</span>
      </span>
      <span>
        Max {rec.current.maxStock} → <span className="font-medium text-foreground">{rec.recommended.maxStock}</span>
      </span>
    </div>
  )
}

/** The 4-step chain for one recommendation, with where it currently sits. */
function ApprovalWorkflowSidebar({ rec }: { rec: Recommendation | null }) {
  const { stateFor } = useInventoryWorkflow()

  if (!rec) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-sm font-medium text-foreground">Approval workflow</div>
        <p className="mt-2 text-xs text-muted-foreground">
          Select a row to see where it sits in the approval chain.
        </p>
      </div>
    )
  }

  const state = stateFor(rec.id)

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div>
        <div className="text-sm font-medium text-foreground">Approval workflow</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {rec.material.materialId} — {rec.material.description}
        </div>
      </div>

      <ol className="flex flex-col gap-3">
        {APPROVAL_ROLES.map((role, index) => {
          const isDone = state.submitted && index < state.stepIndex
          const isCurrent = state.submitted && index === state.stepIndex && state.outcome !== "rejected"
          const isRejected = state.outcome === "rejected" && index === state.stepIndex
          const meta = isRejected
            ? "Rejected"
            : isDone
              ? "Approved"
              : isCurrent
                ? "Pending"
                : "Not yet reached"
          return (
            <li key={role} className="flex items-start gap-2.5">
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium",
                  isRejected
                    ? "bg-destructive/10 text-destructive"
                    : isDone
                      ? "bg-success/15 text-success"
                      : isCurrent
                        ? "bg-warning/15 text-warning"
                        : "bg-muted text-muted-foreground"
                )}
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-foreground">{role}</div>
                <div
                  className={cn(
                    "text-[11px]",
                    isRejected
                      ? "text-destructive"
                      : isCurrent
                        ? "text-warning"
                        : isDone
                          ? "text-success"
                          : "text-muted-foreground"
                  )}
                >
                  {meta}
                  {(isDone || isCurrent) && ` · ${approverName(role)}`}
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      <Link
        href={`/inventory-planning/recommendations/${rec.id}`}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Review this item
      </Link>
    </div>
  )
}

export function ApprovalsWorkspace() {
  const { openMaterial360 } = useMaterial360()
  const { stateFor, pendingRole } = useInventoryWorkflow()
  const [outcomeTab, setOutcomeTab] = useState<OutcomeTab>("pending")
  const [queueTab, setQueueTab] = useState<QueueTab>("all")
  const [circuit, setCircuit] = useState<string>(ALL)
  const [criticality, setCriticality] = useState<string>(ALL)
  const [sortBy, setSortBy] = useState<string>("due")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  /** Everything that has entered the chain, with its live state attached. */
  const submitted = useMemo(
    () =>
      RECOMMENDATIONS.map((rec) => ({
        rec,
        state: stateFor(rec.id),
        role: pendingRole(rec.id),
      })).filter((row) => row.state.submitted),
    [stateFor, pendingRole]
  )

  const outcomeCounts = useMemo(
    () => ({
      pending: submitted.filter((r) => r.role !== null).length,
      approved: submitted.filter((r) => r.state.outcome === "approved").length,
      adjusted: submitted.filter((r) => r.state.outcome === "adjusted").length,
      rejected: submitted.filter((r) => r.state.outcome === "rejected").length,
    }),
    [submitted]
  )

  const byOutcome = useMemo(
    () =>
      submitted.filter((row) =>
        outcomeTab === "pending" ? row.role !== null : row.state.outcome === outcomeTab
      ),
    [submitted, outcomeTab]
  )

  const queueCounts = useMemo(
    () => ({
      mine: byOutcome.filter((r) => r.role === DEMO_ROLE).length,
      team: byOutcome.filter((r) => r.role !== null && r.role !== DEMO_ROLE).length,
      all: byOutcome.length,
    }),
    [byOutcome]
  )

  const rows = useMemo(() => {
    const scoped = byOutcome.filter((row) => {
      if (queueTab === "mine" && row.role !== DEMO_ROLE) return false
      if (queueTab === "team" && (row.role === null || row.role === DEMO_ROLE)) return false
      if (circuit !== ALL && row.rec.circuit !== circuit) return false
      if (criticality !== ALL && row.rec.criticality !== criticality) return false
      return true
    })

    return [...scoped].sort((a, b) => {
      if (sortBy === "impact") return Math.abs(b.rec.workingCapitalImpact) - Math.abs(a.rec.workingCapitalImpact)
      if (sortBy === "risk") return RISK_ORDER[a.rec.risk] - RISK_ORDER[b.rec.risk]
      // Due date: longest-waiting first.
      return waitingDays(b.state.submittedOn ?? "") - waitingDays(a.state.submittedOn ?? "")
    })
  }, [byOutcome, queueTab, circuit, criticality, sortBy])

  const selected = rows.find((r) => r.rec.id === selectedId)?.rec ?? rows[0]?.rec ?? null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {OUTCOME_TABS.map((tab) => {
          const isActive = outcomeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setOutcomeTab(tab.key)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                isActive
                  ? "border-warning/40 bg-warning/10 font-medium text-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/50"
              )}
            >
              {tab.label}
              <span className="font-semibold tabular-nums text-foreground">{outcomeCounts[tab.key]}</span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border">
        <div className="flex items-center gap-5">
          {(
            [
              { key: "mine", label: `My queue (${queueCounts.mine})` },
              { key: "team", label: `Team queue (${queueCounts.team})` },
              { key: "all", label: `All approvals (${queueCounts.all})` },
            ] as { key: QueueTab; label: string }[]
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setQueueTab(tab.key)}
              className={cn(
                "border-b-2 px-0.5 py-2.5 text-sm transition-colors",
                queueTab === tab.key
                  ? "border-primary font-medium text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 pb-2">
          <Select value={circuit} onValueChange={(v) => setCircuit(v ?? ALL)}>
            <SelectTrigger className="h-8 w-full sm:w-36">
              <SelectValue placeholder="All circuits">
                {(v: string) => (v === ALL ? "All circuits" : v)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All circuits</SelectItem>
              {CIRCUITS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={criticality} onValueChange={(v) => setCriticality(v ?? ALL)}>
            <SelectTrigger className="h-8 w-full sm:w-40">
              <SelectValue placeholder="All criticalities">
                {(v: string) => (v === ALL ? "All criticalities" : v)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All criticalities</SelectItem>
              {CRITICALITIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Sort by</span>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v ?? "due")}>
              <SelectTrigger className="h-8 w-32">
                <SelectValue placeholder="Due date">
                  {(v: string) => SORT_OPTIONS.find((o) => o.value === v)?.label ?? v}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">
        <div className="min-w-0">
          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nothing in this queue right now.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[230px]">Material</TableHead>
                    <TableHead className="w-[130px]">Requested by</TableHead>
                    <TableHead className="w-[112px]">Change summary</TableHead>
                    <TableHead className="w-[110px] text-right">Impact</TableHead>
                    <TableHead className="w-[92px]">Risk</TableHead>
                    <TableHead className="w-[96px]">Due date</TableHead>
                    <TableHead className="w-[84px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ rec, state }) => {
                    const due = approvalDueLabel(state.submittedOn ?? "")
                    const isSelected = selected?.id === rec.id
                    const releases = rec.workingCapitalImpact > 0
                    return (
                      <TableRow
                        key={rec.id}
                        onClick={() => setSelectedId(rec.id)}
                        className={cn("cursor-pointer", isSelected && "bg-success/10 hover:bg-success/15")}
                      >
                        <TableCell>
                          <MaterialIdentity
                            material={rec.material}
                            onOpen={openMaterial360}
                            className="max-w-[210px]"
                          />
                          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <StatusBadge tone="default">{CRITICALITY_CODE[rec.criticality]}</StatusBadge>
                            <span>{rec.circuit}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-[13px] text-foreground">{state.requestedBy ?? "—"}</div>
                          <div className="text-[11px] whitespace-nowrap text-muted-foreground">
                            {state.submittedOn ?? ""}
                          </div>
                        </TableCell>
                        <TableCell>
                          <ChangeSummary rec={rec} />
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-medium whitespace-nowrap tabular-nums",
                            releases ? "text-success" : "text-warning"
                          )}
                        >
                          {releases ? "−" : "+"}
                          {formatZAR(Math.abs(rec.workingCapitalImpact))}
                        </TableCell>
                        <TableCell>
                          <RiskBadge level={rec.risk} />
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-[13px] whitespace-nowrap",
                            due.overdue ? "font-medium text-destructive" : "text-muted-foreground"
                          )}
                        >
                          {due.label}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/inventory-planning/recommendations/${rec.id}`}
                            className={cn(
                              buttonVariants({ size: "xs" }),
                              "bg-success text-white hover:bg-success/90"
                            )}
                          >
                            Review
                          </Link>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Due dates are seven days from submission against the dataset&apos;s reference date — illustrative
            thresholds, not an agreed SLA. Decisions are simulated; no SAP write ever occurs.
          </p>
        </div>

        <ApprovalWorkflowSidebar rec={selected} />
      </div>
    </div>
  )
}
