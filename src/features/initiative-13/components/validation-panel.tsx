import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ValidationResult } from "@/lib/api/i13"
import { formatCount } from "@/lib/utils"

const STATUS_TONE: Record<string, "default" | "success" | "warning" | "danger"> = {
  MATCH: "success",
  WITHIN_TOLERANCE: "success",
  OUT_OF_TOLERANCE: "danger",
  REFERENCE_UNAVAILABLE: "default",
}

/**
 * Validation Views (§13): platform-computed counts reconciled against
 * ZMM065 and the 30-Day GR Report. All tolerance/match logic runs in the
 * backend (`app.initiatives.i13.reconciliation`) — this renders whatever
 * `ValidationResult` returns, including "Reference data unavailable" when
 * no reference count was supplied.
 */
export function ValidationPanel({ result }: { result: ValidationResult }) {
  return (
    <>
      <p className="text-[11px] text-muted-foreground">Tolerance: {result.tolerancePct}%</p>
      {result.results.length === 0 ? (
        <EmptyState title="No validation results available." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Computed</TableHead>
                <TableHead className="text-right">Reference</TableHead>
                <TableHead className="text-right">Difference</TableHead>
                <TableHead className="text-right">Difference %</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.results.map((r) => (
                <TableRow key={r.sourceName}>
                  <TableCell className="font-medium text-foreground">{r.sourceName}</TableCell>
                  <TableCell className="text-right text-foreground">{formatCount(r.computedCount)}</TableCell>
                  <TableCell className="text-right text-foreground">
                    {r.referenceCount !== null ? formatCount(r.referenceCount) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-foreground">
                    {r.absoluteDifference !== null ? formatCount(r.absoluteDifference) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-foreground">
                    {r.percentageDifference !== null ? `${r.percentageDifference}%` : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={STATUS_TONE[r.status] ?? "default"}>{r.status}</StatusBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  )
}
