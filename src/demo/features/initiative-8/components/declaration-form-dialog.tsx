"use client"

import { useMemo, useState, type JSX, type ReactNode } from "react"
import { Lock } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@demo/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@demo/components/ui/dialog"
import { Input } from "@demo/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@demo/components/ui/select"
import { FAULT_CATEGORIES } from "@demo/features/initiative-8/data/declarations"
import { isOpenLine } from "@demo/features/initiative-8/model/metrics"
import {
  snapshotStore,
  useI08Snapshot,
  type DeclarationInput,
} from "@demo/features/initiative-8/state/snapshot-store"
import type {
  DeclarationCondition,
  DeclarationRecord,
  RepairChain,
} from "@demo/features/initiative-8/types/repair"
import { DECLARATION_CONDITIONS, codeLabel } from "@demo/features/initiative-8/utils/status"
import { cn, formatCount } from "@demo/lib/utils"

/** A repair line the form is fixed to — its material, plant and session. */
export type DeclarationFormTarget = {
  lineId: string
  materialId: string
  plantId: string
  /** The line under the title, saying which part this is. */
  label: string
  defaultQuantity: number
  sessionId?: string
}

/** Select value for "declared ahead of the repair PO" — no line named. */
const NO_LINE = "none"

const TEXTAREA_CLASS =
  "w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"

function parseQuantity(text: string): number | undefined {
  const value = Number(text)
  return text.trim() !== "" && Number.isFinite(value) && value > 0 ? value : undefined
}

function lineOption(line: RepairChain): string {
  return `${line.id} — ${line.repairStatus} at ${line.vendor}, raised ${line.raisedAt}`
}

/**
 * What the write achieved, in the words the toast uses. Worked out from the
 * same rule the register applies (`declarationStatusFor`): Repairable covers a
 * line as Completed; anything else on a live line reads Flagged; on a line
 * already scrapped the assessment and the outcome agree.
 */
function coverageNote(input: DeclarationInput, lines: RepairChain[]): string {
  const named = lines.filter((l) => input.repairLineIds.includes(l.id))
  if (named.length === 0) {
    return input.condition === "Repairable"
      ? "Awaiting a repair PO — the repair line raised for this part will name it."
      : `Assessed ${input.condition}: no repair PO should follow, so none is awaited.`
  }
  const ids = named.map((l) => l.id).join(", ")
  if (input.condition === "Repairable") return `Covers ${ids} — the line now reads Completed.`
  if (named.every((l) => l.repairStatus === "Scrapped")) {
    return `Covers ${ids} — assessed ${input.condition} and the line was scrapped, so it reads Completed.`
  }
  return `Flagged: assessed ${input.condition} but a repair is raised (${ids}).`
}

function Field({
  label,
  htmlFor,
  optional,
  children,
  hint,
  hintTone = "muted",
}: {
  label: string
  htmlFor?: string
  optional?: boolean
  children: ReactNode
  hint?: ReactNode
  hintTone?: "muted" | "warning" | "danger"
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label className="text-xs text-muted-foreground" htmlFor={htmlFor}>
        {label} {optional && <span className="italic">(optional)</span>}
      </label>
      {children}
      {hint && (
        <p
          className={cn(
            "text-[11px]",
            hintTone === "danger"
              ? "text-destructive"
              : hintTone === "warning"
                ? "text-amber-700 dark:text-amber-400"
                : "text-muted-foreground",
          )}
        >
          {hint}
        </p>
      )}
    </div>
  )
}

/**
 * The condition-to-repair declaration form (FR-4) — Initiative 8's only write.
 *
 * Three ways in, one form:
 *
 *   **From the part** (no `target`, no `amend`) — the Declarations screen. The
 *   person picks the material and plant, because the FRS has the part declared
 *   when it comes off the machine, before any repair PO exists. A repair line
 *   still owed a declaration can be named, or none.
 *
 *   **From a repair line** (`target`) — the line's material, plant and session
 *   are fixed; the declaration covers that line.
 *
 *   **An amendment** (`amend`) — a declaration is locked once recorded, so a
 *   correction is a new record that supersedes the old one, with a reason.
 *   The original stays on record, unchanged.
 *
 * Mount it fresh for each opening (a new `key`), so a second declaration never
 * starts from the first one's half-typed fields. Nothing is posted to SAP: the
 * record lives in this browser session's Snapshot and shows on every screen.
 */
