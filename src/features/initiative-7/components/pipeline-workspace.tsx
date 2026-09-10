"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ChevronRight, Search } from "lucide-react"

import { MaterialIdentity } from "@/components/shared/material-identity"
import { RiskBadge } from "@/components/shared/risk-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { Input } from "@/components/ui/input"
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
import { cn } from "@/lib/utils"
import { APPROVAL_ROLES } from "@/features/initiative-7/data/approval-chain"
import { RECOMMENDATIONS } from "@/features/initiative-7/data/recommendations"
import { CHAIN_LENGTH, useInventoryWorkflow } from "@/features/initiative-7/context/workflow-context"
import {
  pipelineHealth,
  waitingDays,
  type PipelineHealth,
} from "@/features/initiative-7/utils/inventory-calc"

const ALL = "all"

type StatusTab = "in-flight" | "stuck" | "completed"

const HEALTH_TONE: Record<PipelineHealth, "success" | "warning" | "danger"> = {
  "On track": "success",
  Slow: "warning",
  Stuck: "danger",
}

/** Not-submitted, then one bucket per approval role, then Approved. */
const STAGES = ["Not submitted", ...APPROVAL_ROLES, "Approved"] as const

export function PipelineWorkspace() {
  const { openMaterial360 } = useMaterial360()
  const { stateFor, pendingRole } = useInventoryWorkflow()
  const [tab, setTab] = useState<StatusTab>("in-flight")
  const [stage, setStage] = useState<string>(ALL)
  const [query, setQuery] = useState("")

  const rows = useMemo(
    () =>
      RECOMMENDATIONS.map((rec) => {
        const state = stateFor(rec.id)
        const role = pendingRole(rec.id)
        const days = state.submittedOn ? waitingDays(state.submittedOn) : 0
        const stageLabel = !state.submitted
          ? "Not submitted"
          : role ?? (state.outcome === "rejected" ? "Rejected" : "Approved")
        return {
          rec,
          state,
          role,
          days,
          stageLabel,
          health: state.submitted && role ? pipelineHealth(days) : null,
        }
      }),
    [stateFor, pendingRole]
  )

  const stageCounts = useMemo(() => {
    const counts = new Map<string, number>(STAGES.map((s) => [s, 0]))
    for (const row of rows) {
      if (counts.has(row.stageLabel)) counts.set(row.stageLabel, (counts.get(row.stageLabel) ?? 0) + 1)
    }
    return counts
  }, [rows])

  const tabCounts = useMemo(
    () => ({
      "in-flight": rows.filter((r) => r.role !== null).length,
      stuck: rows.filter((r) => r.health === "Stuck").length,
      completed: rows.filter((r) => r.state.submitted && r.role === null).length,
    }),
    [rows]
  )

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (tab === "in-flight" && row.role === null) return false
      if (tab === "stuck" && row.health !== "Stuck") return false
      if (tab === "completed" && !(row.state.submitted && row.role === null)) return false
      if (stage !== ALL && row.stageLabel !== stage) return false
      if (search) {
        const haystack = `${row.rec.material.materialId} ${row.rec.material.description}`.toLowerCase()
        if (!haystack.includes(search)) return false
      }
      return true
    })
  }, [rows, tab, stage, query])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { key: "in-flight", label: "In flight" },
            { key: "stuck", label: "Stuck" },
            { key: "completed", label: "Completed" },
          ] as { key: StatusTab; label: string }[]
        ).map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setTab(option.key)}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors",
              tab === option.key
                ? "border-warning/40 bg-warning/10 font-medium text-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted/50"
            )}
          >
            {option.label}
            <span className="font-semibold tabular-nums text-foreground">{tabCounts[option.key]}</span>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-sm font-medium text-foreground">Flow through the approval chain</div>
        <div className="mt-3 flex flex-wrap items-stretch gap-1.5">
          {STAGES.map((stageName, index) => {
            const count = stageCounts.get(stageName) ?? 0
            const isEmpty = count === 0
            return (
              <div key={stageName} className="flex items-stretch gap-1.5">
                <button
                  type="button"
                  onClick={() => setStage(stage === stageName ? ALL : stageName)}
                  className={cn(
                    "min-w-[128px] flex-1 rounded-lg border p-3 text-left transition-colors",
                    stage === stageName
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-background hover:bg-muted/40"
                  )}
                >
                  <div
                    className={cn(
                      "text-2xl font-semibold tabular-nums",
                      isEmpty ? "text-muted-foreground" : "text-primary"
                    )}
                  >
                    {count}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{stageName}</div>
                </button>
                {index < STAGES.length - 1 && (
                  <ChevronRight className="size-4 self-center shrink-0 text-muted-foreground" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Track a material..."
            className="h-8 pl-7 text-sm"
          />
        </div>
        <Select value={stage} onValueChange={(v) => setStage(v ?? ALL)}>
          <SelectTrigger className="h-8 w-full sm:w-44">
            <SelectValue placeholder="All stages">{(v: string) => (v === ALL ? "All stages" : v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All stages</SelectItem>
            {STAGES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nothing matches this view.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Waiting on</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Waiting</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map(({ rec, state, role, days, health }) => {
                const done = state.submitted ? Math.min(state.stepIndex, CHAIN_LENGTH) : 0
                return (
                  <TableRow key={rec.id}>
                    <TableCell>
                      <Link
                        href={`/inventory-planning/recommendations/${rec.id}`}
                        className="hover:underline"
                      >
                        <MaterialIdentity material={rec.material} onOpen={openMaterial360} />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <RiskBadge level={rec.risk} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {role ?? (state.submitted ? "—" : "Planner")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5">
                          {APPROVAL_ROLES.map((_, index) => (
                            <span
                              key={index}
                              className={cn(
                                "h-1.5 w-5 rounded-full",
                                index < done
                                  ? "bg-success"
                                  : index === done && role
                                    ? "bg-warning"
                                    : "bg-muted"
                              )}
                            />
                          ))}
                        </div>
                        <span className="text-[11px] tabular-nums text-muted-foreground">
                          {done}/{CHAIN_LENGTH}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[13px] tabular-nums text-muted-foreground">
                      {state.submitted ? `${days} day${days === 1 ? "" : "s"}` : "—"}
                    </TableCell>
                    <TableCell>
                      {health ? (
                        <StatusBadge tone={HEALTH_TONE[health]}>{health}</StatusBadge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      {state.submittedOn ?? "Not submitted"}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground italic">
        Waiting time is measured from the submitted date against the dataset&apos;s reference date — &quot;Slow&quot;
        past 7 days, &quot;Stuck&quot; past 14. Illustrative thresholds, not an agreed SLA.
      </p>
    </div>
  )
}
