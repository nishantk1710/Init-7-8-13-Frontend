"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Boxes, CircleSlash, Loader2, Plus, Save, Search, Wrench } from "lucide-react"
import { toast } from "sonner"

import { DepartmentPicker } from "@/components/assistant/department-picker"
import { OarTable } from "@/components/assistant/request/oar-table"
import { RepairableTable } from "@/components/assistant/request/repairable-table"
import { deleteDraft, getDraft, saveDraft, type RequestDraft } from "@/components/assistant/request/request-drafts"
import { Chip, SELECT_CLASS } from "@/components/assistant/request/request-parts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ApiMaterialMatch } from "@/lib/api/assistant"
import {
  conflictDetail,
  createRequest,
  isNotEnabled,
  previewRequest,
  refusedDetail,
  requestDepartments,
  searchRequestMaterials,
  type ApiReasonCategory,
} from "@/lib/api/assistant-requests"
import type { RequestEntry } from "@/lib/assistant/request/entry"
import {
  DEFAULT_MAX_LINES,
  EMPTY_JUSTIFICATION,
  FALLBACK_REASONS,
  FALLBACK_RECOMMENDATIONS,
  answersOf,
  isDuplicate,
  isReady,
  lineFromPreview,
  oarNeedsJustification,
  opensSession,
  pendingLine,
  repairableNeedsJustification,
  withSuggestedWindow,
  type DraftLine,
  type Justification,
  type NoSessionLine,
  type OarLine,
  type RepairableLine,
} from "@/lib/assistant/request/lines"
import { sapPlantName } from "@/lib/shared-data/sap-plants"
import { cn } from "@/lib/utils"

/** The sites a request can be for: the two plants VZI's delivery names. */
const REQUEST_PLANTS = ["1300", "1500"] as const

/** A material as picked: from search, or a number typed with a plant. */
type Picked = { materialId: string; plant: string; description: string | null }

type RecheckedDraft = {
  rows: DraftLine[]
  maxLines: number | null
  reasons: readonly ApiReasonCategory[] | null
  /** The backend did not answer: `rows` are as saved. */
  stale: boolean
  notEnabled: boolean
}

/**
 * A saved draft's lines with today's stock figures and suggestion, keeping what
 * was typed into each (`lineFromPreview`'s `previous`). Never a line still
 * being checked: one saved mid-check has no answers to keep.
 */
async function recheckDraft(rows: DraftLine[]): Promise<RecheckedDraft> {
  const saved = rows.filter((row) => row.kind !== "pending")
  const unchanged = { rows: saved, maxLines: null, reasons: null, stale: false, notEnabled: false }
  if (saved.length === 0) return unchanged
  try {
    const response = await previewRequest(saved.map((row) => ({ materialId: row.materialId, plant: row.plant })))
    return {
      ...unchanged,
      rows: saved.map((row, index) => lineFromPreview(response.lines[index], row.key, row)),
      maxLines: response.maxLines,
      reasons: response.reasonCategories ?? null,
    }
  } catch (error) {
    return isNotEnabled(error) ? { ...unchanged, notEnabled: true } : { ...unchanged, stale: true }
  }
}

function newDraftKey(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }
}

/**
 * One request, many materials.
 *
 * The requester fills the header once, adds materials, and each one is checked
 * by the backend as it is added (`POST /assistant/requests/preview`) -- into the
 * OAR table, the repairable table, or the "no session needed" list. Every row
 * then asks only what its flow asks, with the assistant's suggestion already
 * filled in. Submitting records the whole request, or nothing; each line is
 * numbered `/1`, `/2` … in the order it was added.
 *
 * One request is for one plant and one department (UAT, 21 Oct): the first
 * material added fixes the plant, and the requester picks the department once,
 * from that plant's codes, for every material on the request.
 *
 * One material is a request too (UAT, 21 Oct): `entry` -- from the landing
 * page or the SAP BAdI link -- starts the request with that material as line 1,
 * the requester and department pre-filled from the link. A request opened from
 * SAP (`origin` BADI) may have neither, as the backend allows: the pop-up
 * cannot always supply them.
 *
 * Save as draft (UAT, 27 Oct) keeps the request in this browser without
 * recording anything (see `request-drafts.ts`); `draftId` resumes one, and a
 * draft wins over `entry` when a link carries both.
 */
