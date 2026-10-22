"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type ReactNode } from "react"
import { Copy, SquarePen } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { DeclarationFormDialog } from "@/features/initiative-8/components/declaration-form-dialog"
import { StatusDot } from "@/features/initiative-8/components/kit/status"
import { repairHref } from "@/features/initiative-8/components/repair-register-table"
import { toExceptionRow } from "@/features/initiative-8/data/live-exceptions"
import type { ExceptionEvent, ExceptionQueueRow, ExceptionStatus } from "@/features/initiative-8/types/repair"
import { actorLabel, isUnsigned, plantShort } from "@/features/initiative-8/utils/format"
import { EXCEPTION_STATUS_LABEL, exceptionTypeLabel } from "@/features/initiative-8/utils/status"
import { ApiError } from "@/lib/api/client"
import { appendExceptionEvent, getException, type ApiExceptionItem } from "@/lib/api/i8"

/** Who did it, in a sentence: a placeholder author is "Someone not signed in". */
function who(actor: string): string {
  if (actor === "system") return "The check"
  return isUnsigned(actor) ? "Someone not signed in" : actorLabel(actor)
}

/**
 * One history entry as a line of plain English. Green only when the data
 * closed it: the check stopping is the one ending that proves the gap is
 * gone. A person closing it is recorded plainly, because the check may still
 * find the item.
 */
function historyLine(event: ExceptionEvent): {
  text: string
  tone: "good" | "neutral" | "warn"
} {
  switch (event.kind) {
    case "AUTO_RESOLVED":
      return { text: "The check stopped finding it", tone: "good" }
    case "STATUS":
      // "set it to Open", not "reopened it": an entry from before 21-Oct that
      // said In progress reads as Open, and that item was never closed.
      return event.status === "CLOSED"
        ? { text: `${who(event.actor)} closed it`, tone: "neutral" }
        : { text: `${who(event.actor)} set it to Open`, tone: "warn" }
    case "ASSIGNED":
      return {
        text: event.owner ? `${who(event.actor)} assigned it to ${event.owner}` : `${who(event.actor)} unassigned it`,
        tone: "neutral",
      }
    default:
      return { text: `${who(event.actor)} commented`, tone: "neutral" }
  }
}

/** "4500001635-10" as the document and item the declaration form sends. */
function repairKey(repairId: string | undefined): {
  document?: string
  item?: string
} {
  if (!repairId) return {}
  const cut = repairId.lastIndexOf("-")
  return cut > 0 ? { document: repairId.slice(0, cut), item: repairId.slice(cut + 1) } : {}
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
  /** The declaration form's fault categories. Empty when that fetch failed:
   *  the form then says so and cannot submit. */
  faultCategories?: string[]
}

/**
 * One exception-queue item, opened from its row (FR-11) --
 * I08_Live_UI_Redesign_Plan.md, L5 and decision D6.
 *
 * Reads top to bottom as the questions somebody opening it has: what clears
 * it, what the check found, where it is, then the controls and the history.
 * "What clears this" used to come last, under the facts.
 *
 * ## The Declare button (D6)
 *
 * A missing declaration is cleared by recording the declaration, and this
 * drawer used to say so without offering it ("not this drawer's to do"). It
 * opens the same form the repair page and the queue use now, naming this
 * repair line. The declaration is still what clears the item -- the button
 * only saves the trip. Afterwards the item is read again: the check may have
 * stopped finding it, and the drawer then says so rather than showing it open.
 *
 * ## Why every action is one POST
 *
 * Assigning, commenting and moving an item all append one entry to the same
 * history. The item's status and owner are not columns anybody edits -- they
 * are folded from that history -- so there is no PATCH here, and none anywhere
 * in this application. Each write POSTs and then refreshes the route, which
 * brings back the new history and whatever the checks now say.
 *
 * ## Why only Open and Closed
 *
 * In progress and Resolved were retired on 21-Oct-2026. An item ends one of
 * two ways -- the data is fixed and the check stops finding it, or a person
 * closes it with a reason -- and the history tells those apart.
 */
