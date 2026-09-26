"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

import { PriceDisplay } from "@/components/shared/price-display"
import { StatusBadge } from "@/components/shared/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { LifecycleStatus, Material } from "@/lib/types"

const LIFECYCLE_TONE: Record<LifecycleStatus, "success" | "warning" | "danger"> = {
  Active: "success",
  EOL: "warning",
  Obsolete: "danger",
}

export function MaterialTable({ materials }: { materials: Material[] }) {
  const router = useRouter()

  if (materials.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No materials match these filters.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Material code</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Manufacturer part no.</TableHead>
          <TableHead>Last vendor</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Lifecycle</TableHead>
          <TableHead className="text-right">Last PO price</TableHead>
          <TableHead className="text-right">Stock</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {materials.map((material) => (
          <TableRow
            key={material.id}
            className="cursor-pointer"
            // `/chat` was retired in phase 5 of WS7 — the assistant lands at
            // /assistant instead. `Material` carries no plant field, and
            // stock, repairs and cover are all held per plant, so this opens
            // the assistant's opener with the material filled in rather than
            // a session directly (matching the rule AskAssistantLink
            // documents for a plant-less caller): the planner picks the site
            // instead of the platform guessing it.
            onClick={() =>
              router.push(`/assistant?material=${encodeURIComponent(material.id)}`)
            }
          >
            <TableCell>
              <Link
                href={`/assistant?material=${encodeURIComponent(material.id)}`}
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-primary hover:underline"
              >
                {material.id}
              </Link>
            </TableCell>
            <TableCell className="max-w-[220px] truncate text-foreground">
              {material.description}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {material.manufacturerPartNo}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {material.lastVendor}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {material.category}
            </TableCell>
            <TableCell>
              <StatusBadge tone={LIFECYCLE_TONE[material.lifecycleStatus]}>
                {material.lifecycleStatus}
              </StatusBadge>
            </TableCell>
            <TableCell className="text-right">
              <PriceDisplay amount={material.lastPoPrice} />
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              {material.stockLevel}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
