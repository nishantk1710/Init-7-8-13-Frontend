"use client"

import Link from "next/link"
import { useState } from "react"

import { AlertBanner } from "@/components/shared/alert-banner"
import { SAPDocumentChip } from "@/components/shared/sap-document-chip"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
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
import {
  DEFAULT_MATERIAL,
  DEFAULT_PLANT,
  GUARD_EXAMPLES,
  GUARD_PLANTS,
  loadRepairableUnit,
  repairableUnitVerdict,
  type RepairableUnitAnswer,
} from "@/features/initiative-8/data/live-repairable-unit"
import { UNKNOWN } from "@/features/initiative-8/utils/status"
import { ApiError } from "@/lib/api/client"

export type DuplicateGuardFlowProps = {
  /** The answer for the default material, fetched on the server so the page
   *  opens on a real result rather than an empty form. */
  initialAnswer?: RepairableUnitAnswer | null
  /** Set when that first check failed — shown as a failure, never as "no
   *  unit found". */
  initialError?: string | null
}

/**
 * FR-6, live: before a new unit of a repairable material is requested, is
 * there already one at the plant — in stock or on a repair order?
 *
 * Reads `GET /api/i8/repairable-unit`, which answers from the register and the
 * stock extract, and shows the backend's headline, the numbers behind it, the
 * open repair lines it rests on, and its caveats. Advisory only: the check
 * never blocks a request, and nothing on this screen writes anywhere. A reason
 * for buying new anyway is captured by the Spares Assistant at reservation
 * time (FR-7), not here.
 */
