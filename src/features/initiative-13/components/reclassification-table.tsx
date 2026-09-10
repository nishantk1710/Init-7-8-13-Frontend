"use client"

import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { MaterialIdentity } from "@/components/shared/material-identity"
import { StatusBadge } from "@/components/shared/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { initiative7Manifest } from "@/features/initiative-7/manifest"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useMaterial360 } from "@/lib/material-360-context"
import type { ReclassificationCandidate } from "@/features/initiative-13/types/oar"

export function ReclassificationTable({ candidates }: { candidates: ReclassificationCandidate[] }) {
  const { openMaterial360 } = useMaterial360()

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Material</TableHead>
            <TableHead>Consumption Frequency</TableHead>
            <TableHead className="text-right">Annual Requests</TableHead>
            <TableHead className="text-right">Annual Issues</TableHead>
            <TableHead className="text-right">Sites</TableHead>
            <TableHead className="text-right">Utilization Rate</TableHead>
            <TableHead>Recommendation</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {candidates.map((c) => {
            const isCandidate = c.recommendation.startsWith("Candidate")
            return (
              <TableRow key={c.id}>
                <TableCell>
                  <MaterialIdentity material={c.material} onOpen={openMaterial360} />
                </TableCell>
                <TableCell className="text-muted-foreground">{c.consumptionFrequency}</TableCell>
                <TableCell className="text-right text-foreground">{c.annualRequests}</TableCell>
                <TableCell className="text-right text-foreground">{c.annualIssues}</TableCell>
                <TableCell className="text-right text-foreground">{c.sites}</TableCell>
                <TableCell className="text-right text-foreground">{c.utilizationRate}%</TableCell>
                <TableCell className="max-w-[280px] text-muted-foreground">
                  <StatusBadge tone={isCandidate ? "warning" : "default"} className="mb-1">
                    {isCandidate ? "Candidate" : "Retain / Monitor"}
                  </StatusBadge>
                  <div>{c.recommendation}</div>
                </TableCell>
                <TableCell>
                  {/*
                    Mock integration event / navigation link — cross-initiative
                    communication happens via a plain URL, never by importing
                    an Initiative 7 component. Initiative 7 owns rendering
                    whatever lands on this route with this query param. The
                    label uses the manifest's product-facing name rather than
                    the internal "Initiative 7" codename.
                  */}
                  <Link
                    href={`/inventory-planning/recommendations?reviewMaterial=${c.material.materialId}`}
                    className={buttonVariants({ variant: "outline", size: "xs" })}
                  >
                    Review in {initiative7Manifest.name}
                    <ArrowUpRight className="size-3" />
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
