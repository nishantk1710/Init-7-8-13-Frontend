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
import { formatApiDate } from "@/lib/api/format"
import type { Gr30DayValidation, ValidationResult, Zmm065Validation } from "@/lib/api/i13"
import { formatCount } from "@/lib/utils"

const STATUS_TONE: Record<string, "default" | "success" | "warning" | "danger"> = {
  RECONCILED: "success",
  OUT_OF_TOLERANCE: "danger",
  REFERENCE_UNAVAILABLE: "default",
}

const BAND_LABEL: Record<string, string> = {
  FAST: "Fast",
  SLOW: "Slow",
  NON_MOVING: "Non-moving",
}

/** What each backend mismatch reason means, in the words a reviewer needs. */
const ZMM065_REASON: Record<string, string> = {
  LAST_ISSUE_BEFORE_PLATFORM_HISTORY:
    "Last issue is older than the movement history the platform holds",
  LAST_ISSUE_DATE_DIFFERS: "Platform and report have different last-issue dates",
  REPORT_HAS_NO_LAST_ISSUE: "Report shows no last issue; the platform finds one",
  REPORT_CLASSIFICATION_DIFFERS: "Same last issue, but ZMM065 classes it differently",
}

const GR_STATUS: Record<string, string> = {
  PO_LINE_NOT_FOUND: "PO line not in the platform's data (plants 1300/1500)",
  NO_RECEIPT_ON_POST_DATE: "PO line found, but no goods receipt on that date",
}

/** How many disagreeing rows are drawn; the backend sends at most 200. */
const ROWS_SHOWN = 25

/**
 * Validation Views (FR-6, §13): the platform reconciled against ZMM065 and the
 * 30-Day GR Report, both read by the backend from its own database. Every
 * comparison and tolerance decision is the backend's
 * (`app.initiatives.i13.report_validation`); this renders what comes back.
 */
export function ValidationPanel({ result }: { result: ValidationResult }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[11px] text-muted-foreground">
        Tolerance: {result.tolerancePct}% (still to be confirmed by VZI)
      </p>
      {result.results.length === 0 ? (
        <EmptyState title="No validation results available." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Check</TableHead>
                <TableHead className="text-right">Platform</TableHead>
                <TableHead className="text-right">Report</TableHead>
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
                    {r.percentageDifference !== null ? `${r.percentageDifference.toFixed(1)}%` : "—"}
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

      {result.zmm065 ? (
        <Zmm065Section detail={result.zmm065} />
      ) : (
        <p className="text-[11px] text-muted-foreground">ZMM065 is not loaded in the backend.</p>
      )}
      {result.gr30Day ? (
        <Gr30DaySection detail={result.gr30Day} />
      ) : (
        <p className="text-[11px] text-muted-foreground">The 30-Day GR Report is not loaded in the backend.</p>
      )}
    </div>
  )
}

function Zmm065Section({ detail }: { detail: Zmm065Validation }) {
  const excluded = Object.entries(detail.excludedNonAging)
  const reasons = Object.entries(detail.mismatchReasons).sort((a, b) => b[1] - a[1])
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-foreground">ZMM065 aging</h3>
      <p className="text-xs text-muted-foreground">
        Bands compared as of the report&apos;s run date, {formatApiDate(detail.reportDate)}:{" "}
        <span className="font-medium text-foreground">
          {formatCount(detail.agreed)} of {formatCount(detail.compared)} agree
          {detail.agreementPct !== null ? ` (${detail.agreementPct}%)` : ""}
        </span>
        .
        {excluded.length > 0 &&
          ` Not compared, because they are statuses rather than aging bands: ${excluded
            .map(([status, n]) => `${status} ${formatCount(n)}`)
            .join(", ")}.`}
      </p>
      {reasons.length > 0 && (
        <ul className="list-inside list-disc text-xs text-muted-foreground">
          {reasons.map(([reason, n]) => (
            <li key={reason}>
              <span className="font-medium text-foreground">{formatCount(n)}</span>{" "}
              {ZMM065_REASON[reason] ?? reason}
            </li>
          ))}
        </ul>
      )}
      {detail.mismatches.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Plant</TableHead>
                <TableHead>ZMM065</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Report last issue</TableHead>
                <TableHead>Platform last issue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.mismatches.slice(0, ROWS_SHOWN).map((m) => (
                <TableRow key={`${m.material}-${m.plant}`}>
                  <TableCell className="font-medium text-foreground">{m.material}</TableCell>
                  <TableCell>{m.plant}</TableCell>
                  <TableCell>{BAND_LABEL[m.reportBand] ?? m.reportBand}</TableCell>
                  <TableCell>{BAND_LABEL[m.platformBand] ?? m.platformBand}</TableCell>
                  <TableCell>{formatApiDate(m.reportLastIssueDate)}</TableCell>
                  <TableCell>{formatApiDate(m.platformLastIssueDate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {detail.mismatches.length > ROWS_SHOWN && (
        <p className="text-[11px] text-muted-foreground">
          Showing {ROWS_SHOWN} of {formatCount(detail.compared - detail.agreed)} disagreements.
        </p>
      )}
    </section>
  )
}

function Gr30DaySection({ detail }: { detail: Gr30DayValidation }) {
  const plants = Object.keys(detail.plants).sort().join(", ") || "unknown"
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-foreground">30-Day GR Report receipts</h3>
      <p className="text-xs text-muted-foreground">
        Receipts posted {formatApiDate(detail.windowStart)} to {formatApiDate(detail.reportDate)}, plant{" "}
        {plants}:{" "}
        <span className="font-medium text-foreground">
          {formatCount(detail.confirmed)} of {formatCount(detail.rowsInReport)} confirmed
        </span>{" "}
        in the platform&apos;s SAP data (PO line present, goods receipt on the same date). For context, the
        platform holds {formatCount(detail.platformReceiptsInWindow)} receipts for the same plant and window.
        The report is a filtered list, so its total is not compared.
      </p>
      {detail.unconfirmed.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Posted</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>PO</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Why not confirmed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.unconfirmed.slice(0, ROWS_SHOWN).map((c) => (
                <TableRow key={`${c.poNumber}-${c.poItem}-${c.postDate}`}>
                  <TableCell>{formatApiDate(c.postDate)}</TableCell>
                  <TableCell className="font-medium text-foreground">{c.material}</TableCell>
                  <TableCell>{c.poNumber}</TableCell>
                  <TableCell>{c.poItem}</TableCell>
                  <TableCell>{GR_STATUS[c.status] ?? c.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}
