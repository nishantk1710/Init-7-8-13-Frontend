"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { MaterialIdentity } from "@/components/shared/material-identity"
import { RiskBadge, type RiskLevel } from "@/components/shared/risk-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { FilterBar } from "@/components/shared/filter-bar"
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
import { getPlantById, PLANTS } from "@/lib/shared-data/plants"
import { cn } from "@/lib/utils"
import {
  CIRCUITS,
  CRITICALITIES,
  DEMAND_PATTERNS,
  RECOMMENDATION_STATUSES,
  type Recommendation,
} from "@/features/initiative-7/types/inventory"

const ALL = "all"

const STATUS_TONE: Record<Recommendation["status"], "default" | "success" | "warning" | "danger"> = {
  "Pending Review": "default",
  "In Approval": "warning",
  Approved: "success",
  Rejected: "danger",
  Returned: "warning",
  Implemented: "success",
}

const RISK_LEVELS: RiskLevel[] = ["low", "medium", "high", "critical"]

function ParamPair({ current, recommended }: { current: number; recommended: number }) {
  const changed = current !== recommended
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums">
      <span className={cn(!changed && "text-muted-foreground")}>{current}</span>
      {changed && (
        <>
          <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
          <span className="font-medium text-foreground">{recommended}</span>
        </>
      )}
    </span>
  )
}

/** Pure table rendering — no filter state of its own, so it can be reused
 * both by the standalone Recommendations page (which wraps it with its own
 * filter bar below) and by the Overview page (which drives it from the
 * page-level dashboard filters instead). */
export function RecommendationsTableView({
  recommendations,
  highlightRecommendationId,
}: {
  recommendations: Recommendation[]
  highlightRecommendationId?: string
}) {
  const { openMaterial360 } = useMaterial360()

  useEffect(() => {
    if (!highlightRecommendationId) return
    document
      .getElementById(`rec-row-${highlightRecommendationId}`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" })
  }, [highlightRecommendationId])

  if (recommendations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No recommendations match these filters.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Material</TableHead>
            <TableHead>Plant</TableHead>
            <TableHead>Circuit</TableHead>
            <TableHead>Criticality</TableHead>
            <TableHead>ROP (cur → rec)</TableHead>
            <TableHead>Safety Stock (cur → rec)</TableHead>
            <TableHead>Max Stock (cur → rec)</TableHead>
            <TableHead>Lead Time</TableHead>
            <TableHead>Demand Pattern</TableHead>
            <TableHead>Risk</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recommendations.map((r) => {
            const isHighlighted = r.id === highlightRecommendationId
            return (
              <TableRow
                key={r.id}
                id={`rec-row-${r.id}`}
                className={cn(isHighlighted && "bg-primary/10 hover:bg-primary/15")}
              >
                <TableCell>
                  <MaterialIdentity material={r.material} onOpen={openMaterial360} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {getPlantById(r.plantId)?.name ?? r.plantId}
                </TableCell>
                <TableCell className="text-muted-foreground">{r.circuit}</TableCell>
                <TableCell className="text-muted-foreground">{r.criticality}</TableCell>
                <TableCell>
                  <ParamPair current={r.current.rop} recommended={r.recommended.rop} />
                </TableCell>
                <TableCell>
                  <ParamPair current={r.current.safetyStock} recommended={r.recommended.safetyStock} />
                </TableCell>
                <TableCell>
                  <ParamPair current={r.current.maxStock} recommended={r.recommended.maxStock} />
                </TableCell>
                <TableCell className="text-muted-foreground">{r.leadTimeDays}d</TableCell>
                <TableCell className="text-muted-foreground">{r.demandPattern}</TableCell>
                <TableCell>
                  <RiskBadge level={r.risk} />
                </TableCell>
                <TableCell>
                  <Link href={`/inventory-planning/recommendations/${r.id}`} className="hover:underline">
                    <StatusBadge tone={STATUS_TONE[r.status]}>{r.status}</StatusBadge>
                  </Link>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export function RecommendationsTable({
  recommendations,
  highlightRecommendationId,
}: {
  recommendations: Recommendation[]
  highlightRecommendationId?: string
}) {
  const [plant, setPlant] = useState<string>(ALL)
  const [circuit, setCircuit] = useState<string>(ALL)
  const [criticality, setCriticality] = useState<string>(ALL)
  const [status, setStatus] = useState<string>(ALL)
  const [risk, setRisk] = useState<string>(ALL)
  const [demandPattern, setDemandPattern] = useState<string>(ALL)

  const filtered = useMemo(() => {
    return recommendations.filter((r) => {
      if (plant !== ALL && r.plantId !== plant) return false
      if (circuit !== ALL && r.circuit !== circuit) return false
      if (criticality !== ALL && r.criticality !== criticality) return false
      if (status !== ALL && r.status !== status) return false
      if (risk !== ALL && r.risk !== risk) return false
      if (demandPattern !== ALL && r.demandPattern !== demandPattern) return false
      return true
    })
  }, [recommendations, plant, circuit, criticality, status, risk, demandPattern])

  return (
    <div className="flex flex-col gap-3">
      <FilterBar>
        <Select value={plant} onValueChange={(v) => setPlant(v ?? ALL)}>
          <SelectTrigger className="h-8 w-full sm:w-40">
            <SelectValue placeholder="Plant">
              {(v: string) => (v === ALL ? "All plants" : (getPlantById(v)?.name ?? v))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All plants</SelectItem>
            {PLANTS.map((p) => (
              <SelectItem key={p.plantId} value={p.plantId}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={circuit} onValueChange={(v) => setCircuit(v ?? ALL)}>
          <SelectTrigger className="h-8 w-full sm:w-36">
            <SelectValue placeholder="Circuit">
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
          <SelectTrigger className="h-8 w-full sm:w-36">
            <SelectValue placeholder="Criticality">
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

        <Select value={status} onValueChange={(v) => setStatus(v ?? ALL)}>
          <SelectTrigger className="h-8 w-full sm:w-40">
            <SelectValue placeholder="Status">
              {(v: string) => (v === ALL ? "All statuses" : v)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {RECOMMENDATION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={risk} onValueChange={(v) => setRisk(v ?? ALL)}>
          <SelectTrigger className="h-8 w-full sm:w-32">
            <SelectValue placeholder="Risk">
              {(v: string) => (v === ALL ? "All risk" : v.charAt(0).toUpperCase() + v.slice(1))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All risk</SelectItem>
            {RISK_LEVELS.map((r) => (
              <SelectItem key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={demandPattern} onValueChange={(v) => setDemandPattern(v ?? ALL)}>
          <SelectTrigger className="h-8 w-full sm:w-40">
            <SelectValue placeholder="Demand pattern">
              {(v: string) => (v === ALL ? "All demand patterns" : v)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All demand patterns</SelectItem>
            {DEMAND_PATTERNS.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      <RecommendationsTableView
        recommendations={filtered}
        highlightRecommendationId={highlightRecommendationId}
      />
    </div>
  )
}
