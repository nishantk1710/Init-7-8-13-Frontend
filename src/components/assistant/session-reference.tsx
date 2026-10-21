"use client"

import { useState } from "react"
import { Check, Copy, Ticket } from "lucide-react"
import { toast } from "sonner"

import { AiIconBadge } from "@/components/assistant/ai-visuals"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * The session reference — the only thing the requester carries out of this
 * conversation.
 *
 * ## Why this is a banner and not a line on the last screen
 *
 * The session is minted the moment the assistant opens, before a single
 * question is answered. A planner who reads the advice and closes the tab has
 * still had a session recorded against their name, and both FRSs count exactly
 * that: "advice given, not acted on". If the reference only appeared at the
 * end, an abandoned session would be unreferencable — the record exists and
 * nobody can link a reservation to it.
 *
 * So it is shown from the start and stays put. The terminal step repeats it in
 * the server's own wording, because that sentence is the compliance
 * instruction and belongs where the backend put it.
 *
 * ## Ten characters, and why they are these ten
 *
 * `S` + 8 payload characters + 1 check character. The alphabet is Crockford
 * base32, which drops I, L, O and U so nothing is confusable, and the length
 * is what `Bednr` holds — the reservation field the reference is destined for.
 * The check character means a mistyped reference fails immediately instead of
 * matching nothing, which matters because "no such session" is the exact
 * compliance finding raised against somebody who skipped the assistant. Without
 * it a typo becomes a false accusation against somebody who did everything
 * right.
 *
 * It is rendered spaced and monospaced because it will be typed into SAP by
 * hand, off a screen, by someone who is not looking forward to it.
 */
export function SessionReference({
  sessionId,
  request,
  issuedAt,
  expiresAt,
  expired = false,
  className,
  children,
}: {
  sessionId: string
  /**
   * Set when the session is a line of a multi-material request (the trace
   * page). The line is shown as `R…/n`, but what goes into SAP is the bare
   * `R…`, so that is what is copied. Left out, the session ID is both.
   */
  request?: { label: string; sapText: string }
  /** When the session was minted. The trace passes it; the live chat does not
   *  need it, because there the session was minted moments ago. */
  issuedAt?: string | null
  /** End of the reference's validity window -- not when it was recorded. */
  expiresAt?: string | null
  expired?: boolean
  className?: string
  /** Shown under the reference, inside the same bar (the progress strip). */
  children?: React.ReactNode
}) {
  const [copied, setCopied] = useState(false)
  const shown = request?.label ?? sessionId
  const sapText = request?.sapText ?? sessionId

  async function copy() {
    try {
      await navigator.clipboard.writeText(sapText)
      setCopied(true)
      toast.success("Reference copied", {
        description: "Type it into the reservation's item text (SGTXT) in SAP.",
      })
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access is refused in some browsers without a secure context.
      // The reference is on screen and selectable, so this is an inconvenience
      // rather than a failure, and saying so beats a silent no-op.
      toast.error("Could not copy", {
        description: "Select the reference and copy it by hand.",
      })
    }
  }

  return (
    <div
      className={cn(
        "ai-glow animate-ai-message-in flex flex-col gap-3 rounded-2xl border border-ai-2/20 bg-card px-4 py-3",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <AiIconBadge className="mt-0.5 hidden sm:inline-flex">
            <Ticket className="size-4" />
          </AiIconBadge>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <span className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                {request ? "Request line" : "Your session reference"}
              </span>
              <span className="ai-gradient-text font-mono text-xl font-bold tracking-[0.18em]">
                {shown}
              </span>
            </span>
            {request ? (
              <span className="text-xs text-muted-foreground">
                Part of a multi-material request. Type{" "}
                <span className="font-mono font-semibold text-foreground">{sapText}</span>
                {" "}into the reservation&rsquo;s header text in SAP; SAP copies it to every item.
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                Type this into the reservation&rsquo;s item text (SGTXT) in SAP so this advice can be linked to
                what you actually reserve.
              </span>
            )}
            {(issuedAt || (expiresAt && !expired)) && (
              <span className="text-[11px] text-muted-foreground">
                {issuedAt && <>Recorded {formatExpiry(issuedAt)}</>}
                {issuedAt && expiresAt && !expired && " · "}
                {expiresAt && !expired && <>Valid until {formatExpiry(expiresAt)}</>}
              </span>
            )}
            {expired && (
              /* Expiry is REPORTED and never ENFORCED. The reservation is already
                 in SAP and the platform cannot write back, so treating an expired
                 reference as non-compliant would raise an exception nobody could
                 ever clear. The wording has to say "still valid to quote" or a
                 planner will assume they have to start again. */
              <span className="text-[11px] text-muted-foreground">
                Past its {formatExpiry(expiresAt)} validity window. Still worth
                quoting on the reservation — the advice is recorded either way, and
                nothing is invalidated by the clock.
              </span>
            )}
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={copy}
          className={cn(
            "shrink-0 gap-1.5 transition-all",
            copied && "border-success/40 bg-success/10 text-success hover:bg-success/15"
          )}
        >
          {copied ? (
            <Check key="check" className="animate-ai-pop size-3.5" aria-hidden />
          ) : (
            <Copy key="copy" className="size-3.5" aria-hidden />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      {children && <div className="border-t border-border/60 pt-2.5">{children}</div>}
    </div>
  )
}

/**
 * The expiry instant as a readable date.
 *
 * Deliberately not a countdown. A ticking clock implies a deadline with a
 * consequence, and there is no consequence — see the note above.
 */
function formatExpiry(iso: string | null | undefined): string {
  if (!iso) return "unknown"
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}
