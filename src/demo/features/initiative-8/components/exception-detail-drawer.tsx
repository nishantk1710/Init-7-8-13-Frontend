"use client"

import Link from "next/link"
import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import {
  CircleCheck,
  ClipboardCheck,
  ExternalLink,
  MessageSquare,
  Play,
  ReceiptText,
  RotateCcw,
  Archive,
} from "lucide-react"
import { toast } from "sonner"

import { DetailDrawer } from "@demo/components/shared/detail-drawer"
import { MaterialIdentity } from "@demo/components/shared/material-identity"
import { SAPDocumentChip } from "@demo/components/shared/sap-document-chip"
import { StatusBadge } from "@demo/components/shared/status-badge"
import { Timeline, type TimelineEvent } from "@demo/components/shared/timeline"
import { Button, buttonVariants } from "@demo/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@demo/components/ui/select"
import {
  DeclarationFormDialog,
  type DeclarationFormTarget,
} from "@demo/features/initiative-8/components/declaration-form-dialog"
import { exceptionAgeOf } from "@demo/features/initiative-8/components/exception-queue-table"
import { RecordJustificationDialog } from "@demo/features/initiative-8/components/record-justification-dialog"
import { EXCEPTION_OWNERS } from "@demo/features/initiative-8/data/exceptions"
import { snapshotStore, useI08Snapshot, YOU } from "@demo/features/initiative-8/state/snapshot-store"
import type {
  ExceptionEvent,
  ExceptionEventKind,
  RepairChain,
  RepairException,
} from "@demo/features/initiative-8/types/repair"
import {
  EXCEPTION_SEVERITY_TONE,
  EXCEPTION_STATUS_LABEL,
  EXCEPTION_STATUS_TONE,
  exceptionTypeLabel,
  isOpenException,
  type Tone,
} from "@demo/features/initiative-8/utils/status"
import { useMaterial360 } from "@demo/lib/material-360-context"
import { cn } from "@demo/lib/utils"

const KIND_LABEL: Record<ExceptionEventKind, string> = {
  RAISED: "raised it",
  ASSIGNED: "assigned it",
  COMMENT: "commented",
  STATUS: "changed the status",
  AUTO_RESOLVED: "resolved it automatically",
}

/** A history entry as one timeline step, coloured by the status it set. */
function historyStep(event: ExceptionEvent, index: number): TimelineEvent {
  const tone: Tone =
    event.status === "RESOLVED"
      ? "success"
      : event.status === "OPEN"
        ? "danger"
        : event.status === "IN_PROGRESS"
          ? "warning"
          : "default"
  const label =
    event.kind === "STATUS" && event.status
      ? `${event.actor} set it to ${EXCEPTION_STATUS_LABEL[event.status]}`
      : `${event.actor} ${KIND_LABEL[event.kind]}`
  return { id: `${index}-${event.at}`, label, timestamp: event.at, description: event.text, tone }
}

const TEXTAREA_CLASS =
  "w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"

const LABEL_CLASS = "text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase"

/**
 * One Exception Queue item, opened from its row: what the check found, the
 * records it points at, its full history, and the controls to work it (FR-11).
 *
 * Only the id is held by the caller. The item is read from the snapshot on
 * every render, so an assignment, a comment or a status change shows here the
 * moment it is recorded — and so does the automatic resolution that follows a
 * declaration or a justification, because that is the check no longer finding
 * the item, not something this drawer writes.
 */
export function ExceptionDetailDrawer({
  exceptionId,
  open,
  onOpenChange,
}: {
  exceptionId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const snapshot = useI08Snapshot()
  const exception = exceptionId ? snapshot.exceptions.find((e) => e.id === exceptionId) : undefined
  const line = exception?.repairId ? snapshot.lines.find((l) => l.id === exception.repairId) : undefined

  return (
    <DetailDrawer
      open={open && exception !== undefined}
      onOpenChange={onOpenChange}
      title={exception?.title ?? "Exception"}
      description={exception ? `${exceptionTypeLabel(exception.type)} · ${exception.id}` : undefined}
    >
      {/* Keyed by id, so the note box and the dialogs start clean per item. */}
      {exception && <ExceptionDetail key={exception.id} exception={exception} line={line} />}
    </DetailDrawer>
  )
}

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-2", className)}>
      <h3 className={LABEL_CLASS}>{title}</h3>
      {children}
    </section>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-xs text-foreground">{children}</dd>
    </div>
  )
}

