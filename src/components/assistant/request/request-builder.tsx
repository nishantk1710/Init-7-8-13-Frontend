"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Boxes, CircleSlash, Copy, Loader2, Plus, Search, Sparkles, Wrench } from "lucide-react"
import { toast } from "sonner"

import { AI_BUTTON, AiEyebrow } from "@/components/assistant/ai-visuals"
import { OarTable } from "@/components/assistant/request/oar-table"
import { RepairableTable } from "@/components/assistant/request/repairable-table"
import { Chip, DemoBanner, SELECT_CLASS } from "@/components/assistant/request/request-parts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DEMO_PLANTS,
  REQUEST_CATALOGUE,
  searchRequestCatalogue,
  type DemoRequestMaterial,
} from "@/lib/assistant/request/catalogue"
import {
  EMPTY_JUSTIFICATION,
  MAX_LINES,
  REASON_OPTIONS,
  isDuplicate,
  isReady,
  lineFor,
  oarNeedsJustification,
  opensSession,
  repairableNeedsJustification,
  withSuggestedWindow,
  type DraftLine,
  type Justification,
  type NoSessionLine,
  type OarLine,
  type RepairableLine,
} from "@/lib/assistant/request/lines"
import { submitRequest } from "@/lib/assistant/request/record"
import { saveRequest } from "@/lib/assistant/request/store"
import { cn } from "@/lib/utils"

/**
 * One request, many materials.
 *
 * The requester fills the header once, adds materials, and each one is routed
 * as it is added -- into the OAR table, the repairable table, or the "no
 * session needed" list. Every row then asks only what its flow asks, with the
 * assistant's suggestion already filled in. Submitting records the request and
 * one line per routed row, numbered `/1`, `/2` … in the order they were added.
 */
