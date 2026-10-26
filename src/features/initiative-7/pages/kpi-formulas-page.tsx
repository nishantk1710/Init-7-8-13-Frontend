"use client"

import { useEffect, useState, useTransition } from "react"
import { Eye, Loader2, RotateCcw, Save } from "lucide-react"
import { toast } from "sonner"

import { AlertBanner } from "@/components/shared/alert-banner"
import { ChartCard } from "@/components/shared/chart-card"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { PageLoader } from "@/components/shared/page-loader"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ApiError } from "@/lib/api/client"
import { formatApiDateTime } from "@/lib/api/format"
import { cn, formatCount } from "@/lib/utils"
import { KpiFormulaCard } from "@/features/initiative-7/components/kpi-formula-card"
import { PreviewImpactPanel } from "@/features/initiative-7/components/preview-impact-panel"
import { useKpiFormulasPage } from "@/features/initiative-7/hooks/use-kpi-formulas"
import {
  applyFormulas,
  fetchApplyStatus,
  formulaErrors,
  previewFormulas,
  resetFormulas,
} from "@/features/initiative-7/services/kpi-formulas-api"
import { OverviewFormulasProvider } from "@/features/initiative-7/components/overview-formulas-context"
import type { FormulaPreview, FormulasPage, PortfolioFigures } from "@/features/initiative-7/types/kpi-formulas"
import {
  CALC_VIEWS,
  STATUS_LABEL,
  type CalcView,
  changedKeys,
  draftFromFields,
  fieldsFromDraft,
  formatDelta,
  impactRows,
  sectionsFor,
  type Draft,
} from "@/features/initiative-7/utils/kpi-formulas"

const POLL_MS = 3000

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.detailText() : error instanceof Error ? error.message : "Something went wrong."
}

/**
 * Calculation -- change how the Inventory Planning Overview's cards and charts are calculated.
 *
 * Each calculation is a formula the user writes from the data the platform holds (the list beside every
 * formula). The backend checks it and says what is wrong in words. *Preview* shows what the whole portfolio
 * would read under the draft without saving anything. *Save & Apply* keeps it as a new version, rebuilds the
 * usage data when the usage window changed, and from then on the Overview, its charts, its information
 * cards and new quarterly reports use it. Every version is kept, with who saved it.
 */
