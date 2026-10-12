"use client"

import { MaterialIdentity } from "@/components/shared/material-identity"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { DeclarationLogRow } from "@/features/initiative-8/data/live-declarations"
import { downloadCsv } from "@/lib/utils"
import { useMaterial360 } from "@/lib/material-360-context"

/**
 * What was actually declared — the other half of FR-4.
 *
 * The queue beside this answers "who still owes a declaration". This answers
 * "what was judged, by whom, on what", and it is the only place the FR-4
 * fields the queue has no room for are visible: quantity, fault category, the
 * condition description somebody typed, and the optional serial.
 *
 * ## Superseded rows are shown, not hidden
 *
 * An attestation is never edited or deleted — the database blocks both. An
 * amendment is a NEW row pointing at the one it replaces, and the original
 * stays readable forever, because the chain IS the audit trail. Hiding the
 * amended row would leave a chain with a link missing, so both are listed and
 * the superseded one is marked.
 */
export type DeclarationLogTableProps = {
  rows: DeclarationLogRow[]
}

export function DeclarationLogTable({ rows }: DeclarationLogTableProps) {
  const { openMaterial360 } = useMaterial360()

  function exportCsv() {
    downloadCsv(
      "i08-declaration-log.csv",
      [
        "Declared At",
        "Material",
        "Description",
        "Plant",
        "Qty",
        "Condition",
        "Fault Category",
        "Condition Description",
        "Serial",
        "Declared By",
        "Amendment",
        "Superseded",
      ],
      rows.map((r) => [
        r.attestedAt ?? "",
        r.material.materialCode,
        r.material.description ?? "",
        r.plant?.name ?? r.plant?.plantId ?? "",
        r.quantity,
        r.condition,
        r.faultCategory,
        r.conditionDescription,
        r.serialNumber ?? "",
        r.attestor,
        r.isAmendment ? "Yes" : "No",
        r.supersededBy ? "Yes" : "No",
      ])
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No condition declarations have been recorded yet. The form is on each
        repair line&rsquo;s detail page.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {rows.length} declaration{rows.length === 1 ? "" : "s"} recorded.
          Nothing here can be edited or deleted &mdash; an amendment is a new
          row pointing at the one it replaces, and both stay readable.
        </p>
        <Button size="sm" variant="outline" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Declared</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Plant</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead>Fault Category</TableHead>
              <TableHead>Condition Description</TableHead>
              <TableHead>Serial</TableHead>
              <TableHead>Declared By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow
                key={r.id}
                className={r.supersededBy ? "opacity-60" : undefined}
              >
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {r.attestedAt ?? "—"}
                  <div className="flex flex-wrap gap-1">
                    {r.isAmendment && (
                      <StatusBadge tone="default">Amendment</StatusBadge>
                    )}
                    {r.supersededBy && (
                      <StatusBadge tone="warning">Superseded</StatusBadge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <MaterialIdentity
                    material={r.material}
                    onOpen={openMaterial360}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {r.plant?.name ?? r.plant?.plantId ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-foreground">
                  {r.quantity}
                </TableCell>
                <TableCell className="text-foreground">{r.condition}</TableCell>
                <TableCell className="text-muted-foreground">
                  {r.faultCategory}
                </TableCell>
                <TableCell
                  className="max-w-[320px] truncate text-muted-foreground"
                  title={r.conditionDescription}
                >
                  {r.conditionDescription}
                </TableCell>
                {/* Optional, and optional on purpose: I08 works at
                    material-plant grain today and serial grain is where it is
                    going. Capturing it when somebody knows it costs nothing
                    now and is unrecoverable later. */}
                <TableCell className="text-muted-foreground">
                  {r.serialNumber ?? "—"}
                </TableCell>
                {/* There is no sign-in, so this is whatever the server
                    stamped. Shown as recorded rather than prettied up: a
                    placeholder that looks like a name is worse than one that
                    looks like a placeholder. */}
                <TableCell className="text-muted-foreground">
                  {r.attestor}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
