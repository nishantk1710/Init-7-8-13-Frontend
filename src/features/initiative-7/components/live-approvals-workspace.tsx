// Part 22 — I07 complete frontend live data integration.
//
// Live-mode counterpart to approvals-workspace.tsx. Reuses the same table/
// filter/sidebar layout and the same shared UI primitives, but every row
// comes from the real backend (GET /recommendations, filtered by the real
// submitted statuses -- see hooks/use-live-approval-queue.ts) instead of the
// scenario dataset's in-memory simulation. The outcome tabs use the
// backend's own status vocabulary (Pending/Approved/Rejected/Returned) --
// not the scenario's approve/adjust/reject taxonomy, since ADJUST/HOLD/
// SEND_BACK are real, distinct backend statuses with no single scenario
// equivalent.
//
// AUTHENTICATION LIMITATION (Part 13 deferred): there is no signed-in user,
// so "My queue" here is not filterable by a real identity the way the
// scenario's DEMO_ROLE persona fakes it -- this component shows only "All
// approvals", honestly, rather than fabricating a queue split with no real
// basis.

"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, RefreshCw } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { RiskBadge } from "@/components/shared/risk-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
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
import { useLiveApprovalQueue, useLiveWorkflowState } from "@/features/initiative-7/hooks/use-live-approval-queue"
import { CIRCUITS, CRITICALITIES, type Recommendation } from "@/features/initiative-7/types/inventory"

const ALL = "all"

type StatusTab = "pending" | "approved" | "rejected" | "returned"

const STATUS_TABS: { key: StatusTab; label: string; tone: "warning" | "success" | "default" | "danger" }[] = [
  { key: "pending", label: "Pending", tone: "warning" },
  { key: "approved", label: "Approved", tone: "success" },
  { key: "returned", label: "Returned", tone: "default" },
  { key: "rejected", label: "Rejected", tone: "danger" },
]

const SORT_OPTIONS = [
  { value: "generated", label: "Most recent" },
  { value: "impact", label: "Impact" },
  { value: "risk", label: "Risk" },
] as const

const RISK_ORDER: Record<Recommendation["risk"], number> = { critical: 0, high: 1, medium: 2, low: 3 }

function statusTabFor(rec: Recommendation): StatusTab {
  if (rec.status === "Approved" || rec.status === "Implemented") return "approved"
  if (rec.status === "Rejected") return "rejected"
  if (rec.status === "Returned") return "returned"
  return "pending"
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

/** The real approval route/pending-role for one selected recommendation,
 * fetched on demand rather than for the whole queue. */
function LiveApprovalWorkflowSidebar({ rec }: { rec: Recommendation | null }) {
  const { state, loading, error } = useLiveWorkflowState(rec?.id ?? null)

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

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div>
        <div className="text-sm font-medium text-foreground">Approval workflow</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {rec.material.materialId} — {rec.material.description}
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-24 w-full" />
      ) : error ? (
        <p className="text-[12px] text-destructive">Could not load workflow state: {error.message}</p>
      ) : state ? (
        <ol className="flex flex-col gap-3">
          {state.route.map((role, index) => {
            const isDone = index < state.chain_index
            const isCurrent = role === state.pending_role
            return (
              <li key={role} className="flex items-start gap-2.5">
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium",
                    isDone
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
                      isCurrent ? "text-warning" : isDone ? "text-success" : "text-muted-foreground"
                    )}
                  >
                    {isDone ? "Done" : isCurrent ? "Pending" : "Not yet reached"}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      ) : null}

      <Link
        href={`/inventory-planning/recommendations/${rec.id}`}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Review this item
      </Link>
    </div>
  )
}

export function LiveApprovalsWorkspace() {
  const { openMaterial360 } = useMaterial360()
  const { recommendations, loading, error, refetch } = useLiveApprovalQueue()
  const [statusTab, setStatusTab] = useState<StatusTab>("pending")
  const [circuit, setCircuit] = useState<string>(ALL)
  const [criticality, setCriticality] = useState<string>(ALL)
  const [sortBy, setSortBy] = useState<string>("generated")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const statusCounts = useMemo(() => {
    const counts: Record<StatusTab, number> = { pending: 0, approved: 0, rejected: 0, returned: 0 }
    for (const rec of recommendations) counts[statusTabFor(rec)] += 1
    return counts
  }, [recommendations])

  const rows = useMemo(() => {
    const scoped = recommendations.filter((rec) => {
      if (statusTabFor(rec) !== statusTab) return false
      if (circuit !== ALL && rec.circuit !== circuit) return false
      if (criticality !== ALL && rec.criticality !== criticality) return false
      return true
    })

    return [...scoped].sort((a, b) => {
      if (sortBy === "impact") return Math.abs(b.workingCapitalImpact) - Math.abs(a.workingCapitalImpact)
      if (sortBy === "risk") return RISK_ORDER[a.risk] - RISK_ORDER[b.risk]
      return new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    })
  }, [recommendations, statusTab, circuit, criticality, sortBy])

  const selected = rows.find((r) => r.id === selectedId) ?? rows[0] ?? null

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        icon={<AlertTriangle className="size-4" />}
        title="Could not load the approval queue from the backend"
        description={error.message}
        actions={
          <Button size="sm" variant="outline" onClick={refetch}>
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((tab) => {
          const isActive = statusTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusTab(tab.key)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                isActive
                  ? "border-warning/40 bg-warning/10 font-medium text-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/50"
              )}
            >
              {tab.label}
              <span className="font-semibold tabular-nums text-foreground">{statusCounts[tab.key]}</span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2">
        <p className="text-xs text-muted-foreground">
          {rows.length} recommendation{rows.length === 1 ? "" : "s"} — live from the backend approval chain.
        </p>

        <div className="flex flex-wrap items-center gap-2">
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
            <Select value={sortBy} onValueChange={(v) => setSortBy(v ?? "generated")}>
              <SelectTrigger className="h-8 w-32">
                <SelectValue placeholder="Most recent">
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
            <EmptyState title="Nothing in this queue right now" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[230px]">Material</TableHead>
                    <TableHead className="w-[112px]">Change summary</TableHead>
                    <TableHead className="w-[110px] text-right">Impact</TableHead>
                    <TableHead className="w-[92px]">Risk</TableHead>
                    <TableHead className="w-[96px]">Status</TableHead>
                    <TableHead className="w-[84px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((rec) => {
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
                            <StatusBadge tone="default">{rec.criticality}</StatusBadge>
                            <span>{rec.circuit}</span>
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
                        <TableCell>
                          <StatusBadge tone="default">{rec.status}</StatusBadge>
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
            Live backend data. Decisions are taken on the recommendation detail page.
          </p>
        </div>

        <LiveApprovalWorkflowSidebar rec={selected} />
      </div>
    </div>
  )
}