export function KpiFormulasPage() {
  const { data, loading, error, refetch } = useKpiFormulasPage()

  return (
    <div className="blue-scope min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Calculation"
          description="Change how the Overview's cards and charts are calculated. The information cards update to match."
        />
        {loading && !data ? (
          <PageLoader label="Loading the calculation" className="h-72 w-full" />
        ) : error && !data ? (
          <EmptyState
            title="Could not load the calculation"
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

const STEPS = [
  { title: "Pick your data", text: "Each box takes a formula. Click a name in the list beside it to use that data." },
  { title: "Preview", text: "See what the whole portfolio would show, side by side with today, before saving." },
  { title: "Save & Apply", text: "The Overview, its charts and its info cards switch to your formula. You can always go back." },
]

function FormulasEditor({ page, onApplied }: { page: FormulasPage; onApplied: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => draftFromFields(page.fields))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [preview, setPreview] = useState<FormulaPreview | null>(null)
  const [note, setNote] = useState("")
  const [view, setView] = useState<CalcView>("cards")
  const [fullOpen, setFullOpen] = useState(false)
  const [applying, setApplying] = useState(page.status.state === "applying")
  const [applyMessage, setApplyMessage] = useState<string | null>(page.status.message)
  const [isPending, startTransition] = useTransition()

  const changes = changedKeys(page.fields, draft)
  const dirty = changes.length > 0
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
            toast.success("The new calculation is in use.")
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

  /** Runs the preview for the whole draft (it is one request whatever section asked). `openFull` also opens the full
   * results; a section's own "Preview impact" only fills its panel. */
  function runPreview(openFull: boolean) {
    setFailure(null)
    startTransition(async () => {
      try {
        setErrors({})
        setPreview(await previewFormulas(fieldsFromDraft(page.fields, draft)))
        if (openFull) setFullOpen(true)
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
          toast.success("The new calculation is in use.")
          onApplied()
        }
      } catch (caught) {
        fail(caught)
      }
    })
  }

  return (
    // The (i) popups on this page explain the calculation in use, the same as on the Overview.
    <OverviewFormulasProvider value={page.active}>
      {applying && (
        <AlertBanner tone="info" title="Applying the new calculation">
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="size-3 animate-spin" aria-hidden />
            {applyMessage ?? "Rebuilding the usage data."} The Overview keeps its current numbers until this finishes.
          </span>
        </AlertBanner>
      )}
      {failure && (
        <AlertBanner tone="critical" title="Nothing was changed">
          <span className="whitespace-pre-line">{failure}</span>
        </AlertBanner>
      )}
      {page.active.isDefault ? (
        <AlertBanner tone="info" title="The built-in calculation is in use">
          Nothing has been changed yet. Edit a formula below, preview the effect, then save and apply it.
        </AlertBanner>
      ) : (
        <AlertBanner tone="warning" title={`Your calculation is in use (version ${page.active.version})`}>
          The Overview, its charts, its information cards and new quarterly reports use it. Quarterly reports already
          generated keep the figures they were generated with.
        </AlertBanner>
      )}

      <ol className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-3 rounded-xl border border-border bg-card p-4">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-action text-xs font-medium text-white">
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">{step.title}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>

      <details className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
        <summary className="cursor-pointer text-sm font-medium text-foreground">How to write a formula</summary>
        <div className="mt-3 grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
          <div>
            <p className="font-semibold text-foreground">Use</p>
            <p className="mt-1">
              Names from the list (click to add), numbers, brackets and <code className="font-mono">+ − × ÷</code>
              (type <code className="font-mono">+ - * /</code>).
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">Compare</p>
            <p className="mt-1">
              A rule that is true or false uses <code className="font-mono">&lt; &lt;= &gt; &gt;=</code>, joined with{" "}
              <code className="font-mono">and</code> / <code className="font-mono">or</code>.
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">Functions</p>
            <p className="mt-1">
              {page.functions.map((fn) => (
                <code key={fn} className="mr-2 font-mono">
                  {fn}
                </code>
              ))}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          If a figure a formula needs is missing for a material, that material is left out. It is never counted as zero,
          and never as safe.
        </p>
      </details>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xs text-muted-foreground">Show the calculations behind the Overview&apos;s</span>
        <nav className="flex flex-wrap items-center gap-2 text-xs" aria-label="Show">
          {CALC_VIEWS.map((option) => (
            <ViewChip
              key={option.value}
              active={view === option.value}
              onClick={() => setView(option.value)}
              label={option.label}
            />
          ))}
        </nav>
      </div>

      <div className="flex flex-col gap-4">
        {sectionsFor(view, page.kpis).map((section, position) => {
          const kpi = page.kpis.find((k) => k.key === section.kpi)
          return (
            <KpiFormulaCard
              key={`${view}-${section.kpi}`}
              index={position + 1}
              defaultOpen={position === 0}
              title={section.title}
              blurb={section.blurb}
              infoId={section.infoId}
              controls={section.controls}
              ruleLines={(preview?.formulaLines ?? page.active.formulaLines)[section.kpi]}
              fields={page.fields.filter((f) => f.kpi === section.kpi)}
              data={page.data[kpi?.dataSet ?? ""] ?? []}
              draft={draft}
              errors={errors}
              disabled={locked}
              previewPanel={
                <PreviewImpactPanel
                  rows={preview ? impactRows(section.kpi, preview.current, preview.draft) : null}
                  pending={isPending}
                  disabled={locked}
                  note={
                    preview?.windowNeedsRebuild && section.kpi === "stockout"
                      ? "The usage window changed, so these figures still use the old window. They change when you Save & Apply."
                      : undefined
                  }
                  onPreview={() => runPreview(false)}
                  onFullResults={() => setFullOpen(true)}
                />
              }
              onChange={edit}
            />
          )
        })}
      </div>


      <div className="sticky bottom-0 z-10 flex flex-col gap-2 rounded-lg border-2 border-action/40 bg-card p-3 shadow-lg">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("mr-1 text-sm", dirty ? "font-medium text-foreground" : "text-muted-foreground")}>
            {dirty ? `${changes.length} unsaved change${changes.length > 1 ? "s" : ""}` : "No unsaved changes"}
          </span>
          <Button type="button" variant="outline" disabled={locked} onClick={() => (preview ? setFullOpen(true) : runPreview(true))}>
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
      </div>

      <HistoryCard history={page.history} />

      <Dialog open={fullOpen && preview !== null} onOpenChange={setFullOpen}>
        <DialogContent className="blue-scope max-h-[85vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>What the whole portfolio would show</DialogTitle>
            <DialogDescription>Nothing is saved yet. This is your draft against what is in use now.</DialogDescription>
          </DialogHeader>
          {preview && <PreviewResults preview={preview} />}
        </DialogContent>
      </Dialog>
    </OverviewFormulasProvider>
  )
}

type Metric = { label: string; now: string; next: string; delta: string }

const count = (n: number | null) => (n === null ? "Not available" : formatCount(n))
const percent = (n: number | null) => (n === null ? "Not yet measured" : `${n.toFixed(1)}%`)

function metricsOf(current: PortfolioFigures, draft: PortfolioFigures): { title: string; metrics: Metric[] }[] {
  return [
    {
      title: "High Stockout Risk",
      metrics: [
        {
          label: "Materials at risk",
          now: count(current.stockoutAtRisk),
          next: count(draft.stockoutAtRisk),
          delta: formatDelta(current.stockoutAtRisk, draft.stockoutAtRisk, formatCount),
        },
        {
          label: "Materials that could be judged",
          now: count(current.stockoutEvaluated),
          next: count(draft.stockoutEvaluated),
          delta: formatDelta(current.stockoutEvaluated, draft.stockoutEvaluated, formatCount),
        },
      ],
    },
    {
      title: "Excess Inventory Candidates",
      metrics: [
        {
          label: "Candidates",
          now: count(current.excessCount),
          next: count(draft.excessCount),
          delta: formatDelta(current.excessCount, draft.excessCount, formatCount),
        },
        {
          label: "Excess value",
          now: count(current.excessOpportunity),
          next: count(draft.excessOpportunity),
          delta: formatDelta(current.excessOpportunity, draft.excessOpportunity, formatCount),
        },
      ],
    },
    {
      title: "Working Capital Impact",
      metrics: [
        {
          label: "Impact",
          now: count(current.workingCapital),
          next: count(draft.workingCapital),
          delta: formatDelta(current.workingCapital, draft.workingCapital, formatCount),
        },
      ],
    },
    {
      title: "SAP Adoption",
      metrics: [
        {
          label: "Adoption rate",
          now: percent(current.adoptionRate),
          next: percent(draft.adoptionRate),
          delta: formatDelta(current.adoptionRate, draft.adoptionRate, (n) => `${n.toFixed(1)} points`),
        },
        {
          label: "Counted as adopted",
          now: count(current.countedAsAdopted),
          next: count(draft.countedAsAdopted),
          delta: formatDelta(current.countedAsAdopted, draft.countedAsAdopted, formatCount),
        },
      ],
    },
  ]
}

function PreviewResults({ preview }: { preview: FormulaPreview }) {
  return (
    <div>
      {preview.windowNeedsRebuild && (
        <p className="mb-3 text-xs text-warning">
          The usage window changed, so the High Stockout Risk figures below still use the old window. They change when you
          Save &amp; Apply, which rebuilds the usage data.
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metricsOf(preview.current, preview.draft).map((group) => (
          <div key={group.title} className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
            <h3 className="text-sm font-medium text-foreground">{group.title}</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-7 px-1 text-[11px]" />
                  <TableHead className="h-7 px-1 text-right text-[11px]">Now</TableHead>
                  <TableHead className="h-7 px-1 text-right text-[11px]">Draft</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.metrics.map((metric) => (
                  <TableRow key={metric.label}>
                    <TableCell className="px-1 py-1.5 text-xs whitespace-normal">
                      {metric.label}
                      <span className="block text-[11px] text-muted-foreground">{metric.delta}</span>
                    </TableCell>
                    <TableCell className="px-1 py-1.5 text-right text-xs tabular-nums">{metric.now}</TableCell>
                    <TableCell className="px-1 py-1.5 text-right text-xs font-semibold tabular-nums">{metric.next}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
      </div>
    </div>
  )
}

function HistoryCard({ history }: { history: FormulasPage["history"] }) {
  return (
    <ChartCard title="Version history" subtitle="Every saved change, newest first, and who made it.">
      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">No changes yet. The built-in calculation has always been in use.</p>
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
    </ChartCard>
  )
}

/** The same pill toggle the Criticality history card uses for its plants. */
function ViewChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-2.5 py-0.5 font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-muted"
      )}
    >
      {label}
    </button>
  )
}