export function DeclarationFormDialog({
  open,
  onClose,
  target,
  amend,
}: {
  open: boolean
  onClose: () => void
  target?: DeclarationFormTarget
  amend?: DeclarationRecord
}): JSX.Element {
  const snapshot = useI08Snapshot()

  const [materialId, setMaterialId] = useState(amend?.material.materialId ?? target?.materialId ?? "")
  const [plantId, setPlantId] = useState(amend?.plant.plantId ?? target?.plantId ?? "")
  const [lineId, setLineId] = useState(target?.lineId ?? amend?.repairLineIds[0] ?? NO_LINE)
  const [condition, setCondition] = useState<DeclarationCondition>(amend?.condition ?? "Repairable")
  // No default fault category on a new declaration: it is an audit record,
  // and a pre-picked "bearing failure" left untouched would read as an answer.
  const [faultCategory, setFaultCategory] = useState(amend?.faultCategory ?? "")
  const [description, setDescription] = useState(amend?.conditionDescription ?? "")
  // Kept as the typed string so a half-typed value is not reformatted under
  // the cursor; parsed once, for the button and the record.
  const [quantity, setQuantity] = useState(String(amend?.quantity ?? target?.defaultQuantity ?? 1))
  const [serialNumber, setSerialNumber] = useState(amend?.serialNumber ?? "")
  const [evidence, setEvidence] = useState(amend?.evidenceReference ?? "")
  const [sessionId, setSessionId] = useState(amend?.sessionId ?? target?.sessionId ?? "")
  const [reason, setReason] = useState("")

  const fixedPart = Boolean(target || amend)
  // An amendment keeps the lines its original named; one declared ahead of
  // the repair PO can name the line raised since.
  const fixedLines = target ? [target.lineId] : amend && amend.repairLineIds.length > 0 ? amend.repairLineIds : undefined

  const materials = useMemo(() => {
    const seen = new Map<string, string>()
    for (const row of snapshot.universe) seen.set(row.material.materialId, row.material.description)
    return [...seen].map(([id, description]) => ({ id, description })).sort((a, b) => a.id.localeCompare(b.id))
  }, [snapshot.universe])

  const plants = snapshot.universe.filter((row) => row.material.materialId === materialId)
  const universeRow = plants.find((row) => row.plant.plantId === plantId)
  const owedLines = snapshot.lines.filter(
    (l) =>
      l.material.materialId === materialId &&
      l.plant.plantId === plantId &&
      isOpenLine(l) &&
      l.declarationStatus === "Required",
  )
  const repairLineIds = fixedLines ?? (lineId === NO_LINE ? [] : [lineId])

  const parsedQuantity = parseQuantity(quantity)
  const session = sessionId.trim() ? snapshot.sessions.find((s) => s.id === sessionId.trim()) : undefined

  const input: DeclarationInput = {
    materialId,
    plantId,
    quantity: parsedQuantity ?? 0,
    condition,
    faultCategory,
    conditionDescription: description.trim(),
    // Omitted rather than blank: an empty string on an audit record reads as
    // "the serial number is empty".
    serialNumber: serialNumber.trim() || undefined,
    evidenceReference: evidence.trim() || undefined,
    repairLineIds,
    sessionId: sessionId.trim() || undefined,
  }

  const unchanged =
    amend !== undefined &&
    amend.condition === input.condition &&
    amend.faultCategory === input.faultCategory &&
    amend.conditionDescription === input.conditionDescription &&
    amend.quantity === input.quantity &&
    (amend.serialNumber ?? "") === (input.serialNumber ?? "") &&
    (amend.evidenceReference ?? "") === (input.evidenceReference ?? "") &&
    (amend.sessionId ?? "") === (input.sessionId ?? "") &&
    amend.repairLineIds.join() === input.repairLineIds.join()

  const valid =
    materialId !== "" &&
    plantId !== "" &&
    faultCategory !== "" &&
    input.conditionDescription !== "" &&
    parsedQuantity !== undefined &&
    (!amend || (reason.trim() !== "" && !unchanged))

  function chooseMaterial(next: string) {
    setMaterialId(next)
    // The plant list is the material's own; one plant is picked for you.
    const options = snapshot.universe.filter((row) => row.material.materialId === next)
    setPlantId(options.length === 1 ? options[0].plant.plantId : "")
    setLineId(NO_LINE)
  }

  function chooseLine(next: string) {
    setLineId(next)
    const line = owedLines.find((l) => l.id === next)
    if (line) setQuantity(String(line.quantity))
  }

  function submit() {
    if (!valid) return
    const record = amend ? snapshotStore.amend(amend, input, reason.trim()) : snapshotStore.declare(input)
    toast.success(
      amend ? `Declaration ${record.id} recorded — amends ${amend.id}` : `Declaration ${record.id} recorded`,
      {
        description: `${coverageNote(input, snapshot.lines)} Not posted to SAP.`,
        duration: 10000,
      },
    )
    onClose()
  }

  const title = amend ? `Amend declaration ${amend.id}` : target ? "Declare condition" : "Declare a part"
  const subtitle = amend
    ? `${amend.material.materialId} — ${amend.material.description}, ${amend.plant.name}. Declared ${amend.declaredAt} by ${amend.declaredBy}.`
    : target
      ? target.label
      : "Assess the part when it comes off the machine, before it is sent anywhere. Name the repair line it goes out on, or leave it for the repair PO raised later."

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        {amend && (
          <p className="flex gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <Lock className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {amend.id} is locked. This records a new declaration that supersedes it; {amend.id} stays on
              record unchanged and reads Amended, with the reason given here.
            </span>
          </p>
        )}

        {!fixedPart && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_12rem]">
            <Field
              label="Material"
              htmlFor="declaration-material"
              hint={
                universeRow
                  ? universeRow.stockOnHand === undefined
                    ? `No stock record (MARD) at ${universeRow.plant.name}.`
                    : `${formatCount(universeRow.stockOnHand)} on hand at ${universeRow.plant.name}` +
                      (universeRow.qtyUnderRepair > 0
                        ? `, ${formatCount(universeRow.qtyUnderRepair)} under repair.`
                        : ".")
                  : "An 80-series part in the repairable universe."
              }
            >
              <Select value={materialId || null} onValueChange={(v) => chooseMaterial(v ?? "")}>
                <SelectTrigger id="declaration-material" className="h-9 w-full">
                  <SelectValue placeholder="Select a material">
                    {(value: string | null) => {
                      const m = materials.find((x) => x.id === value)
                      return m ? `${m.id} — ${m.description}` : "Select a material"
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {materials.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.id} — {m.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Plant" htmlFor="declaration-plant">
              <Select
                value={plantId || null}
                onValueChange={(v) => {
                  setPlantId(v ?? "")
                  setLineId(NO_LINE)
                }}
                disabled={materialId === ""}
              >
                <SelectTrigger id="declaration-plant" className="h-9 w-full">
                  <SelectValue placeholder="Select a plant">
                    {(value: string | null) =>
                      plants.find((p) => p.plant.plantId === value)?.plant.name ?? "Select a plant"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {plants.map((p) => (
                    <SelectItem key={p.plant.plantId} value={p.plant.plantId}>
                      {p.plant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        )}

        {fixedLines ? (
          !target && (
            <p className="text-xs text-muted-foreground">
              Covers repair line{fixedLines.length > 1 ? "s" : ""} {fixedLines.join(", ")}.
            </p>
          )
        ) : (
          <Field
            label="Repair line"
            htmlFor="declaration-line"
            optional
            hint={
              plantId === ""
                ? "Pick the material and plant first."
                : owedLines.length === 0
                  ? "No open repair line for this part is owed a declaration."
                  : "Naming the line makes the link explicit — nothing is matched by date."
            }
          >
            <Select value={lineId} onValueChange={(v) => chooseLine(v ?? NO_LINE)} disabled={plantId === ""}>
              <SelectTrigger id="declaration-line" className="h-9 w-full">
                <SelectValue>
                  {(value: string) => {
                    const line = owedLines.find((l) => l.id === value)
                    return line ? lineOption(line) : "None — declared ahead of the repair PO"
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_LINE}>None — declared ahead of the repair PO</SelectItem>
                {owedLines.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {lineOption(l)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="Condition"
            htmlFor="declaration-condition"
            hint={
              condition === "Repairable"
                ? "Worth repairing: the repair line it goes out on reads Completed."
                : "Not worth repairing: no repair PO should follow. If one is raised anyway, its line reads Flagged."
            }
          >
            <Select value={condition} onValueChange={(v) => v && setCondition(v as DeclarationCondition)}>
              <SelectTrigger id="declaration-condition" className="h-9 w-full">
                <SelectValue>{(value: string) => value}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DECLARATION_CONDITIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Fault category" htmlFor="declaration-fault">
            <Select value={faultCategory || null} onValueChange={(v) => setFaultCategory(v ?? "")}>
              <SelectTrigger id="declaration-fault" className="h-9 w-full">
                <SelectValue placeholder="Select a fault category">
                  {(value: string | null) => (value ? codeLabel(value) : "Select a fault category")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {FAULT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {codeLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field
          label="Condition description"
          htmlFor="declaration-description"
          hint="Required. This is an audit record: it is locked once recorded and can only be changed by an amendment, which keeps the original."
        >
          <textarea
            id="declaration-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is wrong with it, and what did you measure?"
            className={TEXTAREA_CLASS}
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="Quantity"
            htmlFor="declaration-quantity"
            hint={parsedQuantity === undefined ? "Must be greater than 0." : "Units assessed."}
            hintTone={parsedQuantity === undefined ? "danger" : "muted"}
          >
            <Input
              id="declaration-quantity"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              aria-invalid={parsedQuantity === undefined}
            />
          </Field>
          <Field label="Serial number" htmlFor="declaration-serial" optional>
            <Input
              id="declaration-serial"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="As stamped on the unit"
              autoComplete="off"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* A reference, not an upload: the platform does not pretend to hold
              the photo or report itself, only where it is kept. */}
          <Field
            label="Evidence reference"
            htmlFor="declaration-evidence"
            optional
            hint="Where the photos or report are kept — no file is uploaded."
          >
            <Input
              id="declaration-evidence"
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder="e.g. inspection report number"
              autoComplete="off"
            />
          </Field>
          <Field
            label="Session ID"
            htmlFor="declaration-session"
            optional
            hintTone={sessionId.trim() && !session ? "warning" : "muted"}
            hint={
              !sessionId.trim()
                ? "The Spares Assistant session behind this repair, if there was one."
                : !session
                  ? "No assistant session carries this ID — check the reservation's item text."
                  : session.materialId !== materialId || session.plantId !== plantId
                    ? `That session was for ${session.materialId} at ${session.plant.name}, not this part.`
                    : `Opened ${session.openedAt} by ${session.requester}.`
            }
          >
            <Input
              id="declaration-session"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value.toUpperCase())}
              placeholder="e.g. SK4T7QW2MD"
              autoComplete="off"
            />
          </Field>
        </div>

        {amend && (
          <Field
            label="Reason for amendment"
            htmlFor="declaration-reason"
            hintTone={unchanged ? "warning" : "muted"}
            hint={
              unchanged
                ? "Nothing has changed from the original yet — an amendment must correct something."
                : "Required. Recorded on the new declaration, beside the one it replaces."
            }
          >
            <textarea
              id="declaration-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="What was wrong with the original, and how you know"
              className={TEXTAREA_CLASS}
            />
          </Field>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid}>
            {amend ? "Record amendment" : "Confirm declaration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
