// Step 9 -- I07 Quarterly Deep-Dive Report frontend.
//
// Every report metric that can genuinely be unavailable carries an
// AvailabilityStatus alongside its value (see app/schemas/i7/reports.py's
// module docstring). This is the one shared renderer for that pairing --
// every section of the report reuses it rather than repeating the
// status-branching logic in its own JSX. AVAILABLE renders the real value;
// every other status renders a distinct, clearly-labeled state -- never a
// blank cell, never "0", never collapsed into one generic "N/A".

import { cn } from "@/lib/utils"
import type { ApiAvailabilityStatus } from "@/features/initiative-7/types/api"

const STATUS_LABEL: Record<ApiAvailabilityStatus, string> = {
  AVAILABLE: "Available",
  NOT_AVAILABLE: "Not available",
  NOT_CONFIGURED: "Not configured",
  UNKNOWN: "Unknown",
  NOT_EVALUABLE: "Not evaluable",
}

/** Short explanatory text shown under the status label when there is no
 * value to anchor it to (e.g. a table cell) -- kept brief; the fuller
 * rationale for a section-wide status lives in that section's own copy or
 * the Limitations section. */
const STATUS_HINT: Record<ApiAvailabilityStatus, string> = {
  AVAILABLE: "",
  NOT_AVAILABLE: "Measured -- no data",
  NOT_CONFIGURED: "Policy not yet set",
  UNKNOWN: "Never measured",
  NOT_EVALUABLE: "Blocked upstream",
}

const STATUS_CLASSES: Record<ApiAvailabilityStatus, string> = {
  AVAILABLE: "text-foreground",
  NOT_AVAILABLE: "text-muted-foreground",
  NOT_CONFIGURED: "text-warning",
  UNKNOWN: "text-muted-foreground",
  NOT_EVALUABLE: "text-muted-foreground",
}

const STATUS_DOT_CLASSES: Record<ApiAvailabilityStatus, string> = {
  AVAILABLE: "bg-success",
  NOT_AVAILABLE: "bg-muted-foreground/50",
  NOT_CONFIGURED: "bg-warning",
  UNKNOWN: "bg-muted-foreground/50",
  NOT_EVALUABLE: "bg-muted-foreground/50",
}

/** `value` is whatever the caller already formatted (e.g. a `toDisplayNumber`
 * result with `unit` appended) -- this component does not itself parse
 * ApiDecimal strings, since some callers (e.g. counts) have no decimal to
 * parse at all. When `status` is not AVAILABLE, `value` is ignored even if
 * present, so a stray non-null value paired with a non-AVAILABLE status
 * (which should not happen per the backend's own contract, but must never be
 * silently trusted) can never render as if it were real. */
export function AvailabilityValue({
  status,
  value,
  unit,
  size = "md",
  className,
}: {
  status: ApiAvailabilityStatus
  value?: string | number | null
  unit?: string
  size?: "sm" | "md"
  className?: string
}) {
  const isAvailable = status === "AVAILABLE"
  const hasValue = isAvailable && value !== null && value !== undefined && value !== ""

  return (
    <span className={cn("inline-flex flex-col", size === "sm" ? "gap-0" : "gap-0.5", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 font-medium tabular-nums",
          size === "sm" ? "text-sm" : "text-base",
          STATUS_CLASSES[status],
        )}
      >
        {!isAvailable && (
          <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT_CLASSES[status])} aria-hidden />
        )}
        {hasValue ? (
          <>
            {value}
            {unit && <span className="text-muted-foreground font-normal">{unit}</span>}
          </>
        ) : (
          STATUS_LABEL[status]
        )}
      </span>
      {!isAvailable && STATUS_HINT[status] && (
        <span className="text-[11px] text-muted-foreground">{STATUS_HINT[status]}</span>
      )}
      {isAvailable && !hasValue && (
        <span className="text-[11px] text-muted-foreground">No rows in scope</span>
      )}
    </span>
  )
}

/** Parses an ApiDecimal ("502.7342...", a number, or null) into a
 * display-ready string with fixed precision -- never coerces null to 0.
 * Mirrors i7-api.ts's toNumber() but returns a formatted string directly
 * since AvailabilityValue only ever renders, never computes further. */
export function formatDecimal(value: string | number | null, decimals = 2): string | null {
  if (value === null || value === undefined) return null
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(parsed)) return null
  return parsed.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: decimals })
}
