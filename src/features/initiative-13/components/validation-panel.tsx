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
import { formatApiDate, formatApiDateTime } from "@/lib/api/format"
import type { ValidationResult, Zmm065Source, Zmm065Validation } from "@/lib/api/i13"
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
  MATERIAL_NOT_IN_PLATFORM_DATA: "Material not in the platform's data (no goods movements at all)",
  LAST_ISSUE_BEFORE_PLATFORM_HISTORY:
    "Last issue is older than the movement history the platform holds",
  LAST_ISSUE_DATE_DIFFERS: "Platform and report have different last-issue dates",
  REPORT_HAS_NO_LAST_ISSUE: "Report shows no last issue; the platform finds one",
  REPORT_CLASSIFICATION_DIFFERS: "Same last issue, but ZMM065 classes it differently",
}

/** How many disagreeing rows are drawn; the backend sends at most 200. */
const ROWS_SHOWN = 25

const PLANT_LABEL: Record<string, string> = {
  "1300": "Black Mountain (1300)",
  "1500": "Gamsberg (1500)",
}

/**
 * Validation Views (FR-6, §13): the platform's aging bands reconciled against
 * ZMM065, which VZI uploads monthly (the seeded July report stands in for a
 * plant with no upload). Every comparison and tolerance decision is the
 * backend's (`app.initiatives.i13.report_validation`); this renders what comes
 * back. The 30-Day GR Report is deliberately not shown: validation here is
 * against ZMM065 only.
 */
export function ValidationPanel({ result }: { result: ValidationResult }) {
  const rows = result.results.filter((r) => r.sourceName.startsWith("ZMM065"))
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[11px] text-muted-foreground">
        Tolerance: {result.tolerancePct}% (still to be confirmed by VZI)
      </p>
      <SourcesNote sources={result.zmm065Sources} />
      {rows.length === 0 ? (
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
              {rows.map((r) => (
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
        <p className="text-[11px] text-muted-foreground">
          {result.zmm065ReportMonth
            ? "No ZMM065 report has been uploaded for this month."
            : "No ZMM065 report is loaded or uploaded yet."}
        </p>
      )}
    </div>
  )
}

/** Which report each plant was reconciled against -- an upload or the seeded July report. */
function SourcesNote({ sources }: { sources: Zmm065Source[] }) {
  if (sources.length === 0) return null
  return (
    <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
      {sources.map((s) => (
        <li key={s.plant}>
          <span className="font-medium text-foreground">{PLANT_LABEL[s.plant] ?? s.plant}:</span>{" "}
          {s.source === "UPLOAD" ? (
            <>
              {s.fileName}, report for {formatMonth(s.reportMonth)} (run {formatApiDate(s.reportDate)}),{" "}
              {formatCount(s.rowCount)} rows — uploaded by {s.uploadedBy} on {formatApiDateTime(s.uploadedAt)}
            </>
          ) : (
            <>
              seeded July 2026 report (run {formatApiDate(s.reportDate)}), {formatCount(s.rowCount)} rows — no
              monthly upload yet
            </>
          )}
        </li>
      ))}
    </ul>
  )
}

/** `2026-08-01` -> `Aug 2026`. */
export function formatMonth(iso: string | null): string {
  if (!iso) return "—"
  const [year, month] = iso.split("-").map(Number)
  if (!year || !month) return iso
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

function Zmm065Section({ detail }: { detail: Zmm065Validation }) {
  const excluded = Object.entries(detail.excludedNonAging)
  const reasons = Object.entries(detail.mismatchReasons).sort((a, b) => b[1] - a[1])
  const notInData = detail.mismatchReasons.MATERIAL_NOT_IN_PLATFORM_DATA ?? 0
  // Most of the report's materials missing is a coverage gap, not a set of
  // disagreements: the SAP data loaded is not the population ZMM065 was run on.
  const coverageGap = detail.compared > 0 && notInData * 2 > detail.compared
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
      {coverageGap && (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-foreground">
          {formatCount(notInData)} of {formatCount(detail.compared)} materials in this ZMM065 have no goods
          movements in the platform&apos;s SAP data. The data loaded does not cover what the report was run
          against, so these figures say more about data coverage than about aging.
        </p>
      )}
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