function ExceptionDetail({ exception, line }: { exception: RepairException; line?: RepairChain }) {
  const { openMaterial360 } = useMaterial360()
  const noteId = useId()
  const [note, setNote] = useState("")
  const [declareKey, setDeclareKey] = useState(0)
  const [declaring, setDeclaring] = useState(false)
  const [justifying, setJustifying] = useState(false)

  const open = isOpenException(exception)
  const age = exceptionAgeOf(exception)
  const trimmed = note.trim()

  // Set when a declaration or justification is started from here. Once the
  // check stops finding the item, say so — the queue resolved it, not us.
  const watchingForResolution = useRef(false)
  const detected = exception.stillDetected
  const resolution = [...exception.history].reverse().find((e) => e.kind === "AUTO_RESOLVED")?.text
  useEffect(() => {
    if (watchingForResolution.current && !detected) {
      watchingForResolution.current = false
      toast.success(`${exception.id} resolved itself`, {
        description: resolution ?? "The check no longer finds this item.",
        duration: 10000,
      })
    }
  }, [detected, exception.id, resolution])

  const owners = [YOU, ...EXCEPTION_OWNERS]
  if (exception.owner && !owners.includes(exception.owner)) owners.push(exception.owner)

  const declarationTarget: DeclarationFormTarget | undefined = line
    ? {
        lineId: line.id,
        materialId: line.material.materialId,
        plantId: line.plant.plantId,
        label: `${line.material.materialId} — ${line.material.description} (repair ${line.id})`,
        defaultQuantity: line.qtyUnderRepair || line.quantity,
        sessionId: line.sessionId,
      }
    : undefined

  const canDeclare =
    exception.type === "MISSING_ATTESTATION" && open && exception.stillDetected && declarationTarget !== undefined
  const canJustify =
    exception.type === "UNJUSTIFIED_ACQUISITION" &&
    open &&
    exception.stillDetected &&
    exception.acquisitionLine !== undefined

  function assign(owner: string) {
    if (owner === exception.owner) return
    snapshotStore.assignException(exception.id, owner)
    toast.success(`${exception.id} assigned to ${owner}`)
  }

  function startWork() {
    // Starting work on an unowned item takes it — somebody has to own it.
    if (!exception.owner) snapshotStore.assignException(exception.id, YOU)
    snapshotStore.setExceptionStatus(exception.id, "IN_PROGRESS", trimmed || "Work started.")
    setNote("")
    toast.success(`${exception.id} is in progress`)
  }

  function comment() {
    if (!trimmed) return
    snapshotStore.commentOnException(exception.id, trimmed)
    setNote("")
    toast.success(`Comment added to ${exception.id}`)
  }

  function resolve() {
    if (!trimmed) return
    snapshotStore.setExceptionStatus(exception.id, "RESOLVED", trimmed)
    setNote("")
    toast.success(`${exception.id} resolved`)
  }

  function close() {
    snapshotStore.setExceptionStatus(exception.id, "CLOSED", trimmed || "Reviewed and closed.")
    setNote("")
    toast.success(`${exception.id} closed`)
  }

  function reopen() {
    snapshotStore.setExceptionStatus(
      exception.id,
      "OPEN",
      trimmed || "Reopened — the check still finds this.",
    )
    setNote("")
    toast.success(`${exception.id} reopened`)
  }

  function startDeclaration() {
    watchingForResolution.current = true
    setDeclareKey((k) => k + 1)
    setDeclaring(true)
  }

  function startJustification() {
    watchingForResolution.current = true
    setJustifying(true)
  }

  const purchaseOrReservation = exception.acquisitionLine ?? exception.reservation

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge tone={EXCEPTION_STATUS_TONE[exception.status]}>
          {EXCEPTION_STATUS_LABEL[exception.status]}
        </StatusBadge>
        <StatusBadge tone={EXCEPTION_SEVERITY_TONE[exception.severity]}>{exception.severity}</StatusBadge>
        <StatusBadge>{exception.owner ? `Owner: ${exception.owner}` : "Unassigned"}</StatusBadge>
        {exception.preAutomation && <StatusBadge>Raised before Spares Automation</StatusBadge>}
        {!exception.stillDetected && <StatusBadge tone="success">No longer found by the check</StatusBadge>}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Fact label="Material">
          <MaterialIdentity material={exception.material} onOpen={openMaterial360} />
        </Fact>
        <Fact label="Plant">{exception.plant.name}</Fact>
        <Fact label="Raised">{exception.raisedAt}</Fact>
        <Fact label={open ? "Age" : exception.status === "CLOSED" ? "Closed" : "Resolved"}>
          {open
            ? `${age ?? 0} days open`
            : exception.status === "CLOSED"
              ? (exception.closedAt ?? "—")
              : (exception.resolvedAt ?? "—")}
        </Fact>
      </dl>

      <Section title="What the check found">
        <p className="text-xs leading-relaxed text-foreground">{exception.detail}</p>
      </Section>

      <Section title="Linked records">
        <div className="flex flex-wrap items-center gap-2">
          {exception.repairLine && <SAPDocumentChip doc={exception.repairLine} />}
          {purchaseOrReservation && <SAPDocumentChip doc={purchaseOrReservation} />}
          {line?.declarationId && (
            <StatusBadge tone="success">Declaration {line.declarationId}</StatusBadge>
          )}
          {!exception.repairLine && !purchaseOrReservation && (
            <span className="text-xs text-muted-foreground">No repair line or purchase on record.</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {exception.repairId && (
            <Link
              href={`/repairable-spares/repair-register/${exception.repairId}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ExternalLink className="size-3.5" />
              Open repair line {exception.repairId}
            </Link>
          )}
          {exception.type === "MISSING_ATTESTATION" && (
            <Link href="/repairable-spares/declarations" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <ExternalLink className="size-3.5" />
              Declarations
            </Link>
          )}
          {exception.type === "UNJUSTIFIED_ACQUISITION" && (
            <Link href="/repairable-spares/justifications" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <ExternalLink className="size-3.5" />
              Justification log
            </Link>
          )}
        </div>
      </Section>

      {(canDeclare || canJustify) && (
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <p className="text-xs text-foreground">
            {canDeclare
              ? "Record the part's condition against this repair line. The check then stops finding the item and it resolves itself, with the declaration in its history."
              : "Record why the new unit was bought. The justification names the purchase, so the check stops finding the item and it resolves itself."}
          </p>
          <div className="mt-2.5">
            {canDeclare ? (
              <Button size="sm" onClick={startDeclaration}>
                <ClipboardCheck className="size-3.5" />
                Declare condition
              </Button>
            ) : (
              <Button size="sm" onClick={startJustification}>
                <ReceiptText className="size-3.5" />
                Record justification
              </Button>
            )}
          </div>
        </div>
      )}

      <Section title="Work this item">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] text-muted-foreground">Owner</span>
          <Select
            value={exception.owner ?? null}
            onValueChange={(v) => v && assign(v)}
            disabled={exception.status === "CLOSED"}
          >
            <SelectTrigger className="h-9 w-full sm:w-64">
              <SelectValue placeholder="Unassigned">
                {(value: string | null) => (value ? value : "Unassigned")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {owners.map((owner) => (
                <SelectItem key={owner} value={owner}>
                  {owner}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={noteId} className="text-[11px] text-muted-foreground">
            Comment or resolution note
          </label>
          <textarea
            id={noteId}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder={open ? "What was done, or what is still needed…" : "Why it is being closed or reopened…"}
            className={TEXTAREA_CLASS}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={comment} disabled={!trimmed}>
            <MessageSquare className="size-3.5" />
            Add comment
          </Button>
          {exception.status === "OPEN" && (
            <Button size="sm" variant="outline" onClick={startWork}>
              <Play className="size-3.5" />
              Start work
            </Button>
          )}
          {open && (
            <Button
              size="sm"
              className="bg-success text-white hover:bg-success/90"
              onClick={resolve}
              disabled={!trimmed}
              title={trimmed ? undefined : "A resolution note is required"}
            >
              <CircleCheck className="size-3.5" />
              Resolve
            </Button>
          )}
          {exception.status === "RESOLVED" && (
            <Button size="sm" variant="outline" onClick={close}>
              <Archive className="size-3.5" />
              Close
            </Button>
          )}
          {!open && exception.stillDetected && (
            <Button size="sm" variant="outline" onClick={reopen}>
              <RotateCcw className="size-3.5" />
              Reopen
            </Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {open
            ? exception.stillDetected
              ? "Resolving needs a note. The check still finds this item, so resolving records that it was dealt with by hand."
              : "Resolving needs a note."
            : exception.stillDetected
              ? "The check still finds this item, so it can be reopened."
              : "The check no longer finds this item, so there is nothing to reopen."}
        </p>
      </Section>

      <Section title={`History (${exception.history.length})`}>
        <Timeline events={exception.history.map(historyStep)} />
      </Section>

      {declarationTarget && (
        <DeclarationFormDialog
          key={declareKey}
          open={declaring}
          onClose={() => setDeclaring(false)}
          target={declarationTarget}
        />
      )}
      {exception.acquisitionLine && (
        <RecordJustificationDialog
          open={justifying}
          onClose={() => setJustifying(false)}
          exception={exception}
        />
      )}
    </div>
  )
}
