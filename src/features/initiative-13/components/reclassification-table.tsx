"use client"

import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { StatusBadge } from "@/components/shared/status-badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { initiative7Manifest } from "@/features/initiative-7/manifest"
import type { ReclassificationCandidate } from "@/lib/api/i13"
import { useMaterial360 } from "@/lib/material-360-context"
import { getMaterialById } from "@/lib/shared-data/material-catalog"

function Indicator({ value }: { value: boolean | null }) {
  if (value === null) return <span className="text-muted-foreground">Unknown</span>
  return (
    <StatusBadge tone={value ? "warning" : "default"}>{value ? "Yes" : "No"}</StatusBadge>
  )
}

export function ReclassificationTable({ candidates }: { candidates: ReclassificationCandidate[] }) {
  const { openMaterial360 } = useMaterial360()

  if (candidates.length === 0) {
    return (
      <EmptyState
        title="No reclassification candidates currently available."
        description="No OAR material+plant position currently meets the backend's reclassification criteria."
      />
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Material</TableHead>
            <TableHead>Plant</TableHead>
            <TableHead className="text-right">Consumption (12m)</TableHead>
            <TableHead>{">4"} threshold</TableHead>
            <TableHead>Critical impact</TableHead>
            <TableHead>HOD-justified</TableHead>
            <TableHead>Candidate</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {candidates.map((c) => {
            const catalogMaterial = getMaterialById(c.material)
            return (
              <TableRow key={`${c.material}-${c.plant}`}>
                <TableCell>
                  {catalogMaterial ? (
                    <MaterialIdentity
                      material={{ materialId: catalogMaterial.id, materialCode: catalogMaterial.id, description: catalogMaterial.description }}
                      onOpen={openMaterial360}
                    />
                  ) : (
                    <span className="font-medium text-foreground">{c.material}</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{c.plant}</TableCell>
                <TableCell className="text-right text-foreground">{c.consumptionCount12m}</TableCell>
                <TableCell>
                  <StatusBadge tone={c.consumedMoreThanThreshold ? "warning" : "default"}>
                    {c.consumedMoreThanThreshold ? "Yes" : "No"}
                  </StatusBadge>
                </TableCell>
                <TableCell>
                  <Indicator value={c.criticalImpactIndicator} />
                </TableCell>
                <TableCell>
                  <Indicator value={c.hodJustifiedRequestIndicator} />
                </TableCell>
                <TableCell className="max-w-[280px] text-muted-foreground">
                  <StatusBadge tone={c.candidateFlag ? "warning" : "default"} className="mb-1">
                    {c.candidateFlag ? "ADVISORY / RECLASSIFICATION CANDIDATE" : "Retain / Monitor"}
                  </StatusBadge>
                  {c.candidateReasons.length > 0 && (
                    <ul className="list-inside list-disc">
                      {c.candidateReasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  )}
                  {!c.dataAvailable && (
                    <div className="mt-1 italic">Supporting indicator data not yet available.</div>
                  )}
                </TableCell>
                <TableCell>
                  {c.candidateFlag && (
                    /*
                      Mock integration event / navigation link — cross-initiative
                      communication happens via a plain URL, never by importing
                      an Initiative 7 component. Initiative 7 owns rendering
                      whatever lands on this route with this query param.
                    */
                    <Link
                      href={`/inventory-planning/recommendations?reviewMaterial=${c.material}`}
                      className={buttonVariants({ variant: "outline", size: "xs" })}
                    >
                      Review in {initiative7Manifest.name}
                      <ArrowUpRight className="size-3" />
                    </Link>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