export function RequestBuilder({
  entry = null,
  draftId = null,
}: {
  entry?: RequestEntry | null
  draftId?: string | null
}) {
  const router = useRouter()
  const [origin, setOrigin] = useState<"BADI" | "PLATFORM">(entry?.origin === "BADI" ? "BADI" : "PLATFORM")
  const fromSap = origin === "BADI"
  const [requester, setRequester] = useState(entry?.requestedFor ?? "")
  /** Picked for one plant; a different plant (or an emptied request) clears it. */
  const [picked, setPicked] = useState<{ plant: string | null; code: string }>({
    plant: entry?.plant ?? null,
    code: entry?.department ?? "",
  })
  /** Free text beside the code (UAT, 21 Oct): optional, never checked. */
  const [departmentNote, setDepartmentNote] = useState("")
  const [rows, setRows] = useState<DraftLine[]>([])
  const [showErrors, setShowErrors] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [maxLines, setMaxLines] = useState(DEFAULT_MAX_LINES)
  const [reasons, setReasons] = useState<readonly ApiReasonCategory[]>(FALLBACK_REASONS)
  // Empty until a preview names them: an older backend sends none and cannot
  // take a declaration with the request, so the section is not offered.
  const [faultCategories, setFaultCategories] = useState<readonly string[]>([])
  const [recommendations, setRecommendations] =
    useState<readonly ApiReasonCategory[]>(FALLBACK_RECOMMENDATIONS)
  const [refusedKey, setRefusedKey] = useState<string | null>(null)
  const [notEnabled, setNotEnabled] = useState(false)
  /** One per draft: a resubmitted draft is the same request, never a second one. */
  const draftKey = useRef(newDraftKey())
  /** The saved draft this builder writes to: set by resuming one, or by the first save. */
  const savedDraftId = useRef<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const oarRows = rows.filter((r): r is OarLine => r.kind === "i13")
  const repairableRows = rows.filter((r): r is RepairableLine => r.kind === "i08")
  const noSessionRows = rows.filter((r): r is NoSessionLine => r.kind !== "pending" && !opensSession(r))
  const pendingCount = rows.filter((r) => r.kind === "pending").length
  const sessionRows = rows.filter(opensSession)

  /** Provisional `/n`: the order added, across both tables -- what the backend numbers. */
  const lineNumbers = new Map(sessionRows.map((row, index) => [row.key, index + 1]))

  /** Fixed by the first material added; null while the request is empty. */
  const requestPlant = rows.length > 0 ? rows[0].plant : null
  const plantName = requestPlant ? sapPlantName(requestPlant) : null
  const department = requestPlant && picked.plant === requestPlant ? picked.code : ""

  const readyCount = sessionRows.filter(isReady).length
  const headerReady = fromSap || (requester.trim().length > 0 && department.length > 0)
  const canSubmit =
    headerReady && pendingCount === 0 && sessionRows.length > 0 && readyCount === sessionRows.length

  async function add(picked: Picked) {
    if (requestPlant && picked.plant !== requestPlant) {
      toast.error(`This request is for plant ${requestPlant}`, {
        description: `${picked.materialId} is at ${picked.plant}. One request covers one plant. Start another for ${picked.plant}.`,
      })
      return
    }
    if (rows.length >= maxLines) {
      toast.error(`A request holds up to ${maxLines} materials`, {
        description: "Submit this one and start another for the rest.",
      })
      return
    }
    if (isDuplicate(rows, picked.materialId, picked.plant)) {
      toast.error(`${picked.materialId} at ${picked.plant} is already on this request`, {
        description: "Change the quantity on its row instead of adding it twice.",
      })
      return
    }
    const pending = pendingLine(picked.materialId, picked.plant, picked.description)
    setRows((current) => [...current, pending])
    try {
      const response = await previewRequest([{ materialId: picked.materialId, plant: picked.plant }])
      setMaxLines(response.maxLines)
      if (response.reasonCategories?.length) setReasons(response.reasonCategories)
      if (response.faultCategories?.length) setFaultCategories(response.faultCategories)
      if (response.recommendations?.length) setRecommendations(response.recommendations)
      const [preview] = response.lines
      setRows((current) =>
        current.map((row) =>
          row.key === pending.key
            ? lineFromPreview({ ...preview, materialDescription: preview.materialDescription ?? picked.description }, pending.key)
            : row
        )
      )
    } catch (error) {
      setRows((current) => current.filter((row) => row.key !== pending.key))
      if (isNotEnabled(error)) {
        setNotEnabled(true)
        return
      }
      toast.error(`Could not check ${picked.materialId}`, {
        description: error instanceof Error ? error.message : "The backend did not answer.",
      })
    }
  }

  /** Fill the screen from a re-checked draft, header and lines together. */
  function applyDraft(draft: RequestDraft, result: RecheckedDraft) {
    if (result.notEnabled) {
      setNotEnabled(true)
      return
    }
    if (result.maxLines !== null) setMaxLines(result.maxLines)
    if (result.reasons?.length) setReasons(result.reasons)
    if (result.stale) {
      // Kept what was typed: the submit re-checks anyway and reports what moved.
      toast.warning("Could not re-check the draft's materials", {
        description: "The figures shown are from when it was saved. Submitting checks them again.",
      })
    }
    savedDraftId.current = draft.id
    setSavedAt(draft.savedAt)
    setOrigin(draft.origin)
    setRequester(draft.requester)
    setPicked({ plant: draft.departmentPlant, code: draft.department })
    setDepartmentNote(draft.departmentNote)
    setRows(result.rows)
  }

  /** The link's material is line 1 -- unless a draft is being resumed. Once: a ref survives Strict Mode's re-run. */
  const started = useRef(false)
  useEffect(() => {
    if (!entry || draftId || started.current) return
    started.current = true
    void add({ materialId: entry.materialId, plant: entry.plant, description: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the first render's link
  }, [])

  /** The draft named by the link, re-checked, then shown. Once, like the link's material. */
  const resumed = useRef(false)
  useEffect(() => {
    if (!draftId || resumed.current) return
    resumed.current = true
    const draft = getDraft(draftId)
    if (!draft) {
      toast.error("That draft is not in this browser", {
        description: "Drafts are kept only in the browser they were saved in. Start a new request instead.",
      })
      return
    }
    void recheckDraft(draft.rows).then((result) => applyDraft(draft, result))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the first render's draft
  }, [])

  function saveAsDraft() {
    const id = savedDraftId.current ?? newDraftKey()
    const now = new Date().toISOString()
    const stored = saveDraft({
      id,
      savedAt: now,
      requester: requester.trim(),
      departmentPlant: picked.plant,
      department: picked.code,
      departmentNote,
      origin,
      rows: rows.filter((row) => row.kind !== "pending"),
    })
    if (!stored) {
      toast.error("Could not save the draft", {
        description: "This browser would not store it (storage blocked or full). Nothing was lost from the screen.",
      })
      return
    }
    savedDraftId.current = id
    setSavedAt(now)
    toast.success("Draft saved in this browser", {
      description: "Nothing is recorded and no reference is given until you submit. Find it under Requests → Drafts.",
    })
  }

  function update(next: DraftLine) {
    if (next.key === refusedKey) setRefusedKey(null)
    setRows((current) => current.map((row) => (row.key === next.key ? next : row)))
  }

  function remove(key: string) {
    const next = rows.filter((row) => row.key !== key)
    setRows(next)
    if (key === refusedKey) setRefusedKey(null)
  }

  function changePlant() {
    setRows([])
    setRefusedKey(null)
  }

  function applyToOar(change: (row: OarLine) => OarLine) {
    setRows((current) =>
      current.map((row) => (row.kind === "i13" && row.decision === "proceed" ? change(row) : row))
    )
  }

  /** After a 409: re-check the rows whose suggestion moved, keeping what was typed. */
  async function recheck(materialIds: string[]) {
    const stale = rows.filter((row) => materialIds.includes(row.materialId))
    if (stale.length === 0) return
    const response = await previewRequest(stale.map((row) => ({ materialId: row.materialId, plant: row.plant })))
    setRows((current) =>
      current.map((row) => {
        const index = stale.findIndex((s) => s.key === row.key)
        return index < 0 ? row : lineFromPreview(response.lines[index], row.key, row)
      })
    )
  }

  async function submit() {
    if (!canSubmit) {
      setShowErrors(true)
      toast.error("Some rows still need answers", {
        description: !headerReady
          ? "Fill in the requester and pick the department first."
          : pendingCount > 0
            ? "Wait for every material to finish checking."
            : "Each row's status says what is missing.",
      })
      return
    }
    setSubmitting(true)
    const submitted = rows.filter((row) => row.kind !== "pending")
    try {
      const request = await createRequest({
        idempotencyKey: draftKey.current,
        plant: requestPlant ?? "",
        requestedFor: requester.trim() || null,
        department,
        departmentNote: departmentNote.trim() || null,
        origin,
        lines: submitted.map(answersOf),
      })
      if (savedDraftId.current) deleteDraft(savedDraftId.current)
      router.push(`/assistant/requests/${request.requestId}`)
      return
    } catch (error) {
      const conflict = conflictDetail(error)
      const refused = refusedDetail(error)
      if (conflict) {
        await recheck(conflict.changed.map((c) => c.materialId)).catch(() => undefined)
        toast.warning("Stock figures changed since you added these", {
          description: `${conflict.changed.map((c) => c.materialId).join(", ")}: the suggestion moved. Review the rows marked Updated and submit again.`,
        })
      } else if (refused) {
        const row = refused.line ? submitted[refused.line - 1] : undefined
        setRefusedKey(row?.key ?? null)
        toast.error(row ? `Line ${row.materialId} was refused` : "The request was refused", {
          description: `${refused.message} Nothing was recorded.`,
        })
      } else if (isNotEnabled(error)) {
        setNotEnabled(true)
      } else {
        toast.error("Could not submit the request", {
          description: `${error instanceof Error ? error.message : "The backend did not answer."} Nothing was recorded; submit again.`,
        })
      }
    }
    setSubmitting(false)
  }

  if (notEnabled) return <NotEnabledNotice />

  return (
    <div className="flex flex-col gap-5 pb-28 [&_input]:min-h-11 [&_select]:min-h-11">
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <StepHeading n={1}>Who is it for</StepHeading>
        <div className="grid gap-3 sm:grid-cols-3">
          <LabelledInput
            id="req-requester"
            label="Requester"
            value={requester}
            onChange={setRequester}
            placeholder="who the parts are for"
            invalid={showErrors && !fromSap && !requester.trim()}
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Plant</span>
            {requestPlant ? (
              <div className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-action/10 px-3 text-sm">
                <span className="font-mono font-semibold">{requestPlant}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{plantName}</span>
                <Button type="button" variant="ghost" size="xs" onClick={changePlant}>
                  Change
                </Button>
              </div>
            ) : (
              <div className="flex min-h-11 items-center rounded-lg border border-dashed border-border px-3 text-xs text-muted-foreground">
                Set by the first material you add
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="req-department" className="text-sm font-medium text-foreground">
              Department
            </label>
            {requestPlant ? (
              // Keyed by plant: a new plant starts the search afresh.
              <DepartmentPicker
                key={requestPlant}
                id="req-department"
                plant={requestPlant}
                load={loadDepartments}
                value={department}
                invalid={showErrors && !fromSap && !department}
                onChange={(code) => setPicked({ plant: requestPlant, code })}
              />
            ) : (
              <div className="flex min-h-11 items-center rounded-lg border border-dashed border-border px-3 text-xs text-muted-foreground">
                Pick once the plant is set
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="req-department-note" className="text-sm font-medium text-foreground">
            Department note <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Input
            id="req-department-note"
            value={departmentNote}
            onChange={(e) => setDepartmentNote(e.target.value)}
            placeholder="anything else about the department, e.g. section or crew"
            maxLength={DEPARTMENT_NOTE_MAX}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          One request is for one plant and one department. The first material you add sets the plant; the department
          you pick applies to every material on the request.
          {fromSap && " Opened from SAP: the requester and department are optional."}
        </p>
      </section>

      <AddMaterials rows={rows} requestPlant={requestPlant} maxLines={maxLines} onAdd={add} />

      {rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Add materials above. Each one is checked and goes to the right table automatically.
        </div>
      )}

      {pendingCount > 0 && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Checking {pendingCount} material{pendingCount === 1 ? "" : "s"}…
        </p>
      )}

      {oarRows.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle
            icon={<Boxes className="size-4" />}
            title="OAR materials"
            subtitle="Planned-on-demand (OAR) spares: the assistant suggests a quantity first, then the consumption window."
            count={oarRows.length}
          />
          <OarApplyAll rows={oarRows} reasons={reasons} onApply={applyToOar} />
          <OarTable
            rows={oarRows}
            lineNumbers={lineNumbers}
            showErrors={showErrors}
            reasons={reasons}
            refusedKey={refusedKey}
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
            subtitle="Repairable spares: use the unit that exists, or say why a new one is needed."
            count={repairableRows.length}
          />
          <JustificationApplyAll
            label="Same reason for every new unit"
            reasons={reasons}
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
            reasons={reasons}
            faultCategories={faultCategories}
            recommendations={recommendations}
            requester={requester}
            refusedKey={refusedKey}
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
                  {row.kind === "out_of_scope" ? "Out of scope" : row.kind === "data_gap" ? "No data" : "Not accepted"}
                </Chip>
                <Button type="button" variant="ghost" size="xs" onClick={() => remove(row.key)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-sm font-semibold text-foreground">
            {sessionRows.length === 0
              ? "No materials that need the assistant yet"
              : `${readyCount} of ${sessionRows.length} line${sessionRows.length === 1 ? "" : "s"} ready`}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {rows.length} / {maxLines} materials
            </span>
          </span>
          {sessionRows.length > 0 && (
            <div
              role="progressbar"
              aria-label="Lines ready"
              aria-valuemin={0}
              aria-valuemax={sessionRows.length}
              aria-valuenow={readyCount}
              className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${(readyCount / sessionRows.length) * 100}%` }}
              />
            </div>
          )}
          <span className="text-xs font-medium text-foreground">
            {!headerReady
              ? "Fill in the requester and pick the department."
              : pendingCount > 0
                ? "Wait for every material to finish checking."
                : sessionRows.length > 0 && readyCount < sessionRows.length
                  ? "Each line's status says what is missing."
                  : rows.length > 0
                    ? "Ready to submit."
                    : "Add a material to start."}
          </span>
          <span className="text-[11px] text-muted-foreground">
            Submitting records every line, or nothing, and gives one request reference. Type it once into the SAP
            reservation&rsquo;s header text; lines are shown here as reference/1, /2 …
          </span>
          {savedAt && (
            <span className="text-[11px] text-muted-foreground">
              Draft saved {new Date(savedAt).toLocaleString("en-GB")} in this browser only.
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={saveAsDraft}
          disabled={submitting || pendingCount > 0 || (rows.length === 0 && !requester.trim())}
          title={
            pendingCount > 0
              ? "Wait for every material to finish checking"
              : "Keep this request in this browser and finish it later. Nothing is recorded until you submit."
          }
          className="min-h-11 gap-1.5 px-4 font-semibold"
        >
          <Save className="size-4" aria-hidden />
          Save as draft
        </Button>
        <Button type="button" size="lg" onClick={submit} disabled={submitting} className="min-h-11 gap-1.5 px-5 text-base font-semibold">
          {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {submitting ? "Submitting…" : "Submit request"}
          {!submitting && <ArrowRight className="size-4" aria-hidden />}
        </Button>
      </footer>
    </div>
  )
}

export function NotEnabledNotice() {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-6 text-sm">
      <span className="font-medium text-foreground">Requests are not switched on yet.</span>
      <span className="text-muted-foreground">
        The backend answers these routes only when ASSISTANT_REQUESTS_ENABLED is set. Until then, check one material at
        a time from the assistant.
      </span>
    </div>
  )
}

/** A numbered step: the number in a filled circle, then the step's name. */
function StepHeading({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 text-base font-semibold text-foreground">
      <span aria-hidden className="grid size-7 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {n}
      </span>
      <span>
        <span className="sr-only">Step {n}: </span>
        {children}
      </span>
    </h2>
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
      <span className="mt-0.5 inline-flex size-8 items-center justify-center rounded-lg bg-action/10 text-action">{icon}</span>
      <div className="flex flex-col">
        <h2 className="text-base font-semibold text-foreground">
          {title} <span className="font-normal text-muted-foreground">({count})</span>
        </h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
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
      <Input id={id} value={value} aria-invalid={invalid} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

/** The backend's limit on the department note. */
const DEPARTMENT_NOTE_MAX = 200

/** The picker's list, through the demo-aware request API. Module-level so it is stable. */
function loadDepartments(plant: string) {
  return requestDepartments(plant)
}

// --- adding materials -----------------------------------------------------------

const SEARCH_DEBOUNCE_MS = 250

function AddMaterials({
  rows,
  requestPlant,
  maxLines,
  onAdd,
}: {
  rows: DraftLine[]
  /** Once set, only this plant's materials can be added. */
  requestPlant: string | null
  maxLines: number
  onAdd: (picked: Picked) => void
}) {
  const [query, setQuery] = useState("")
  const [typedPlant, setTypedPlant] = useState<string>(REQUEST_PLANTS[0])
  const [results, setResults] = useState<{ query: string; items: ApiMaterialMatch[]; error: string | null } | null>(null)
  const plant = requestPlant ?? typedPlant
  const typedNumber = /^\d{3,18}$/.test(query.replace(/[\s-]/g, "")) ? query.replace(/[\s-]/g, "") : null
  const searching = query.trim().length >= 2 && results?.query !== query

  useEffect(() => {
    const text = query.trim()
    if (text.length < 2) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      searchRequestMaterials(text, controller.signal)
        .then((items) => setResults({ query, items, error: null }))
        .catch((error) => {
          if (controller.signal.aborted) return
          setResults({ query, items: [], error: error instanceof Error ? error.message : "Search failed" })
        })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query])

  const matches = (results?.items ?? []).filter((m) => !requestPlant || m.plant === requestPlant)
  const added = (m: { materialId: string; plant: string }) => isDuplicate(rows, m.materialId, m.plant)
  const full = rows.length >= maxLines

  function pick(picked: Picked) {
    onAdd(picked)
    setQuery("")
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <StepHeading n={2}>Add materials</StepHeading>
      <p className="-mt-2 text-xs text-muted-foreground">
        {requestPlant
          ? `Showing plant ${requestPlant} only: this request is for ${requestPlant}.`
          : "The first material you add sets the request's plant."}{" "}
        {full && <span className="text-warning">This request is full ({maxLines} materials).</span>}
      </p>
      <div className="relative flex flex-col gap-1.5">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search materials"
            value={query}
            disabled={full}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Material number or part of its name"
            className="pl-8"
          />
          {searching && (
            <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
        {query.trim().length >= 2 && !searching && (
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-popover text-sm shadow-md">
            {matches.map((m) => (
              <li key={`${m.materialId}-${m.plant}`}>
                <button
                  type="button"
                  disabled={added(m)}
                  onClick={() => pick({ materialId: m.materialId, plant: m.plant, description: m.description })}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted disabled:opacity-50"
                >
                  <span className="font-mono text-xs font-semibold">{m.materialId}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {m.description ?? <span className="text-muted-foreground italic">No description</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">Plant {m.plant}</span>
                  <Chip tone="muted">{m.flowHint === "i13" ? "OAR" : m.flowHint === "i08" ? "Repairable" : "Neither"}</Chip>
                  {added(m) ? <Chip tone="muted">Added</Chip> : <Plus className="size-4 text-action" aria-hidden />}
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
                  disabled={!!requestPlant}
                  onChange={(e) => setTypedPlant(e.target.value)}
                >
                  {REQUEST_PLANTS.map((code) => (
                    <option key={code} value={code}>
                      {code} {sapPlantName(code)}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => pick({ materialId: typedNumber, plant, description: null })}
                >
                  <Plus /> Add
                </Button>
              </li>
            )}
            {matches.length === 0 && !typedNumber && (
              <li className="px-3 py-2 text-xs text-muted-foreground">
                {results?.error ?? `No material ${requestPlant ? `at plant ${requestPlant} ` : ""}matches.`}
              </li>
            )}
          </ul>
        )}
      </div>

    </section>
  )
}

// --- apply to all ------------------------------------------------------------------

function OarApplyAll({
  rows,
  reasons,
  onApply,
}: {
  rows: OarLine[]
  reasons: readonly ApiReasonCategory[]
  onApply: (change: (row: OarLine) => OarLine) => void
}) {
  const [purpose, setPurpose] = useState("")
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  const active = rows.filter((r) => r.decision === "proceed").length

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
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
        reasons={reasons}
        disabled={!rows.some(oarNeedsJustification)}
        onApply={(j) => onApply((row) => (oarNeedsJustification(row) ? { ...row, justification: j } : row))}
        embedded
      />
    </div>
  )
}

function JustificationApplyAll({
  label,
  reasons,
  disabled,
  onApply,
  embedded = false,
}: {
  label: string
  reasons: readonly ApiReasonCategory[]
  disabled: boolean
  onApply: (j: Justification) => void
  embedded?: boolean
}) {
  const [value, setValue] = useState<Justification>(EMPTY_JUSTIFICATION)
  return (
    <div className={cn("flex flex-wrap items-center gap-2", !embedded && "rounded-xl border border-border bg-card p-4")}>
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <select
        aria-label={`${label}: reason`}
        className={cn(SELECT_CLASS, "w-48")}
        value={value.reasonCategory}
        disabled={disabled}
        onChange={(e) => setValue({ ...value, reasonCategory: e.target.value })}
      >
        <option value="">Choose a reason…</option>
        {reasons.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Input
        aria-label={`${label}: text`}
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
