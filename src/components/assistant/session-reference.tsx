"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { toast } from "sonner"

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
  expiresAt,
  expired = false,
  className,
}: {
  sessionId: string
  expiresAt?: string | null
  expired?: boolean
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(sessionId)
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
        "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3",
        className
      )}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
          Your session reference
        </span>
        <span className="font-mono text-lg font-semibold tracking-[0.15em] text-foreground">
          {sessionId}
        </span>
        <span className="text-xs text-muted-foreground">
          Type this into the reservation&rsquo;s item text (SGTXT) in SAP so this advice can be linked to
          what you actually reserve.
        </span>
        {expiresAt && !expired && (
          <span className="text-[11px] text-muted-foreground">
            Recorded {formatExpiry(expiresAt)}
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

      <Button variant="outline" size="sm" onClick={copy}>
        {copied ? (
          <Check className="size-3.5" aria-hidden />
        ) : (
          <Copy className="size-3.5" aria-hidden />
        )}
        {copied ? "Copied" : "Copy"}
      </Button>
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
