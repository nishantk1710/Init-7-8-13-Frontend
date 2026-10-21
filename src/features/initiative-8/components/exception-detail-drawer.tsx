"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { DetailDrawer } from "@/components/shared/detail-drawer"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { StatusBadge } from "@/components/shared/status-badge"
import { Timeline, type TimelineEvent } from "@/components/shared/timeline"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toExceptionRow } from "@/features/initiative-8/data/live-exceptions"
import type {
  ExceptionEvent,
  ExceptionQueueRow,
  ExceptionStatus,
} from "@/features/initiative-8/types/repair"
import {
  EXCEPTION_SEVERITY_TONE,
  EXCEPTION_STATUS_LABEL,
  EXCEPTION_STATUS_TONE,
  UNKNOWN,
  exceptionTypeLabel,
} from "@/features/initiative-8/utils/status"
import { ApiError } from "@/lib/api/client"
import { appendExceptionEvent, type ApiExceptionItem } from "@/lib/api/i8"
import { useMaterial360 } from "@/lib/material-360-context"

/** What each history entry's verb reads as. */
const KIND_VERB: Record<ExceptionEvent["kind"], string> = {
  ASSIGNED: "assigned it",
  COMMENT: "commented",
  STATUS: "changed the status",
  AUTO_RESOLVED: "resolved itself",
}

/**
 * One history entry as a timeline step. Green only when the data closed it:
 * the check stopping is the one ending that proves the gap is gone. A person
 * closing it is recorded plainly, because the check may still find the item.
 */
function historyStep(event: ExceptionEvent): TimelineEvent {
  return {
    id: event.id,
    label:
      event.kind === "AUTO_RESOLVED"
        ? "The check stopped finding it"
        : event.kind === "STATUS" && event.status
          ? // "set it to Open", not "reopened it": an entry from before
            // 21-Oct that said In progress reads as Open, and that item was
            // never closed.
            `${event.actor} ${event.status === "CLOSED" ? "closed it" : "set it to Open"}`
          : `${event.actor} ${KIND_VERB[event.kind]}`,
    timestamp: event.at,
    description: event.text || undefined,
    tone:
      event.kind === "AUTO_RESOLVED"
        ? "success"
        : event.status === "OPEN"
          ? "danger"
          : "default",
  }
}

export type ExceptionDetailDrawerProps = {
  exception?: ExceptionQueueRow
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * The item as a write left it. The queue is paged, so the refresh after a
   * write may no longer carry the item at all -- moved off an Open-filtered
   * page, say -- and the drawer then shows this rather than going blank.
   */
  onChanged?: (exception: ExceptionQueueRow) => void
}

/**
 * One exception-queue item, opened from its row (FR-11): what the check found,
 * the records it points at, its history, and the controls to work it.
 *
 * ## Why every action is one POST
 *
 * Assigning, commenting and moving an item all append one entry to the same
 * history. The item's status and owner are not columns anybody edits — they
 * are folded from that history — so there is no PATCH here, and none anywhere
 * in this application.
 *
 * ## Why this writes and then refreshes the route
 *
 * The item itself is not stored — it is recomputed from the register and the
 * attestation table on every read — so there is nothing here to mutate
 * locally and re-render. Each action POSTs and then calls `router.refresh()`,
 * which re-runs the server fetch and brings back both the new history and
 * whatever the checks now say. That is also how an item that closed itself in
 * the meantime shows up as closed rather than sitting here looking open.
 *
 * ## Why only Open and Closed
 *
 * In progress and Resolved were retired on 21-Oct-2026. In progress said what
 * the owner already says, and only took the item off the default Open view;
 * Resolved behaved exactly like Closed. An item ends one of two ways -- the
 * data is fixed and the check stops finding it, or a person closes it with a
 * reason -- and the history tells those apart, so the status does not have to.
 */
