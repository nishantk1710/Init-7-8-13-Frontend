import { PageHeader } from "@demo/components/shared/page-header"
import { ExceptionQueueTable } from "@demo/features/initiative-8/components/exception-queue-table"
import { EXCEPTIONS, EXCEPTION_CHECKS } from "@demo/features/initiative-8/data/exceptions"
import { REFERENCE_DATE } from "@demo/features/initiative-8/data/repair-chains"
import { exceptionTypeLabel } from "@demo/features/initiative-8/utils/status"
import { formatCount } from "@demo/lib/utils"

const DESCRIPTION =
  "Repair lines sent out with no condition assessment, and new units bought " +
  "while a repair was open with no justification on record."

export function ExceptionQueuePage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-[1920px] flex-col gap-4">
        <PageHeader title="Exception Queue" description={DESCRIPTION} />
        <ExceptionCounts />
        <ExceptionQueueTable />
      </div>
    </div>
  )
}

/** The headline numbers, always together, then what each check looked at. */
function ExceptionCounts() {
  const actionable = EXCEPTIONS.filter((e) => !e.preAutomation).length
  const preAutomation = EXCEPTIONS.length - actionable
  const byType = new Map<string, number>()
  for (const e of EXCEPTIONS) byType.set(e.type, (byType.get(e.type) ?? 0) + 1)
  const checks = EXCEPTION_CHECKS
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted/30 p-4 text-sm">
      <p className="text-foreground">
        <strong>{formatCount(EXCEPTIONS.length)}</strong> exceptions, of which{" "}
        <strong>{formatCount(actionable)}</strong> are actionable and{" "}
        <strong>{formatCount(preAutomation)}</strong> were raised before Spares
        Automation, as at {REFERENCE_DATE}.
      </p>
      <p className="text-xs text-muted-foreground">
        {[...byType]
          .map(([type, count]) => `${exceptionTypeLabel(type)}: ${formatCount(count)}`)
          .join(" · ")}
      </p>
      <p className="text-xs text-muted-foreground">
        {formatCount(checks.linesChecked)} repair lines checked for an attestation within ±
        {checks.attestationWindowDays} days.{" "}
        {formatCount(checks.acquisitionsChecked)} new-unit purchases checked for a justification
        within ±{checks.justificationWindowDays} days. Spares Automation cutover: attestations
        from {checks.attestationCutoverDate}, justifications from {checks.justificationCutoverDate}.
      </p>
    </div>
  )
}
