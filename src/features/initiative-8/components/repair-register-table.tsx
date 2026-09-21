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
import type {
  AgingBucket,
  DeclarationStatus,
  RepairChain,
  RepairStatus,
} from "@/features/initiative-8/types/repair"
import {
  DECLARATION_STATUS_TONE,
  DEFAULT_AGING_BUCKETS,
  RECEIPT_STATUS_TONE,
  UNKNOWN,
  isBeyondLeadTime,
  orUnknown,
  vendorLabel,
} from "@/features/initiative-8/utils/status"
import { useMaterial360 } from "@/lib/material-360-context"

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

/** A plant the filter can offer. Structurally `PlantReference`, but the live
 *  plants come from the data rather than from `lib/shared-data/plants`, whose
 *  ids (PLANT-GBG) do not exist in the backend (1300). */
type PlantOption = { plantId: string; name: string }

export type RepairRegisterTableProps = {
  /** The rows to render — always from the backend. There is no fixture
   *  fallback: an empty array means the register really is empty, and a
   *  failure is reported through `loadError` instead. */
  chains?: RepairChain[]
  plantOptions?: PlantOption[]
  vendorOptions?: string[]
  /** The active aging bands, from `LiveRegister.agingBands` in live mode.
   *  Defaults to the fixed bands the fixtures were written against. */
  agingBands?: string[]
  /**
   * Set when the rows could not be loaded.
   *
   * Rendered as a visible failure, never as an empty table. "No repairs match
   * these filters" and "the server could not be reached" are different
   * statements, and showing the second as the first is how a broken demo looks
   * like a clean answer.
   */
  loadError?: string | null
}

export function RepairRegisterTable({
  chains = [],
  plantOptions = [],
  vendorOptions = [],
  agingBands = DEFAULT_AGING_BUCKETS,
  loadError = null,
}: RepairRegisterTableProps = {}) {
  const { openMaterial360 } = useMaterial360()
  const [plant, setPlant] = useState<string>(ALL)
  const [vendor, setVendor] = useState<string>(ALL)
  const [repairStatus, setRepairStatus] = useState<RepairStatus | typeof ALL>(ALL)
  const [declarationStatus, setDeclarationStatus] = useState<DeclarationStatus | typeof ALL>(ALL)
  const [aging, setAging] = useState<AgingBucket | typeof ALL>(ALL)

  // Unchanged apart from reading the prop: the same client-side filter over the
  // full array the table has always done. 1,225 rows is comfortably small
  // enough for that, so the backend's server-side filter parameters can wait.
  const filtered = useMemo(() => {
    return chains.filter((c) => {
      if (plant !== ALL && c.plant.plantId !== plant) return false
      if (vendor !== ALL && vendorLabel(c) !== vendor) return false
      if (repairStatus !== ALL && c.repairStatus !== repairStatus) return false
      if (declarationStatus !== ALL && c.declarationStatus !== declarationStatus) return false
      if (aging !== ALL && c.agingBucket !== aging) return false
      return true
    })
  }, [chains, plant, vendor, repairStatus, declarationStatus, aging])

  if (loadError) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center text-sm"
      >
        <p className="font-medium text-foreground">The repair register could not be loaded.</p>
        <p className="mt-1 text-muted-foreground">{loadError}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          This is not an empty register — it is a failed request. Check that the
          backend is running and that NEXT_PUBLIC_API_BASE_URL points at it.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <Select value={plant} onValueChange={(v) => setPlant(v ?? ALL)}>
          <SelectTrigger className="h-9 w-full sm:w-44">
            <SelectValue placeholder="Plant">
              {(value: string) =>
                value === ALL
                  ? "All plants"
                  : plantOptions.find((p) => p.plantId === value)?.name ?? value
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All plants</SelectItem>
            {plantOptions.map((p) => (
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
            {vendorOptions.map((v) => (
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
            {agingBands.map((b) => (
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
                  <TableCell className="text-right text-foreground">
                    {orUnknown(c.stockOnHand)}
                  </TableCell>
                  {/* Undefined for every Gamsberg material -- MARC covers plants
                      1300 and 1200 only. A dash, never a 0. */}
                  <TableCell className="text-right text-muted-foreground">
                    {orUnknown(c.reorderPoint)}
                  </TableCell>
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
                    {vendorLabel(c)}
                  </TableCell>
                  <TableCell className="text-right text-foreground">{c.qtyUnderRepair}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.expectedReturn ?? UNKNOWN}
                  </TableCell>
                  {/* The lead-time highlight. Days open stays the number on
                      show -- the ruling was to keep the aging and mark it when
                      it runs past the material's planned delivery time, not to
                      replace it with a verdict. The cell says by how much and
                      against what, because "90" in red is an accusation
                      without evidence. */}
                  <TableCell
                    className={
                      isBeyondLeadTime(c)
                        ? "text-right font-medium text-warning"
                        : "text-right text-foreground"
                    }
                    title={
                      isBeyondLeadTime(c)
                        ? `${c.daysOverLeadTime} days past the ${c.leadTimeDays}-day planned delivery time for this material`
                        : undefined
                    }
                  >
                    {c.daysOpen}
                  </TableCell>
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
