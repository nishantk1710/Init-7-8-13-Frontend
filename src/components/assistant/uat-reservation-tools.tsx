"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { FlaskConical } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ApiError } from "@/lib/api/client"
import {
  getUatStatus,
  listUatCandidates,
  listUatReservations,
  removeUatReservation,
  simulateUatReservation,
  stampUatReservation,
  type UatCandidate,
  type UatReservation,
} from "@/lib/api/session-links"

/**
 * UAT stand-in for "the requester typed the session ID into SAP".
 *
 * The platform cannot write to SAP, so in UAT nothing can put a session ID into
 * a reservation's item text (SGTXT). These two actions do what that would do,
 * against a UAT-only table the backend overlays on the loaded extract:
 *
 *   - **Simulate SAP reservation** — the reservation the requester would have
 *     created, numbered 99xxxxxx, with SGTXT = this session ID;
 *   - **Link to an existing reservation** — the ID typed into a real
 *     reservation of the same part.
 *
 * Renders nothing unless the backend reports UAT simulation as on, so it can
 * never appear in production.
 */
export function UatReservationTools({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(false)
  const [rows, setRows] = useState<UatReservation[]>([])
  const [candidates, setCandidates] = useState<UatCandidate[]>([])
  const [choice, setChoice] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [uatRows, uatCandidates] = await Promise.all([
      listUatReservations(sessionId),
      listUatCandidates(sessionId, 50),
    ])
    setRows(uatRows)
    setCandidates(uatCandidates.items.filter((c) => c.sessionId !== sessionId))
  }, [sessionId])

  useEffect(() => {
    let cancelled = false
    getUatStatus()
      .then((status) => {
        if (cancelled || !status.enabled) return
        setEnabled(true)
        return load()
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [load])

  const run = useCallback(
    async (action: () => Promise<unknown>, done: string) => {
      setBusy(true)
      setMessage(null)
      try {
        await action()
        await load()
        setMessage(done)
        router.refresh()
      } catch (error) {
        setMessage(error instanceof ApiError ? error.detailText() : String(error))
      } finally {
        setBusy(false)
      }
    },
    [load, router]
  )

  if (!enabled) return null

  const simulated = rows.find((r) => r.simulated)
  const [number, item] = choice.split("/")

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-warning/50 bg-warning/5 p-4">
      <div className="flex items-center gap-2">
        <FlaskConical className="size-4 text-warning" aria-hidden />
        <p className="text-sm font-medium text-foreground">UAT: stand in for SAP</p>
      </div>
      <p className="text-xs text-muted-foreground">
        In SAP the requester types <span className="font-mono">{sessionId}</span> into the
        reservation&rsquo;s item text (SGTXT) and the next extract carries it here. UAT
        cannot write to SAP, so these do it against a UAT-only table. The loaded SAP data is
        never changed.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={busy || simulated !== undefined}
          onClick={() => run(() => simulateUatReservation(sessionId), "Simulated reservation created and linked.")}
        >
          Simulate SAP reservation
        </Button>
        <span className="text-[11px] text-muted-foreground">
          {simulated
            ? `Already simulated: ${simulated.reservationNumber}`
            : "A new reservation for this part with SGTXT = the session ID. It has no PO, receipt or issue."}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-7 max-w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          disabled={busy || candidates.length === 0}
          aria-label="Existing reservation to link"
        >
          <option value="">
            {candidates.length === 0 ? "No existing reservations for this part" : "Choose an existing reservation…"}
          </option>
          {candidates.map((c) => (
            <option key={`${c.reservationNumber}/${c.reservationItem}`} value={`${c.reservationNumber}/${c.reservationItem}`}>
              {c.reservationNumber}/{c.reservationItem} · required {c.requirementDate ?? "—"} · qty{" "}
              {c.reservationQuantity ?? "—"}
              {c.sgtxt ? ` · text "${c.sgtxt}"` : ""}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !choice}
          onClick={() =>
            run(
              () => stampUatReservation({ sessionId, reservationNumber: number, reservationItem: item }),
              `Session ID typed into ${choice}'s item text and linked.`
            )
          }
        >
          Link to this reservation
        </Button>
      </div>

      {rows.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono text-foreground">
                {r.reservationNumber}/{r.reservationItem}
              </span>
              <span className="text-muted-foreground">
                {r.simulated ? "simulated" : `stamped (was "${r.originalSgtxt ?? ""}")`} · SGTXT {r.sgtxt}
              </span>
              <Button
                size="xs"
                variant="ghost"
                disabled={busy}
                onClick={() => run(() => removeUatReservation(r.id), `Removed ${r.reservationNumber}/${r.reservationItem}.`)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      {message && <p className="text-xs text-foreground">{message}</p>}
    </div>
  )
}
