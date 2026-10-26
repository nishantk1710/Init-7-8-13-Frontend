"use client"

import { useEffect, useState, useTransition } from "react"
import { Eye, Loader2, RotateCcw, Save } from "lucide-react"
import { toast } from "sonner"

import { AlertBanner } from "@/components/shared/alert-banner"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { PageLoader } from "@/components/shared/page-loader"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ApiError } from "@/lib/api/client"
import { formatApiDateTime } from "@/lib/api/format"
import { formatCount } from "@/lib/utils"
import { KpiFormulaCard } from "@/features/initiative-7/components/kpi-formula-card"
import { useKpiFormulasPage } from "@/features/initiative-7/hooks/use-kpi-formulas"
import {
  applyFormulas,
  fetchApplyStatus,
  formulaErrors,
  previewFormulas,
  resetFormulas,
} from "@/features/initiative-7/services/kpi-formulas-api"
import type { FormulaPreview, FormulasPage } from "@/features/initiative-7/types/kpi-formulas"
import {
  KPI_BLURB,
  KPI_ORDER,
  STATUS_LABEL,
  changedKeys,
  draftFromFields,
  fieldsFromDraft,
  formatDelta,
  type Draft,
} from "@/features/initiative-7/utils/kpi-formulas"

const POLL_MS = 3000

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.detailText() : error instanceof Error ? error.message : "Something went wrong."
}

/**
 * KPI formulas -- change how the Inventory Planning Overview's cards and charts are calculated.
 *
 * A formula is typed in a small, safe language (numbers, the listed values, + - * /, brackets and
 * comparisons); the backend checks it and says what is wrong in words. *Preview* shows what the portfolio
 * would read under the draft without saving anything. *Save & Apply* keeps it as a new version, rebuilds
 * the usage data when the usage window changed, and from then on the Overview, its information cards and
 * new quarterly reports use it. Every version is kept, with who saved it.
 */
export function KpiFormulasPage() {
  const { data, loading, error, refetch } = useKpiFormulasPage()

  return (
    <div className="blue-scope min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="KPI formulas"
          description="Change how the Overview's cards and charts are calculated. The information cards update to match."
        />
        {loading && !data ? (
          <PageLoader label="Loading the KPI formulas" className="h-72 w-full" />
        ) : error && !data ? (
          <EmptyState
            title="Could not load the KPI formulas"
            description={messageOf(error)}
            actions={
              <Button size="sm" variant="outline" onClick={refetch}>
                Retry
              </Button>
            }
          />
        ) : data ? (
          // Keyed by the version in force: after an apply the form starts again from what was saved.
          <FormulasEditor key={`${data.active.version ?? "default"}`} page={data} onApplied={refetch} />
        ) : null}
      </div>
    </div>
  )
}

