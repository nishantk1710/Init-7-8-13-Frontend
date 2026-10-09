import Link from "next/link"
import { connection } from "next/server"

import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { LoadFailure } from "@/features/initiative-13/components/load-states"
import { formatMonth, ValidationPanel } from "@/features/initiative-13/components/validation-panel"
import { Zmm065UploadCard } from "@/features/initiative-13/components/zmm065-upload-card"
import { loadLiveValidation, loadLiveZmm065Uploads } from "@/features/initiative-13/data/live-loaders"
import type { I13SearchParams } from "@/features/initiative-13/utils/search-params"
import { formatApiDate, formatApiDateTime } from "@/lib/api/format"
import type { Zmm065Upload } from "@/lib/api/i13"
import { cn, formatCount } from "@/lib/utils"

/**
 * Validation — FR-6's monthly reconciliation against ZMM065, and FRS
 * acceptance criterion 4.
 *
 * VZI uploads each site's ZMM065 report here every month. By default each
 * plant is reconciled against its latest upload (the seeded July report stands
 * in for a plant with none); `?month=YYYY-MM` reconciles against that month's
 * uploads only. Every comparison runs in the backend: two implementations of
 * one reconciliation rule would disagree eventually, and this is the screen
 * whose entire purpose is to say whether two sources agree.
 *
 * The 30-Day GR Report is not part of this screen; validation is against
 * ZMM065 only. The tolerance itself is still an open item with VZI.
 */
export async function ValidationPage({ searchParams }: { searchParams: I13SearchParams }) {
  await connection()

  const month = /^\d{4}-\d{2}$/.test(searchParams.month ?? "") ? searchParams.month : undefined
  const [validation, uploads] = await Promise.allSettled([
    loadLiveValidation(month),
    loadLiveZmm065Uploads(),
  ])

  const uploadList = uploads.status === "fulfilled" ? uploads.value : null
  const months = uploadList
    ? [...new Set(uploadList.map((u) => u.reportMonth.slice(0, 7)))].sort().reverse()
    : []

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Validation"
          description="The platform's aging bands reconciled against VZI's monthly ZMM065 report, as of each report's run date. All reconciliation runs in the backend."
        />

        <Zmm065UploadCard />

        <nav className="flex flex-wrap items-center gap-2 text-xs" aria-label="ZMM065 report month">
          <span className="text-muted-foreground">Reconcile against:</span>
          <MonthChip href="/oar-utilization/validation" active={!month} label="Latest per plant" />
          {months.map((m) => (
            <MonthChip
              key={m}
              href={`/oar-utilization/validation?month=${m}`}
              active={month === m}
              label={formatMonth(`${m}-01`)}
            />
          ))}
        </nav>

        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-foreground">
            ZMM065 reconciliation{month ? ` — ${formatMonth(`${month}-01`)}` : ""}
          </h2>
          {validation.status === "fulfilled" ? (
            <ValidationPanel result={validation.value} />
          ) : (
            <LoadFailure what="validation data" message={errorText(validation.reason)} />
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-foreground">Upload history</h2>
          {uploadList === null ? (
            <LoadFailure
              what="the ZMM065 upload history"
              message={uploads.status === "rejected" ? errorText(uploads.reason) : null}
            />
          ) : uploadList.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No monthly report uploaded yet. Validation uses the seeded July 2026 report until one is.
            </p>
          ) : (
            <UploadHistory uploads={uploadList} />
          )}
        </section>
      </div>
    </div>
  )
}

function MonthChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-full border px-2.5 py-0.5 font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-foreground hover:bg-muted"
      )}
    >
      {label}
    </Link>
  )
}

function UploadHistory({ uploads }: { uploads: Zmm065Upload[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Report month</TableHead>
            <TableHead>Plant</TableHead>
            <TableHead>File</TableHead>
            <TableHead className="text-right">Rows</TableHead>
            <TableHead>Run date</TableHead>
            <TableHead>Uploaded by</TableHead>
            <TableHead>Uploaded</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {uploads.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium text-foreground">{formatMonth(u.reportMonth)}</TableCell>
              <TableCell>{u.plant}</TableCell>
              <TableCell className="max-w-64 truncate" title={`${u.fileName} (sheet ${u.sheetName})`}>
                {u.fileName}
              </TableCell>
              <TableCell className="text-right">{formatCount(u.rowCount)}</TableCell>
              <TableCell>{formatApiDate(u.reportDate)}</TableCell>
              <TableCell>{u.uploadedBy}</TableCell>
              <TableCell>{formatApiDateTime(u.uploadedAt)}</TableCell>
              <TableCell>
                {u.isCurrent ? (
                  <StatusBadge tone="success">CURRENT</StatusBadge>
                ) : (
                  <StatusBadge tone="default">EARLIER</StatusBadge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function errorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}
