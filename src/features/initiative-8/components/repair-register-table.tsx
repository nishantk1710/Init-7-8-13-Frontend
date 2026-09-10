"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ChevronRight } from "lucide-react"

import { FilterBar } from "@/components/shared/filter-bar"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { SAPDocumentChip } from "@/components/shared/sap-document-chip"
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
import { REPAIR_CHAINS, REPAIR_VENDORS } from "@/features/initiative-8/data/repair-chains"
import type { AgingBucket, DeclarationStatus, RepairStatus } from "@/features/initiative-8/types/repair"
import { AGING_BUCKETS, DECLARATION_STATUS_TONE, RECEIPT_STATUS_TONE } from "@/features/initiative-8/utils/status"
import { useMaterial360 } from "@/lib/material-360-context"
import { PLANTS } from "@/lib/shared-data/plants"

const ALL = "all"

const REPAIR_STATUSES: RepairStatus[] = [
  "PR Raised",
  "PO Issued",
  "At Vendor",
  "In Transit Return",
  "Received",
  "Closed",
]

const DECLARATION_STATUSES: DeclarationStatus[] = ["Required", "Pending", "Completed", "Flagged"]

export function RepairRegisterTable() {
  const { openMaterial360 } = useMaterial360()
  const [plant, setPlant] = useState<string>(ALL)
  const [vendor, setVendor] = useState<string>(ALL)
  const [repairStatus, setRepairStatus] = useState<RepairStatus | typeof ALL>(ALL)
  const [declarationStatus, setDeclarationStatus] = useState<DeclarationStatus | typeof ALL>(ALL)
  const [aging, setAging] = useState<AgingBucket | typeof ALL>(ALL)

  const filtered = useMemo(() => {
    return REPAIR_CHAINS.filter((c) => {
      if (plant !== ALL && c.plant.plantId !== plant) return false
      if (vendor !== ALL && c.vendor !== vendor) return false
      if (repairStatus !== ALL && c.repairStatus !== repairStatus) return false
      if (declarationStatus !== ALL && c.declarationStatus !== declarationStatus) return false
      if (aging !== ALL && c.agingBucket !== aging) return false
      return true
    })
  }, [plant, vendor, repairStatus, declarationStatus, aging])

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <Select value={plant} onValueChange={(v) => setPlant(v ?? ALL)}>
          <SelectTrigger className="h-9 w-full sm:w-44">
            <SelectValue placeholder="Plant">
              {(value: string) =>
                value === ALL ? "All plants" : PLANTS.find((p) => p.plantId === value)?.name ?? value
              }
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

        <Select value={vendor} onValueChange={(v) => setVendor(v ?? ALL)}>
          <SelectTrigger className="h-9 w-full sm:w-52">
            <SelectValue placeholder="Vendor">
              {(value: string) => (value === ALL ? "All vendors" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All vendors</SelectItem>
            {REPAIR_VENDORS.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={repairStatus}
          onValueChange={(v) => setRepairStatus(v as RepairStatus | typeof ALL)}
        >
          <SelectTrigger className="h-9 w-full sm:w-44">
            <SelectValue placeholder="Repair status">
              {(value: string) => (value === ALL ? "All repair statuses" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All repair statuses</SelectItem>
            {REPAIR_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={declarationStatus}
          onValueChange={(v) => setDeclarationStatus(v as DeclarationStatus | typeof ALL)}
        >
          <SelectTrigger className="h-9 w-full sm:w-48">
            <SelectValue placeholder="Declaration status">
              {(value: string) => (value === ALL ? "All declaration statuses" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All declaration statuses</SelectItem>
            {DECLARATION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={aging} onValueChange={(v) => setAging(v as AgingBucket | typeof ALL)}>
          <SelectTrigger className="h-9 w-full sm:w-40">
            <SelectValue placeholder="Aging">
              {(value: string) => (value === ALL ? "All aging" : `${value} days`)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All aging</SelectItem>
            {AGING_BUCKETS.map((b) => (
              <SelectItem key={b} value={b}>
                {b} days
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No repair chains match these filters.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Plant</TableHead>
                <TableHead className="text-right">SOH</TableHead>
                <TableHead className="text-right">ROP</TableHead>
                <TableHead>Repair PR</TableHead>
                <TableHead>Repair PO</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Qty Under Repair</TableHead>
                <TableHead>Expected Return</TableHead>
                <TableHead className="text-right">Days Open</TableHead>
                <TableHead>Receipt Status</TableHead>
                <TableHead>Declaration Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <MaterialIdentity material={c.material} onOpen={openMaterial360} />
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate text-muted-foreground">
                    {c.material.description}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.plant.name}</TableCell>
                  <TableCell className="text-right text-foreground">{c.stockOnHand}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{c.reorderPoint}</TableCell>
                  <TableCell>
                    <SAPDocumentChip doc={c.repairPR} />
                  </TableCell>
                  <TableCell>
                    {c.repairPO ? (
                      <SAPDocumentChip doc={c.repairPO} />
                    ) : (
                      <span className="text-xs text-muted-foreground">Not yet raised</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate text-muted-foreground">
                    {c.vendor}
                  </TableCell>
                  <TableCell className="text-right text-foreground">{c.qtyUnderRepair}</TableCell>
                  <TableCell className="text-muted-foreground">{c.expectedReturn}</TableCell>
                  <TableCell className="text-right text-foreground">{c.daysOpen}</TableCell>
                  <TableCell>
                    <StatusBadge tone={RECEIPT_STATUS_TONE[c.receiptStatus]}>
                      {c.receiptStatus}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={DECLARATION_STATUS_TONE[c.declarationStatus]}>
                      {c.declarationStatus}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/repairable-spares/repair-register/${c.id}`}
                      className={buttonVariants({ variant: "ghost", size: "xs" })}
                    >
                      View
                      <ChevronRight className="size-3.5" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