export function RequestBuilder() {
  const router = useRouter()
  const [requester, setRequester] = useState("")
  const [department, setDepartment] = useState("")
  const [rows, setRows] = useState<DraftLine[]>([])
  const [showErrors, setShowErrors] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const oarRows = rows.filter((r): r is OarLine => r.kind === "i13")
  const repairableRows = rows.filter((r): r is RepairableLine => r.kind === "i08")
  const noSessionRows = rows.filter((r): r is NoSessionLine => !opensSession(r))
  const sessionRows = rows.filter(opensSession)

  /** Provisional `/n`: the order added, across both tables. */
  const lineNumbers = new Map(sessionRows.map((row, index) => [row.key, index + 1]))

  const readyCount = sessionRows.filter(isReady).length
  const headerReady = requester.trim().length > 0 && department.trim().length > 0
  const canSubmit = headerReady && sessionRows.length > 0 && readyCount === sessionRows.length

  function add(materialId: string, plant: string) {
    if (rows.length >= MAX_LINES) {
      toast.error(`A request holds up to ${MAX_LINES} materials`, {
        description: "Submit this one and start another for the rest.",
      })
      return
    }
    if (isDuplicate(rows, materialId, plant)) {
      toast.error(`${materialId} at ${plant} is already on this request`, {
        description: "Change the quantity on its row instead of adding it twice.",
      })
      return
    }
    setRows((current) => [...current, lineFor(materialId, plant)])
  }

  function update(next: DraftLine) {
    setRows((current) => current.map((row) => (row.key === next.key ? next : row)))
  }

  function remove(key: string) {
    setRows((current) => current.filter((row) => row.key !== key))
  }

  function applyToOar(change: (row: OarLine) => OarLine) {
    setRows((current) =>
      current.map((row) => (row.kind === "i13" && row.decision === "proceed" ? change(row) : row))
    )
  }

  function submit() {
    if (!canSubmit) {
      setShowErrors(true)
      toast.error("Some rows still need answers", {
        description: !headerReady
          ? "Fill in the requester and department first."
          : "Each row's status says what is missing.",
      })
      return
    }
    setSubmitting(true)
    const request = submitRequest(rows, { requester, department })
    saveRequest(request)
    router.push(`/assistant/requests/${request.requestId}`)
  }

  return (
    <div className="flex flex-col gap-5 pb-24">
      <DemoBanner />

      <section className="ai-glass flex flex-col gap-4 rounded-2xl p-5">
        <AiEyebrow>1 · Who is it for</AiEyebrow>
        <div className="grid gap-3 sm:grid-cols-2">
          <LabelledInput
            id="req-requester"
            label="Requester"
            value={requester}
            onChange={setRequester}
            placeholder="who the parts are for"
            invalid={showErrors && !requester.trim()}
          />
          <LabelledInput
            id="req-department"
            label="Department"
            value={department}
            onChange={setDepartment}
            placeholder="e.g. 10100"
            invalid={showErrors && !department.trim()}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">Asked once for the whole request, not per material.</p>
      </section>

      <AddMaterials rows={rows} onAdd={add} />

      {rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Add materials above. Each one goes to the right table automatically.
        </div>
      )}

      {oarRows.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle
            icon={<Boxes className="size-4" />}
            title="OAR materials"
            subtitle="Planned-on-demand (I13): the assistant suggests a quantity first, then the consumption window."
            count={oarRows.length}
          />
          <OarApplyAll rows={oarRows} onApply={applyToOar} />
          <OarTable
            rows={oarRows}
            lineNumbers={lineNumbers}
            showErrors={showErrors}
            onChange={update}
            onRemove={remove}
          />
        </section>
      )}

      {repairableRows.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle
            icon={<Wrench className="size-4" />}
            title="Repairable materials"
            subtitle="80-series (I08): use the unit that exists, or say why a new one is needed."
            count={repairableRows.length}
          />
          <JustificationApplyAll
            label="Same reason for every new unit"
            disabled={!repairableRows.some(repairableNeedsJustification)}
            onApply={(j) =>
              setRows((current) =>
                current.map((row) =>
                  row.kind === "i08" && repairableNeedsJustification(row) ? { ...row, justification: j } : row
                )
              )
            }
          />
          <RepairableTable
            rows={repairableRows}
            lineNumbers={lineNumbers}
            showErrors={showErrors}
            onChange={update}
            onRemove={remove}
          />
        </section>
      )}

      {noSessionRows.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle
            icon={<CircleSlash className="size-4" />}
            title="No session needed"
            subtitle="Kept on the request so you can see why nothing is asked. Reserve these as usual."
            count={noSessionRows.length}
          />
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
            {noSessionRows.map((row) => (
                <li key={row.key} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-4 py-3 text-sm">
                  <span className="font-mono text-xs font-semibold">{row.materialId}</span>
                  <span className="min-w-0 flex-1">
                    {row.description ?? <span className="text-muted-foreground italic">Unknown material</span>}
                    <span className="ml-2 text-[11px] text-muted-foreground">Plant {row.plant}</span>
                    <span className="block text-xs text-muted-foreground">{row.reason}</span>
                  </span>
                  <Chip tone={row.kind === "out_of_scope" ? "muted" : row.kind === "data_gap" ? "warn" : "bad"}>
                    {row.kind === "out_of_scope" ? "Out of scope" : row.kind === "data_gap" ? "No data" : "Not found"}
                  </Chip>
                  <Button type="button" variant="ghost" size="xs" onClick={() => remove(row.key)}>
                    Remove
                  </Button>
                </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-medium text-foreground">
            {sessionRows.length === 0
              ? "No materials that need the assistant yet"
              : `${readyCount} of ${sessionRows.length} line${sessionRows.length === 1 ? "" : "s"} ready`}
          </span>
          <span className="text-[11px] text-muted-foreground">
            Submitting gives one request reference. Each line is quoted as reference/1, /2 … on the SAP reservation.
          </span>
        </div>
        <Button type="button" onClick={submit} disabled={submitting} className={cn(AI_BUTTON, "h-9 gap-1.5 px-4")}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Submit request
          <ArrowRight className="size-4" />
        </Button>
      </footer>
    </div>
  )
}

function SectionTitle({
  icon,
  title,
  subtitle,
  count,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  count: number
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 inline-flex size-7 items-center justify-center rounded-lg bg-ai-2/10 text-ai-2">{icon}</span>
      <div className="flex flex-col">
        <h2 className="text-sm font-semibold text-foreground">
          {title} <span className="font-normal text-muted-foreground">({count})</span>
        </h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  )
}

function LabelledInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  invalid,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  invalid: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <Input
        id={id}
        value={value}
        aria-invalid={invalid}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

// --- adding materials -----------------------------------------------------------

function AddMaterials({ rows, onAdd }: { rows: DraftLine[]; onAdd: (materialId: string, plant: string) => void }) {
  const [query, setQuery] = useState("")
  const [plant, setPlant] = useState<string>(DEMO_PLANTS[0].plant)
  const matches = useMemo(() => searchRequestCatalogue(query), [query])
  const typedNumber = /^\d{3,18}$/.test(query.replace(/[\s-]/g, "")) ? query.replace(/[\s-]/g, "") : null

  const added = (m: DemoRequestMaterial) => isDuplicate(rows, m.materialId, m.plant)

  function pick(materialId: string, p: string) {
    onAdd(materialId, p)
    setQuery("")
  }

  return (
    <section className="ai-glass flex flex-col gap-4 rounded-2xl p-5">
      <AiEyebrow>2 · Add materials</AiEyebrow>
      <div className="relative flex flex-col gap-1.5">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search materials"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Material number or part of its name"
            className="pl-8"
          />
        </div>
        {query.trim().length >= 2 && (
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-popover text-sm shadow-md">
            {matches.map((m) => (
              <li key={`${m.materialId}-${m.plant}`}>
                <button
                  type="button"
                  disabled={added(m)}
                  onClick={() => pick(m.materialId, m.plant)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted disabled:opacity-50"
                >
                  <span className="font-mono text-xs font-semibold">{m.materialId}</span>
                  <span className="min-w-0 flex-1 truncate">{m.description}</span>
                  <span className="text-xs text-muted-foreground">Plant {m.plant}</span>
                  {added(m) ? <Chip tone="muted">Added</Chip> : <Plus className="size-4 text-ai-2" />}
                </button>
              </li>
            ))}
            {typedNumber && (
              <li className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span className="text-xs text-muted-foreground">Use</span>
                <span className="font-mono text-xs font-semibold">{typedNumber}</span>
                <span className="text-xs text-muted-foreground">as typed, at plant</span>
                <select
                  aria-label="Plant"
                  className={cn(SELECT_CLASS, "h-7 w-auto")}
                  value={plant}
                  onChange={(e) => setPlant(e.target.value)}
                >
                  {DEMO_PLANTS.map((p) => (
                    <option key={p.plant} value={p.plant}>
                      {p.plant} {p.plantName}
                    </option>
                  ))}
                </select>
                <Button type="button" size="xs" variant="outline" onClick={() => pick(typedNumber, plant)}>
                  <Plus /> Add
                </Button>
              </li>
            )}
            {matches.length === 0 && !typedNumber && (
              <li className="px-3 py-2 text-xs text-muted-foreground">No demo material matches.</li>
            )}
          </ul>
        )}
      </div>

      <details className="group rounded-xl border border-dashed border-border px-4 py-3" open>
        <summary className="flex cursor-pointer items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
          <span>Demo materials -- one per case. Click to add.</span>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={(e) => {
              e.preventDefault()
              for (const m of REQUEST_CATALOGUE) if (!isDuplicate(rows, m.materialId, m.plant)) onAdd(m.materialId, m.plant)
            }}
          >
            <Copy /> Add all {REQUEST_CATALOGUE.length}
          </Button>
        </summary>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {REQUEST_CATALOGUE.map((m) => (
            <li key={`${m.materialId}-${m.plant}`}>
              <button
                type="button"
                disabled={added(m)}
                onClick={() => onAdd(m.materialId, m.plant)}
                className="flex w-full flex-col items-start gap-0.5 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:border-ai-2/40 hover:bg-muted/40 disabled:opacity-45"
              >
                <span className="flex w-full items-center gap-2">
                  <span className="font-mono text-[11px] font-semibold">{m.materialId}</span>
                  <span className="text-[11px] text-muted-foreground">@ {m.plant}</span>
                  <span className="ml-auto">{added(m) ? <Chip tone="muted">Added</Chip> : <Plus className="size-3.5 text-ai-2" />}</span>
                </span>
                <span className="text-xs text-foreground">{m.description}</span>
                <span className="text-[11px] text-ai-2">{m.scenario}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Type any other number in the search (e.g. 12345) to see the &ldquo;not found&rdquo; case.
        </p>
      </details>
    </section>
  )
}

// --- apply to all ------------------------------------------------------------------

function OarApplyAll({ rows, onApply }: { rows: OarLine[]; onApply: (change: (row: OarLine) => OarLine) => void }) {
  const [purpose, setPurpose] = useState("")
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  const active = rows.filter((r) => r.decision === "proceed").length

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-3">
      <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        Apply to all {active} OAR line{active === 1 ? "" : "s"} being procured
      </span>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-56 flex-1 items-center gap-1.5">
          <Input
            aria-label="Purpose for all"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="Purpose, e.g. Mill 3 shutdown, Nov"
            className="h-8"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!purpose.trim() || active === 0}
            onClick={() => onApply((row) => ({ ...row, purpose: purpose.trim() }))}
          >
            Apply purpose
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Input type="date" aria-label="Window start for all" value={start} onChange={(e) => setStart(e.target.value)} className="h-8 w-[8.5rem] text-xs" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" aria-label="Window end for all" value={end} onChange={(e) => setEnd(e.target.value)} className="h-8 w-[8.5rem] text-xs" />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!start || !end || end < start || active === 0}
            onClick={() => onApply((row) => ({ ...row, windowStart: start, windowEnd: end, windowEdited: true }))}
          >
            Apply window
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={active === 0}
            title="Put every row back on the window suggested from its own quantity"
            onClick={() => onApply((row) => withSuggestedWindow({ ...row, windowEdited: false }))}
          >
            Reset to suggested
          </Button>
        </div>
      </div>
      <JustificationApplyAll
        label="Same reason for every quantity that needs one"
        disabled={!rows.some(oarNeedsJustification)}
        onApply={(j) => onApply((row) => (oarNeedsJustification(row) ? { ...row, justification: j } : row))}
        embedded
      />
    </div>
  )
}

function JustificationApplyAll({
  label,
  disabled,
  onApply,
  embedded = false,
}: {
  label: string
  disabled: boolean
  onApply: (j: Justification) => void
  embedded?: boolean
}) {
  const [value, setValue] = useState<Justification>(EMPTY_JUSTIFICATION)
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5",
        !embedded && "rounded-xl border border-border bg-muted/20 p-3"
      )}
    >
      <span className="text-xs text-muted-foreground">{label}:</span>
      <select
        aria-label={`${label} -- reason`}
        className={cn(SELECT_CLASS, "w-48")}
        value={value.reasonCategory}
        disabled={disabled}
        onChange={(e) => setValue({ ...value, reasonCategory: e.target.value })}
      >
        <option value="">Choose a reason…</option>
        {REASON_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Input
        aria-label={`${label} -- text`}
        value={value.freeText}
        disabled={disabled}
        onChange={(e) => setValue({ ...value, freeText: e.target.value })}
        placeholder="In your own words"
        className="h-8 min-w-48 flex-1"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || !value.reasonCategory || !value.freeText.trim()}
        onClick={() => onApply({ ...value, freeText: value.freeText.trim() })}
      >
        Apply reason
      </Button>
      {disabled && <span className="text-[11px] text-muted-foreground">No row needs a reason right now.</span>}
    </div>
  )
}
