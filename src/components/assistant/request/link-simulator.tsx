"use client"

import { useState } from "react"
import { CheckCircle2, FlaskConical, Play, RotateCcw, TriangleAlert, XCircle } from "lucide-react"

import { AiEyebrow } from "@/components/assistant/ai-visuals"
import { SELECT_CLASS } from "@/components/assistant/request/request-parts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { REQUEST_CATALOGUE } from "@/lib/assistant/request/catalogue"
import { resolveLink, type LinkResult } from "@/lib/assistant/request/link"
import { lineReference, requestIdFrom, type RequestRecord } from "@/lib/assistant/request/record"
import { addLink, clearLinks, getRequest, nextReservationNumber } from "@/lib/assistant/request/store"
import { cn } from "@/lib/utils"

type Item = { materialId: string; plant: string; label: string }

/**
 * **Demo only.** What happens when a SAP reservation item carrying this
 * request's reference is loaded: pick the item's material, type its item
 * text, and see whether -- and to which line -- it would link, by the same
 * rules the backend applies (`session_link.py`). A linked result is recorded
 * on the line in this browser. Live, the backend links real extracts.
 */
export function LinkSimulator({ request }: { request: RequestRecord }) {
  const items: Item[] = [
    ...request.lines.map((l) => ({
      materialId: l.materialId,
      plant: l.plant,
      label: `${l.materialId} @ ${l.plant} -- ${l.materialDescription ?? ""} (line /${l.lineNo})`,
    })),
    ...REQUEST_CATALOGUE.filter(
      (m) => !request.lines.some((l) => l.materialId === m.materialId && l.plant === m.plant)
    ).map((m) => ({
      materialId: m.materialId,
      plant: m.plant,
      label: `${m.materialId} @ ${m.plant} -- ${m.description} (not on this request)`,
    })),
  ]

  const [itemIndex, setItemIndex] = useState(0)
  const [sgtxt, setSgtxt] = useState("")
  const [result, setResult] = useState<{ result: LinkResult; reservation: string | null } | null>(null)

  const item = items[itemIndex]
  const line = request.lines.find((l) => l.materialId === item.materialId && l.plant === item.plant)
  const ownNo = line?.lineNo ?? 1
  const otherNo = request.lines.length > 1 ? (ownNo === 1 ? 2 : 1) : 9
  const id = request.requestId
  const typo = id.slice(0, 4) + (id[4] === "7" ? "8" : "7") + id.slice(5)

  const presets: { label: string; text: string }[] = [
    { label: "Correct /n", text: lineReference(id, ownNo) },
    { label: "No /n", text: id },
    { label: "Wrong /n", text: lineReference(id, otherNo) },
    { label: "Dash + words", text: `Mill 3 shutdown ${id}-${ownNo}` },
    { label: "Lower case, spaced", text: `${id.slice(0, 5).toLowerCase()} ${id.slice(5).toLowerCase()}/${ownNo}` },
    { label: "Typo", text: lineReference(typo, ownNo) },
    { label: "Other request", text: lineReference(requestIdFrom("ZZZZ9999"), 1) },
    { label: "Nothing typed", text: "urgent - for mill 3" },
  ]

  function simulate() {
    const outcome = resolveLink({ materialId: item.materialId, plant: item.plant, sgtxt }, getRequest)
    let reservation: string | null = null
    if ((outcome.status === "LINKED" || outcome.status === "LINKED_WITH_WARNING") && outcome.line) {
      reservation = nextReservationNumber()
      addLink(request.requestId, outcome.line.lineNo, {
        reservationNumber: reservation,
        reservationItem: "0001",
        material: item.materialId,
        plant: item.plant,
        source: "UAT_SGTXT",
        sgtxt,
        firstSeenAt: new Date().toISOString(),
        note: outcome.status === "LINKED_WITH_WARNING" ? outcome.notes.join(" ") : null,
      })
    }
    setResult({ result: outcome, reservation })
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-dashed border-ai-2/30 bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AiEyebrow>
          <FlaskConical className="size-3.5" /> Simulate a SAP reservation item
        </AiEyebrow>
        <Button type="button" variant="ghost" size="xs" onClick={() => { clearLinks(request.requestId); setResult(null) }}>
          <RotateCcw /> Clear simulated links
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Pick the material the reservation item is for, type what the requester put in its item text (SGTXT), and
        see how the platform would link it when the SAP extract is loaded.
      </p>
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <select
          aria-label="Reservation item material"
          className={SELECT_CLASS}
          value={itemIndex}
          onChange={(e) => { setItemIndex(Number(e.target.value)); setResult(null) }}
        >
          {items.map((it, i) => (
            <option key={`${it.materialId}-${it.plant}`} value={i}>
              {it.label}
            </option>
          ))}
        </select>
        <Input
          aria-label="Item text (SGTXT)"
          value={sgtxt}
          maxLength={50}
          onChange={(e) => setSgtxt(e.target.value)}
          placeholder="Item text (SGTXT), up to 50 characters"
          className="font-mono"
        />
        <Button type="button" onClick={simulate} disabled={!sgtxt.trim()} className="gap-1.5">
          <Play className="size-3.5" /> Load item
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className="text-[11px] text-muted-foreground">Try:</span>
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => { setSgtxt(p.text); setResult(null) }}
            className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-ai-2/40 hover:text-foreground"
          >
            {p.label}
          </button>
        ))}
      </div>

      {result && <ResultCard result={result.result} reservation={result.reservation} />}
    </section>
  )
}

const STATUS_TEXT: Record<LinkResult["status"], string> = {
  LINKED: "Linked",
  LINKED_WITH_WARNING: "Linked, with a warning",
  NOT_ON_REQUEST: "Not linked -- material not on this request",
  UNKNOWN_REQUEST: "Not linked -- unknown request",
  INVALID: "Not linked -- invalid reference",
  MISSING: "Not linked -- no reference",
}

function ResultCard({ result, reservation }: { result: LinkResult; reservation: string | null }) {
  const ok = result.status === "LINKED"
  const warn = result.status === "LINKED_WITH_WARNING"
  const Icon = ok ? CheckCircle2 : warn ? TriangleAlert : XCircle
  return (
    <div
      className={cn(
        "animate-ai-message-in flex gap-3 rounded-xl border p-3 text-sm",
        ok && "border-success/30 bg-success/5",
        warn && "border-warning/40 bg-warning/5",
        !ok && !warn && "border-destructive/30 bg-destructive/5"
      )}
    >
      <Icon
        className={cn("mt-0.5 size-4 shrink-0", ok ? "text-success" : warn ? "text-warning" : "text-destructive")}
        aria-hidden
      />
      <div className="flex flex-col gap-1">
        <span className="font-medium text-foreground">
          {STATUS_TEXT[result.status]}
          {result.line && result.request && (
            <>
              {" "}to <span className="font-mono">{lineReference(result.request.requestId, result.line.lineNo)}</span>
            </>
          )}
          {reservation && <span className="text-muted-foreground"> · simulated reservation {reservation}/0001</span>}
        </span>
        {result.reference && (
          <span className="text-[11px] text-muted-foreground">
            Read <span className="font-mono">{result.reference.requestId}</span>
            {result.reference.lineNo !== null ? (
              <> with line <span className="font-mono">/{result.reference.lineNo}</span></>
            ) : (
              " with no line number"
            )}
            {result.reference.valid ? "" : " (check character fails)"}
          </span>
        )}
        <ul className="list-disc pl-4 text-xs text-muted-foreground">
          {result.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