function FormulasEditor({ page, onApplied }: { page: FormulasPage; onApplied: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => draftFromFields(page.fields))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [preview, setPreview] = useState<FormulaPreview | null>(null)
  const [note, setNote] = useState("")
  const [applying, setApplying] = useState(page.status.state === "applying")
  const [applyMessage, setApplyMessage] = useState<string | null>(page.status.message)
  const [isPending, startTransition] = useTransition()

  const dirty = changedKeys(page.fields, draft).length > 0
  const locked = applying || isPending

  // While the usage data is rebuilding, ask how it is going until it is done, then reload the page's data.
  useEffect(() => {
    if (!applying) return
    let stopped = false
    const timer = setInterval(() => {
      fetchApplyStatus()
        .then((status) => {
          if (stopped || status.state === "applying") return
          setApplying(false)
          if (status.state === "failed") {
            setFailure(status.message ?? "The rebuild failed. The previous formulas are still in use.")
          } else {
            toast.success("The new formulas are in use.")
          }
          onApplied()
        })
        .catch(() => {
          /* keep waiting; the next tick asks again */
        })
    }, POLL_MS)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [applying, onApplied])

  function edit(key: string, value: string) {
    setDraft((previous) => ({ ...previous, [key]: value }))
    setErrors((previous) =>
      key in previous ? Object.fromEntries(Object.entries(previous).filter(([name]) => name !== key)) : previous
    )
    setPreview(null)
  }

  function fail(caught: unknown) {
    const fieldErrors = formulaErrors(caught)
    setErrors(fieldErrors)
    setFailure(Object.keys(fieldErrors).length > 0 ? "Fix the highlighted formulas and try again." : messageOf(caught))
  }

  function runPreview() {
    setFailure(null)
    startTransition(async () => {
      try {
        setErrors({})
        setPreview(await previewFormulas(fieldsFromDraft(page.fields, draft)))
      } catch (caught) {
        setPreview(null)
        fail(caught)
      }
    })
  }

  function run(action: () => ReturnType<typeof applyFormulas>) {
    setFailure(null)
    startTransition(async () => {
      try {
        setErrors({})
        const status = await action()
        if (status.state === "applying") {
          setApplying(true)
          setApplyMessage(status.message)
        } else {
          toast.success("The new formulas are in use.")
          onApplied()
        }
      } catch (caught) {
        fail(caught)
      }
    })
  }

  return (
    <>
      {applying && (
        <AlertBanner tone="info" title="Applying the new formulas">
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="size-3 animate-spin" aria-hidden />
            {applyMessage ?? "Rebuilding the usage data."} The Overview keeps its current numbers until this finishes.
          </span>
        </AlertBanner>
      )}
      {failure && (
        <AlertBanner tone="critical" title="The formulas were not applied">
          <span className="whitespace-pre-line">{failure}</span>
        </AlertBanner>
      )}
      {page.active.isDefault ? (
        <AlertBanner tone="info" title="The built-in formulas are in use">
          Nothing has been changed yet. Edit a formula below, preview the effect, then save and apply it.
        </AlertBanner>
      ) : (
        <AlertBanner tone="warning" title={`Custom formulas are in use (version ${page.active.version})`}>
          The Overview, its information cards and new quarterly reports use them. Quarterly reports already generated
          keep the figures they were generated with.
        </AlertBanner>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {KPI_ORDER.map((kpi) => (
          <KpiFormulaCard
            key={kpi}
            title={page.kpis.find((k) => k.key === kpi)?.title ?? kpi}
            blurb={KPI_BLURB[kpi]}
            fields={page.fields.filter((f) => f.kpi === kpi)}
            draft={draft}
            errors={errors}
            disabled={locked}
            onChange={edit}
          />
        ))}
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" disabled={locked} onClick={runPreview}>
            <Eye className="size-3.5" />
            Preview the effect
          </Button>
          <Button
            type="button"
            disabled={locked || !dirty}
            onClick={() => run(() => applyFormulas(fieldsFromDraft(page.fields, draft), note))}
          >
            {isPending || applying ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Save &amp; Apply
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={locked || page.active.isDefault}
            onClick={() => run(() => resetFormulas())}
          >
            <RotateCcw className="size-3.5" />
            Reset to built-in
          </Button>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={locked}
            maxLength={500}
            placeholder="Why? (optional, kept with this version)"
            aria-label="Note kept with this version"
            className="h-8 min-w-60 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          />
        </div>
        {!dirty && !page.active.isDefault && (
          <p className="text-xs text-muted-foreground">Nothing is different from the formulas in use.</p>
        )}
        {preview && <PreviewTable preview={preview} />}
      </section>

      <HistoryCard history={page.history} />
    </>
  )
}

function PreviewTable({ preview }: { preview: FormulaPreview }) {
  const { current, draft } = preview
  const rows: { label: string; now: string; next: string; delta: string }[] = [
    {
      label: "High Stockout Risk — at risk",
      now: formatCount(current.stockoutAtRisk),
      next: formatCount(draft.stockoutAtRisk),
      delta: formatDelta(current.stockoutAtRisk, draft.stockoutAtRisk, formatCount),
    },
    {
      label: "High Stockout Risk — could be judged",
      now: formatCount(current.stockoutEvaluated),
      next: formatCount(draft.stockoutEvaluated),
      delta: formatDelta(current.stockoutEvaluated, draft.stockoutEvaluated, formatCount),
    },
    {
      label: "Excess Inventory Candidates",
      now: formatCount(current.excessCount),
      next: formatCount(draft.excessCount),
      delta: formatDelta(current.excessCount, draft.excessCount, formatCount),
    },
    {
      label: "Excess value",
      now: current.excessOpportunity === null ? "Not available" : formatCount(current.excessOpportunity),
      next: draft.excessOpportunity === null ? "Not available" : formatCount(draft.excessOpportunity),
      delta: formatDelta(current.excessOpportunity, draft.excessOpportunity, formatCount),
    },
    {
      label: "Working Capital Impact",
      now: current.workingCapital === null ? "Not available" : formatCount(current.workingCapital),
      next: draft.workingCapital === null ? "Not available" : formatCount(draft.workingCapital),
      delta: formatDelta(current.workingCapital, draft.workingCapital, formatCount),
    },
  ]
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-foreground">What the whole portfolio would show</h3>
      {preview.windowNeedsRebuild && (
        <p className="text-xs text-warning">
          The usage window changed, so the High Stockout Risk figures below still use the old window. They change when you
          Save &amp; Apply, which rebuilds the usage data.
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Figure</TableHead>
            <TableHead className="text-right">In use now</TableHead>
            <TableHead className="text-right">With your draft</TableHead>
            <TableHead className="text-right">Change</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.label}>
              <TableCell>{row.label}</TableCell>
              <TableCell className="text-right tabular-nums">{row.now}</TableCell>
              <TableCell className="text-right tabular-nums">{row.next}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{row.delta}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function HistoryCard({ history }: { history: FormulasPage["history"] }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <h2 className="text-base font-semibold text-foreground">Version history</h2>
      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">No changes yet. The built-in formulas have always been in use.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Version</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Saved by</TableHead>
              <TableHead>Saved</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((version) => (
              <TableRow key={version.version}>
                <TableCell className="tabular-nums">v{version.version}</TableCell>
                <TableCell>
                  {STATUS_LABEL[version.status] ?? version.status}
                  {version.error && <span className="block text-xs text-destructive">{version.error}</span>}
                </TableCell>
                <TableCell>{version.createdBy}</TableCell>
                <TableCell>{formatApiDateTime(version.createdAt)}</TableCell>
                <TableCell className="text-muted-foreground">{version.note ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