export function ExceptionDetailDrawer({
  exception,
  open,
  onOpenChange,
  onChanged,
  faultCategories = [],
}: ExceptionDetailDrawerProps) {
  const router = useRouter()
  const [note, setNote] = useState("")
  const [comment, setComment] = useState("")
  const [owner, setOwner] = useState("")
  const [busy, setBusy] = useState(false)
  const [declaring, setDeclaring] = useState(false)
  // A fresh form per opening, so a half-typed description cannot reappear.
  const [formKey, setFormKey] = useState(0)

  if (!exception) return null
  const item = exception

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
        error instanceof ApiError || error instanceof Error ? error.message : "The change could not be saved.",
      )
    } finally {
      setBusy(false)
    }
  }

  /**
   * After a declaration: read the item again. Gone (404) means nobody had
   * touched it and the check no longer finds it -- it has left the queue, and
   * the drawer closes saying so. Any other failure leaves the drawer as it
   * was; the route refresh the form runs brings the queue up to date anyway.
   */
  async function afterDeclared() {
    try {
      onChanged?.(toExceptionRow(await getException(item.id)))
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        toast.success("This exception is cleared", {
          description: "The check no longer finds it, so it has left the queue.",
        })
        onOpenChange(false)
      }
    }
  }

  const autoResolved = [...item.history].reverse().find((e) => e.kind === "AUTO_RESOLVED")
  const { document: repairDocument, item: repairItem } = repairKey(item.repairId)
  const canDeclare = item.type === "MISSING_ATTESTATION" && item.stillDetected && Boolean(item.plant?.plantId)
  const lineLink = item.repairId ? (
    <Link href={repairHref({ id: item.repairId })} className="font-mono text-i08-link hover:underline">
      {item.repairLine}
    </Link>
  ) : (
    <span className="font-mono">{item.repairLine}</span>
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="i08-scope" widthClassName="w-full sm:max-w-[560px]">
        <SheetHeader className="gap-1.5 px-5 pt-5 pr-12 pb-4">
          <SheetTitle className="text-[17px] leading-snug font-semibold">{exceptionTypeLabel(item.type)}</SheetTitle>
          <SheetDescription className="text-[13.5px] text-muted-foreground">
            <span className="font-mono font-medium text-foreground">{item.material.materialCode}</span>
            {item.material.description && item.material.description !== item.material.materialCode && (
              <> {item.material.description}</>
            )}
          </SheetDescription>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
            <StatusDot tone={item.status === "OPEN" ? "warn" : "neutral"}>
              {EXCEPTION_STATUS_LABEL[item.status]}
            </StatusDot>
            <span>{item.owner ? `Owner: ${item.owner}` : "Unassigned"}</span>
            {!item.stillDetected && <StatusDot tone="good">No longer found by the check</StatusDot>}
            <span className="inline-flex items-center gap-0.5 font-mono text-[12px]">
              {item.id}
              <button
                type="button"
                aria-label={`Copy ${item.id}`}
                title="Copy the exception id"
                onClick={() =>
                  navigator.clipboard?.writeText(item.id).then(
                    () => toast.success(`Copied ${item.id}`),
                    () => toast.error("Could not copy: the browser blocked it."),
                  )
                }
                className="grid size-5 place-items-center rounded hover:bg-muted hover:text-i08-link"
              >
                <Copy className="size-3" />
              </button>
            </span>
          </div>
        </SheetHeader>

        <SheetBody className="px-5 py-5">
          <div className="flex flex-col gap-6">
            {/* What clears it, first: the one thing somebody opening this wants. */}
            <section className="rounded-xl border border-primary/20 bg-accent p-4">
              <h3 className="text-[13px] font-semibold text-accent-foreground">What clears this</h3>
              <p className="mt-1 text-[13.5px] leading-relaxed text-foreground">
                {!item.stillDetected ? (
                  "Nothing more: the check no longer finds this item."
                ) : item.type === "MISSING_ATTESTATION" ? (
                  <>
                    A condition declaration for repair line {lineLink}. Once it is recorded the check stops finding this
                    item, and it leaves the queue.
                  </>
                ) : item.type === "OVERDUE_REPAIR" ? (
                  <>
                    SAP marking repair line {lineLink} delivery completed, or a later delivery date agreed with the
                    vendor and entered on the PO in SAP. Either one stops the check finding this item.
                  </>
                ) : (
                  "The item clears itself when the data it was raised on changes."
                )}
              </p>
              {canDeclare && (
                <Button
                  size="lg"
                  className="mt-3 px-3.5"
                  onClick={() => {
                    setFormKey((k) => k + 1)
                    setDeclaring(true)
                  }}
                >
                  <SquarePen className="size-4" />
                  Declare condition
                </Button>
              )}
            </section>

            {autoResolved && (
              <p className="rounded-lg border border-i08-good-border bg-i08-good-tint px-3.5 py-2.5 text-[13px] text-foreground">
                {autoResolved.text} Recorded {autoResolved.at}.
              </p>
            )}

            {/* What the check found, and what it searched for: the second half
                is what lets a reader tell a real gap from a rule that did not fit. */}
            <section>
              <h3 className="text-[13px] font-semibold text-foreground">What the check found</h3>
              <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{item.detail}</p>
            </section>

            <dl className="grid grid-cols-[max-content_1fr] gap-x-8 gap-y-2 text-[13.5px]">
              <Fact label="Plant">{item.plant ? plantShort(item.plant.name ?? item.plant.plantId) : "Not known"}</Fact>
              <Fact label="Repair line">{lineLink}</Fact>
              {item.acquisitionLine && (
                <Fact label="Purchase line">
                  <span className="font-mono">{item.acquisitionLine}</span>
                </Fact>
              )}
              <Fact label="Raised">{item.raisedAt ?? "Not known"}</Fact>
            </dl>

            <WorkThisItem
              item={item}
              busy={busy}
              owner={owner}
              setOwner={setOwner}
              note={note}
              setNote={setNote}
              comment={comment}
              setComment={setComment}
              run={run}
            />

            <section>
              <h3 className="mb-2.5 text-[13px] font-semibold text-foreground">History</h3>
              {item.history.length === 0 ? (
                <p className="text-[13.5px] text-muted-foreground">
                  Nothing yet. A check raised it and nobody has picked it up.
                </p>
              ) : (
                <ol className="flex flex-col gap-3">
                  {item.history.map((event) => {
                    const line = historyLine(event)
                    return (
                      <li key={event.id} className="flex flex-col gap-0.5">
                        <div className="flex items-baseline justify-between gap-3">
                          <StatusDot tone={line.tone} wrap>
                            {line.text}
                          </StatusDot>
                          <span className="shrink-0 text-[12.5px] text-muted-foreground tabular-nums">{event.at}</span>
                        </div>
                        {event.text && <p className="pl-3.5 text-[13px] text-muted-foreground">{event.text}</p>}
                      </li>
                    )
                  })}
                </ol>
              )}
            </section>
          </div>
        </SheetBody>

        {/* Inside the panel, so the form opens as a dialog nested in it: a
            click in the form is not a click outside the panel. */}
        {declaring && (
          <DeclarationFormDialog
            key={formKey}
            open
            onClose={() => setDeclaring(false)}
            onSaved={() => void afterDeclared()}
            target={{
              materialId: item.material.materialId,
              plantId: item.plant?.plantId,
              label: `${item.material.materialCode} · ${item.material.description} · ${item.plant?.name ?? "an unknown plant"} · repair line ${item.repairLine}`,
              defaultQuantity: "1",
              // FR-4's link to the repair PO: declaring from here declares THAT line.
              repairDocument,
              repairItem,
            }}
            faultCategories={faultCategories}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-foreground">{children}</dd>
    </>
  )
}

/** Owner, close or reopen, and comment: each one POST to the item's history. */
function WorkThisItem({
  item,
  busy,
  owner,
  setOwner,
  note,
  setNote,
  comment,
  setComment,
  run,
}: {
  item: ExceptionQueueRow
  busy: boolean
  owner: string
  setOwner: (value: string) => void
  note: string
  setNote: (value: string) => void
  comment: string
  setComment: (value: string) => void
  run: (action: () => Promise<ApiExceptionItem>, success: string) => Promise<void>
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <h3 className="text-[13px] font-semibold text-foreground">Work this item</h3>

      <Field label="Owner" htmlFor="exception-owner">
        <Input
          id="exception-owner"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          placeholder={item.owner ?? "Nobody yet"}
          className="h-9"
        />
        <Button
          size="lg"
          variant="outline"
          disabled={busy || !owner.trim()}
          onClick={() =>
            run(
              () =>
                appendExceptionEvent(item.id, {
                  kind: "ASSIGNED",
                  owner: owner.trim(),
                }),
              `Assigned to ${owner.trim()}`,
            )
          }
        >
          Assign
        </Button>
        {item.owner && (
          <Button
            size="lg"
            variant="ghost"
            disabled={busy}
            onClick={() =>
              run(
                // An ASSIGNED entry naming nobody: handing something back is
                // an action, with its own line in the history.
                () =>
                  appendExceptionEvent(item.id, {
                    kind: "ASSIGNED",
                    owner: null,
                  }),
                "Unassigned",
              )
            }
          >
            Unassign
          </Button>
        )}
      </Field>

      {/* Two statuses, so one move from here. Closing needs a note -- the
          backend refuses one without -- because a person's close is the ending
          the data did not produce. */}
      {item.status === "OPEN" ? (
        <Field
          label="Close with a note (required)"
          htmlFor="exception-note"
          hint={
            item.stillDetected
              ? "The check still finds this item, so closing it records that it was dealt with by hand."
              : undefined
          }
        >
          <Input
            id="exception-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why it is being closed"
            className="h-9"
          />
          <Button
            size="lg"
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
                "Exception closed",
              )
            }
          >
            {/* "item": the drawer's own dismiss button is called Close. */}
            Close item
          </Button>
        </Field>
      ) : item.stillDetected ? (
        <Field label="Reopen, with a note (optional)" htmlFor="exception-note">
          <Input
            id="exception-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why it is being reopened"
            className="h-9"
          />
          <Button
            size="lg"
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
                "Exception reopened",
              )
            }
          >
            Reopen item
          </Button>
        </Field>
      ) : (
        // Reopening would only be undone: the next read of the queue closes
        // an open item the check no longer finds.
        <p className="text-[13px] text-muted-foreground">
          The check no longer finds this item, so there is nothing to reopen.
        </p>
      )}

      <Field label="Comment, without changing anything" htmlFor="exception-comment">
        <Input
          id="exception-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Chasing the vendor…"
          className="h-9"
        />
        <Button
          size="lg"
          variant="outline"
          disabled={busy || !comment.trim()}
          onClick={() =>
            run(
              () =>
                appendExceptionEvent(item.id, {
                  kind: "COMMENT",
                  text: comment.trim(),
                }),
              "Comment added",
            )
          }
        >
          Comment
        </Button>
      </Field>
    </section>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12.5px] font-medium text-muted-foreground" htmlFor={htmlFor}>
        {label}
      </label>
      <div className="flex gap-2">{children}</div>
      {hint && <p className="text-[12.5px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Re-exported for the screen's status switch. */
export type { ExceptionStatus }
