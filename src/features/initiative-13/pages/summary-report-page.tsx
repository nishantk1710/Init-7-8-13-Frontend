import Link from "next/link"
import { connection } from "next/server"
import { FileText } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { LoadFailure } from "@/features/initiative-13/components/load-states"
import { SummaryReportActions } from "@/features/initiative-13/components/summary-report-actions"
import { SummaryReportDocument } from "@/features/initiative-13/components/summary-report-document"
import { SummaryReportPrint } from "@/features/initiative-13/components/summary-report-print"
import { ApiError } from "@/lib/api/client"
import { formatApiDate, formatApiDateTime } from "@/lib/api/format"
import {
  getSummaryReport,
  listSummaryReports,
  type SummaryReport,
  type SummaryReportListItem,
} from "@/lib/api/i13-report"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"
import { cn } from "@/lib/utils"

const PATH = "/oar-utilization/report"

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * The OAR Utilization summary report: one generated page over the four I13
 * screens, written for management to read and forward.
 *
 * Shows `?id=` when given, otherwise the newest report. Every report is saved,
 * so a link to one keeps showing exactly what was generated, and the list on
 * the right is the history.
 *
 * The backend serves this behind `I13_REPORT_ENABLED`. Switched off, the list
 * answers 404 and the page says the feature is not enabled here — the same
 * reading of 404 as the dashboard's optional sections.
 */
export async function SummaryReportPage({ reportId }: { reportId?: string }) {
  await connection()

  let reports: SummaryReportListItem[]
  try {
    reports = await listSummaryReports()
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <Shell reportId={null} showActions={false}>
          <EmptyState
            icon={<FileText className="size-4" />}
            title="The summary report is not switched on here"
            description="It is enabled per environment by the platform team (I13_REPORT_ENABLED)."
          />
        </Shell>
      )
    }
    return (
      <Shell reportId={null} showActions={false}>
        <LoadFailure what="summary reports" message={message(error)} />
      </Shell>
    )
  }

  const selectedId = reportId || reports[0]?.id
  let report: SummaryReport | null = null
  let reportError: string | null = null
  if (selectedId) {
    try {
      report = await getSummaryReport(selectedId)
    } catch (error) {
      reportError = message(error)
    }
  }

  return (
    <Shell reportId={report?.id ?? null} showActions>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 rounded-xl border border-border bg-card p-5">
          {report ? (
            <>
              <SummaryReportDocument report={report} />
              <SummaryReportPrint report={report} />
            </>
          ) : reportError ? (
            <LoadFailure what="summary report" message={reportError} />
          ) : (
            <EmptyState
              icon={<FileText className="size-4" />}
              title="No report yet"
              description="Choose a plant, or all plants, and generate the first report. It summarises the dashboard, ledger, procurement exceptions and live consumption tracking."
            />
          )}
        </div>
        <History reports={reports} selectedId={report?.id ?? null} />
      </div>
    </Shell>
  )
}

function Shell({
  reportId,
  showActions,
  children,
}: {
  reportId: string | null
  showActions: boolean
  children: React.ReactNode
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <PageHeader
          title="Summary report"
          description="A one-page summary of OAR utilization — what is idle, what is off plan and what needs a follow-up — for sharing with management."
          actions={showActions ? <SummaryReportActions reportId={reportId} /> : undefined}
        />
        {children}
      </div>
    </div>
  )
}

function History({ reports, selectedId }: { reports: SummaryReportListItem[]; selectedId: string | null }) {
  return (
    <aside className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-foreground">Previous reports</h2>
      {reports.length === 0 ? (
        <p className="text-xs text-muted-foreground">None yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {reports.map((r) => (
            <li key={r.id}>
              <Link
                href={`${PATH}?id=${encodeURIComponent(r.id)}`}
                className={cn(
                  "block rounded-lg border px-3 py-2 text-xs transition-colors hover:bg-muted/60",
                  r.id === selectedId ? "border-primary bg-muted/40" : "border-border"
                )}
              >
                <div className="font-medium text-foreground">
                  {r.plant ? sapPlantLabel(r.plant) : "All plants"} · data {formatApiDate(r.dataAsOf)}
                </div>
                <div className="text-muted-foreground">
                  {formatApiDateTime(r.generatedAt)}
                  {r.generatedBy ? ` · ${r.generatedBy}` : ""}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