export function DuplicateGuardFlow({
  initialAnswer = null,
  initialError = null,
}: DuplicateGuardFlowProps = {}) {
  const [material, setMaterial] = useState(DEFAULT_MATERIAL)
  const [plant, setPlant] = useState(DEFAULT_PLANT)
  const [answer, setAnswer] = useState<RepairableUnitAnswer | null>(initialAnswer)
  const [error, setError] = useState<string | null>(initialError)
  const [checking, setChecking] = useState(false)

  async function check(nextMaterial = material, nextPlant = plant) {
    if (!nextMaterial.trim()) return
    setChecking(true)
    setError(null)
    try {
      setAnswer(await loadRepairableUnit(nextMaterial, nextPlant))
    } catch (failure) {
      setAnswer(null)
      setError(
        failure instanceof ApiError
          ? failure.detailText()
          : failure instanceof Error
            ? failure.message
            : String(failure)
      )
    } finally {
      setChecking(false)
    }
  }

  function tryExample(example: { material: string; plant: string }) {
    setMaterial(example.material)
    setPlant(example.plant)
    void check(example.material, example.plant)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-1 text-sm font-medium text-foreground">New procurement attempt</div>
        <p className="mb-3 text-xs text-muted-foreground">
          Enter the material somebody wants to buy new. The check looks for a repairable unit of
          it at the plant — in stock, or out on a repair order — before the request goes further.
        </p>
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            void check()
          }}
        >
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted-foreground" htmlFor="guard-material">
              Material number
            </label>
            <Input
              id="guard-material"
              className="h-9"
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder="e.g. 8000004665"
            />
          </div>
          <div className="sm:w-56">
            <label className="mb-1 block text-xs text-muted-foreground">Plant</label>
            <Select value={plant} onValueChange={(v) => v && setPlant(v)}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue>
                  {(value: string) => {
                    const known = GUARD_PLANTS.find((p) => p.plantId === value)
                    return known ? `${known.plantId} — ${known.name}` : value
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {GUARD_PLANTS.map((p) => (
                  <SelectItem key={p.plantId} value={p.plantId}>
                    {p.plantId} — {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="h-9" disabled={checking || !material.trim()}>
            {checking ? "Checking…" : "Check for an existing unit"}
          </Button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span>Real examples:</span>
          {GUARD_EXAMPLES.map((example) => (
            <Button
              key={example.material}
              size="xs"
              variant="outline"
              onClick={() => tryExample(example)}
              disabled={checking}
            >
              {example.material} — {example.label}
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <AlertBanner tone="critical" title="The check could not be completed">
          <p>{error}</p>
          <p className="mt-1">
            This is not &ldquo;no unit found&rdquo; — the request failed, so nothing is known
            either way.
          </p>
        </AlertBanner>
      )}

      {answer && !error && <Answer answer={answer} />}
    </div>
  )
}

function Answer({ answer }: { answer: RepairableUnitAnswer }) {
  const verdict = repairableUnitVerdict(answer)
  const plantName = GUARD_PLANTS.find((p) => p.plantId === answer.plant)?.name

  return (
    <div className="flex flex-col gap-4">
      <AlertBanner tone={verdict.tone} title={verdict.title}>
        {/* The backend's sentence, as written -- it is composed to be shown. */}
        <p className="text-sm">{answer.headline}</p>
        <p className="mt-1">
          {answer.materialId} at {answer.plant}
          {plantName ? ` ${plantName}` : ""}, as at {answer.referenceDate}. Advisory only — this
          never blocks the request.
        </p>
      </AlertBanner>

      {answer.isRepairableMaterial && (
        <div className="rounded-xl border border-border bg-card p-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Found in</dt>
              <dd className="mt-0.5 flex flex-wrap gap-1">
                {answer.sources.length > 0 ? (
                  answer.sources.map((source) => (
                    <StatusBadge key={source} tone="warning">
                      {source}
                    </StatusBadge>
                  ))
                ) : (
                  <span className="text-foreground">Neither stock nor a repair order</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Stock on hand</dt>
              <dd className="mt-0.5 text-foreground">
                {answer.stockOnHand === undefined
                  ? "Unknown — no stock record"
                  : `${answer.stockOnHand} across ${answer.stockLocations} storage location${answer.stockLocations === 1 ? "" : "s"}`}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Open repair lines</dt>
              <dd className="mt-0.5 text-foreground">
                {answer.openRepairLines} ({answer.quantityUnderRepair} under repair)
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Soonest due back</dt>
              <dd className="mt-0.5 text-foreground">
                {answer.soonestDueDate ??
                  (answer.openRepairLines > 0 ? "No return date agreed" : UNKNOWN)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Past the promised date</dt>
              <dd
                className={
                  answer.overdueLines > 0 ? "mt-0.5 font-medium text-destructive" : "mt-0.5 text-foreground"
                }
              >
                {answer.overdueLines} of {answer.openRepairLines} open line
                {answer.openRepairLines === 1 ? "" : "s"}
              </dd>
            </div>
          </dl>

          {answer.caveats.length > 0 && (
            <div className="mt-3 border-t border-dashed border-border pt-3">
              <div className="text-xs font-medium text-foreground">What this does not prove</div>
              <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
                {answer.caveats.map((caveat) => (
                  <li key={caveat}>{caveat}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {answer.evidence.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card p-4">
          <div className="mb-2 text-sm font-medium text-foreground">Open repair lines</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Repair PO</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Raised</TableHead>
                <TableHead>Due Back</TableHead>
                <TableHead className="text-right">Days Overdue</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dispatch On Record</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {answer.evidence.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>
                    <Link
                      href={`/repairable-spares/repair-register/${line.id}`}
                      className="hover:underline"
                      title="Open this repair line in the register"
                    >
                      <SAPDocumentChip doc={line.repairPO} />
                    </Link>
                  </TableCell>
                  <TableCell className="text-right text-foreground">
                    {line.quantity ?? UNKNOWN}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{line.raisedAt ?? UNKNOWN}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {line.dueDate ?? "No return date agreed"}
                  </TableCell>
                  <TableCell
                    className={
                      line.daysOverdue !== undefined && line.daysOverdue > 0
                        ? "text-right font-medium text-destructive"
                        : "text-right text-muted-foreground"
                    }
                  >
                    {line.daysOverdue !== undefined && line.daysOverdue > 0 ? line.daysOverdue : UNKNOWN}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-muted-foreground">
                    {line.vendor}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{line.status}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {line.dispatched ? "Yes" : "No"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {answer.exists && (
        <p className="text-xs text-muted-foreground">
          If a new unit is still needed, the reason is captured by the Spares Assistant when the
          reservation is made and appears on the{" "}
          <Link href="/repairable-spares/justifications" className="text-primary hover:underline">
            Justifications
          </Link>{" "}
          log. A purchase made while a repair is open with no justification on record is raised on
          the{" "}
          <Link href="/repairable-spares/exceptions" className="text-primary hover:underline">
            Exception Queue
          </Link>
          .
        </p>
      )}
    </div>
  )
}
