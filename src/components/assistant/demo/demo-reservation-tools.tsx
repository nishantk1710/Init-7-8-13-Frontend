"use client"

import { useEffect, useState } from "react"
import { FlaskConical } from "lucide-react"

import { Button } from "@/components/ui/button"
import { removeReservations, simulateReservation } from "@/lib/assistant/demo"
import { getRun, subscribe } from "@/lib/assistant/demo/store"

/**
 * The demo's "the requester typed the ID into SAP".
 *
 * Stands where the UAT tools stand in live, and does the same thing against the
 * browser's demo store: a 99xxxxxx reservation whose item text (SGTXT) carries
 * this session's reference. The trace then shows it as linked.
 */
export function DemoReservationTools({ sessionId }: { sessionId: string }) {
  const [linked, setLinked] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const read = () => setLinked(getRun(sessionId)?.linkedReservations[0]?.reservationNumber ?? null)
    read()
    return subscribe(read)
  }, [sessionId])

  async function act(action: () => Promise<unknown>, done: string) {
    setBusy(true)
    setMessage(null)
    try {
      await action()
      setMessage(done)
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-warning/50 bg-warning/5 p-4">
      <div className="flex items-center gap-2">
        <FlaskConical className="size-4 text-warning" aria-hidden />
        <p className="text-sm font-medium text-foreground">Demo: stand in for SAP</p>
      </div>
      <p className="text-xs text-muted-foreground">
        In SAP the requester types <span className="font-mono">{sessionId}</span>{" "}into the
        reservation&rsquo;s item text (SGTXT) and the next extract carries it here. In the demo
        this button does that, in this browser only.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={busy || linked !== null}
          onClick={() =>
            act(() => simulateReservation(sessionId), "Simulated reservation created and linked.")
          }
        >
          Simulate SAP reservation
        </Button>
        {linked ? (
          <>
            <span className="text-[11px] text-muted-foreground">
              Linked: <span className="font-mono text-foreground">{linked}/0001</span> · SGTXT{" "}
              <span className="font-mono">{sessionId}</span>
            </span>
            <Button
              size="xs"
              variant="ghost"
              disabled={busy}
              onClick={() => act(() => removeReservations(sessionId), `Removed ${linked}/0001.`)}
            >
              Remove
            </Button>
          </>
        ) : (
          <span className="text-[11px] text-muted-foreground">
            A reservation for this part with SGTXT = the session reference.
          </span>
        )}
      </div>
      {message && <p className="text-xs text-foreground">{message}</p>}
    </div>
  )
}