export function ExceptionDetailDrawer({
  exception,
  open,
  onOpenChange,
  onChanged,
}: ExceptionDetailDrawerProps) {
  const router = useRouter()
  const { openMaterial360 } = useMaterial360()
  const [note, setNote] = useState("")
  const [comment, setComment] = useState("")
  const [owner, setOwner] = useState("")
  const [busy, setBusy] = useState(false)

  if (!exception) return null

  /** Run one write, report it, and re-read the queue. */
  async function run(action: () => Promise<ApiExceptionItem>, success: string) {
    setBusy(true)
    try {
      const written = await action()
      onChanged?.(toExceptionRow(written))
      toast.success(success)
      setNote("")
      setComment("")
      setOwner("")
      router.refresh()
    } catch (error) {
      // Named, not swallowed: a write that failed must not leave the drawer
      // looking like it worked, because the row behind it will not have moved.
      toast.error(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "The change could not be saved.",
      )
    } finally {
      setBusy(false)
    }
  }

  const item = exception
  const autoResolved = [...item.history]
    .reverse()
    .find((e) => e.kind === "AUTO_RESOLVED")

  return (
    <DetailDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={exceptionTypeLabel(item.type)}
      description={item.id}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={EXCEPTION_STATUS_TONE[item.status]}>
            {EXCEPTION_STATUS_LABEL[item.status]}
          </StatusBadge>
          <StatusBadge tone={EXCEPTION_SEVERITY_TONE[item.severity] ?? "default"}>
            {item.severity}
          </StatusBadge>
          <StatusBadge>{item.owner ? `Owner: ${item.owner}` : "Unassigned"}</StatusBadge>
          {item.preAutomation && <StatusBadge>Raised before Spares Automation</StatusBadge>}
          {!item.stillDetected && (
            <StatusBadge tone="success">No longer found by the check</StatusBadge>
          )}
        </div>

        {/* What the check found, and what it searched for. The second half is
            what lets a reader tell a real gap from a rule that did not fit. */}
        <div>
          <h3 className="text-sm font-medium text-foreground">{item.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
        </div>

        {autoResolved && (
          <p className="rounded-lg border border-success/40 bg-success/5 px-3 py-2 text-xs text-muted-foreground">
            {autoResolved.text} Recorded {autoResolved.at}.
          </p>
        )}

        <dl className="grid grid-cols-2 gap-y-2 text-xs">
          <dt className="text-muted-foreground">Material</dt>
          <dd className="text-right">
            <MaterialIdentity material={item.material} onOpen={openMaterial360} />
          </dd>
          <dt className="text-muted-foreground">Plant</dt>
          <dd className="text-right text-foreground">{item.plant?.name ?? UNKNOWN}</dd>
          <dt className="text-muted-foreground">Repair line</dt>
          <dd className="text-right text-foreground">
            {item.repairId ? (
              <Link
                href={`/repairable-spares/repair-register/${encodeURIComponent(item.repairId)}`}
                className="text-primary hover:underline"
              >
                {item.repairLine}
              </Link>
            ) : (
              item.repairLine
            )}
          </dd>
          {item.acquisitionLine && (
            <>
              <dt className="text-muted-foreground">Purchase line</dt>
              <dd className="text-right text-foreground">{item.acquisitionLine}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Raised</dt>
          <dd className="text-right text-foreground">{item.raisedAt ?? UNKNOWN}</dd>
        </dl>

        {/* How the finding is actually cleared. Neither of these is a button
            here, because neither is this drawer's to do: recording the
            declaration or the justification is what makes the check stop
            finding the item, and the item then resolves itself. */}
        <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {item.type === "MISSING_ATTESTATION" ? (
            <>
              Recording the condition declaration on{" "}
              {item.repairId ? (
                <Link
                  href={`/repairable-spares/repair-register/${encodeURIComponent(item.repairId)}`}
                  className="text-primary hover:underline"
                >
                  this repair line
                </Link>
              ) : (
                "this repair line"
              )}{" "}
              makes the check stop finding this item, and it closes itself with
              the declaration in its history.
            </>
          ) : (
            "This item closes itself when the data it was raised on changes — a goods receipt, a declaration, or a justification."
          )}
        </p>

        {/* --- working it ------------------------------------------------ */}
        <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
          <h3 className="text-xs font-medium text-foreground">Work this item</h3>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-muted-foreground" htmlFor="exception-owner">
              Owner
            </label>
            <div className="flex gap-2">
              <Input
                id="exception-owner"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder={item.owner ?? "Nobody yet"}
                className="h-9"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={busy || !owner.trim()}
                onClick={() =>
                  run(
                    () =>
                      appendExceptionEvent(item.id, {
                        kind: "ASSIGNED",
                        owner: owner.trim(),
                      }),
                    `${item.id} assigned to ${owner.trim()}`,
                  )
                }
              >
                Assign
              </Button>
              {item.owner && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    run(
                      // An ASSIGNED entry naming nobody. Handing something
                      // back is an action and gets its own line in the
                      // history, not a quietly cleared field.
                      () => appendExceptionEvent(item.id, { kind: "ASSIGNED", owner: null }),
                      `${item.id} unassigned`,
                    )
                  }
                >
                  Unassign
                </Button>
              )}
            </div>
          </div>

          {/* Two statuses, so one move from here: close an open item, or
              reopen a closed one. Closing needs a note -- the backend refuses
              one without -- because a person's close is the ending the data
              did not produce. */}
          {item.status === "OPEN" ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-muted-foreground" htmlFor="exception-note">
                Closing note — required
              </label>
              <div className="flex gap-2">
                <Input
                  id="exception-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Why it is being closed, for whoever reads this later"
                  className="h-9"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || !note.trim()}
                  title={note.trim() ? undefined : "A closing note is required"}
                  onClick={() =>
                    run(
                      () =>
                        appendExceptionEvent(item.id, {
                          kind: "STATUS",
                          status: "CLOSED",
                          text: note.trim(),
                        }),
                      `${item.id} closed`,
                    )
                  }
                >
                  {/* "item": the drawer's own dismiss button is called Close. */}
                  Close item
                </Button>
              </div>
              {item.stillDetected && (
                <p className="text-[11px] text-muted-foreground">
                  The check still finds this item, so closing it records that it
                  was dealt with by hand.
                </p>
              )}
            </div>
          ) : item.stillDetected ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-muted-foreground" htmlFor="exception-note">
                Note — optional
              </label>
              <div className="flex gap-2">
                <Input
                  id="exception-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Why it is being reopened"
                  className="h-9"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () =>
                        appendExceptionEvent(item.id, {
                          kind: "STATUS",
                          status: "OPEN",
                          text: note.trim(),
                        }),
                      `${item.id} reopened`,
                    )
                  }
                >
                  Reopen item
                </Button>
              </div>
            </div>
          ) : (
            // Reopening would only be undone: the next read of the queue
            // closes an open item the check no longer finds.
            <p className="text-[11px] text-muted-foreground">
              The check no longer finds this item, so there is nothing to reopen.
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-muted-foreground" htmlFor="exception-comment">
              Comment — without moving it
            </label>
            <div className="flex gap-2">
              <Input
                id="exception-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Chasing the vendor…"
                className="h-9"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={busy || !comment.trim()}
                onClick={() =>
                  run(
                    () =>
                      appendExceptionEvent(item.id, {
                        kind: "COMMENT",
                        text: comment.trim(),
                      }),
                    `Comment added to ${item.id}`,
                  )
                }
              >
                Comment
              </Button>
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-medium text-foreground">History</h3>
          {item.history.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nothing has happened to this item yet. It was raised by a check and
              nobody has picked it up.
            </p>
          ) : (
            <Timeline events={item.history.map(historyStep)} />
          )}
        </div>
      </div>
    </DetailDrawer>
  )
}

/** Re-exported for the table's status dropdown. */
export type { ExceptionStatus }
