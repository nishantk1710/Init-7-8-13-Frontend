import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { AiEyebrow } from "@/components/assistant/ai-visuals"

import { UatReservationTools } from "@/components/assistant/uat-reservation-tools"
import type { ApiRouting } from "@/lib/api/assistant"
import { ASSISTANT_DEMO } from "@/lib/assistant/demo/flag"

type Destination = { href: string; label: string; what: string }

function destinations(sessionId: string, routing: ApiRouting): Destination[] {
  const scope = new URLSearchParams({ material: routing.materialId, plant: routing.plant }).toString()
  const trace: Destination = {
    href: `/assistant/sessions/${encodeURIComponent(sessionId)}`,
    label: "Session trace",
    what: "every question and answer, as recorded",
  }
  if (ASSISTANT_DEMO) {
    // Only the screens that have a demo stand-in. The rest read the live
    // backend, which never saw a demo session, and would show it missing.
    const sessions: Destination = {
      href: "/assistant/sessions",
      label: "Sessions",
      what: "this session beside every other session",
    }
    const landed: Destination[] =
      routing.flow === "i13"
        ? [{ href: `/oar-utilization?tab=plans&${scope}`, label: "Consumption plans", what: "the plan you just gave, if you gave one" }]
        : routing.flow === "i08"
          ? [{ href: "/repairable-spares/justifications", label: "Justifications", what: "the new-acquisition reason, if you recorded one" }]
          : []
    return [...landed, trace, sessions]
  }
  if (routing.flow === "i13") {
    return [
      {
        href: `/oar-utilization?tab=plans&${scope}`,
        label: "Consumption plans",
        what: "the plan you just gave, if you gave one",
      },
      {
        href: `/oar-utilization/watch?${scope}`,
        label: "WATCH",
        what: "cover and acquired-vs-plan for this part, now measured against your plan",
      },
      {
        href: `/oar-utilization/ledger?view=reservations&session=${encodeURIComponent(sessionId)}`,
        label: "Utilization Ledger",
        what: "the reservation, once its item text (SGTXT) carries this session ID",
      },
      {
        href: `/oar-utilization/aging-exceptions?${scope}`,
        label: "Exceptions",
        what: "re-checked for this part as the conversation finished",
      },
      trace,
    ]
  }
  if (routing.flow === "i08") {
    return [
      {
        href: `/repairable-spares/justifications`,
        label: "Justifications",
        what: "the new-acquisition reason, if you recorded one",
      },
      trace,
    ]
  }
  return [trace]
}

/**
 * Where a finished conversation shows up.
 *
 * The assistant does not create the SAP reservation — it records the advice
 * given and what the requester said. Those records land on the OAR screens
 * straight away, and this says where, rather than leaving the planner to find
 * them.
 */
export function ConversationOutcome({ sessionId, routing }: { sessionId: string; routing: ApiRouting }) {
  return (
    <div className="ai-border-gradient animate-ai-message-in relative overflow-hidden rounded-2xl p-5">
      <Confetti />
      <div className="relative flex items-center gap-4">
        <DoneCheck />
        <div className="flex flex-col gap-1">
          <AiEyebrow>All done</AiEyebrow>
          <p className="text-base font-semibold text-foreground">This conversation is finished.</p>
          <p className="text-xs text-muted-foreground">
            What you recorded is already on these screens:
          </p>
        </div>
      </div>
      <ul className="relative mt-4 grid gap-2 sm:grid-cols-2">
        {destinations(sessionId, routing).map((d, index) => (
          <li
            key={d.href}
            className="animate-ai-message-in"
            style={{ animationDelay: `${200 + index * 70}ms` }}
          >
            <Link
              href={d.href}
              className="group flex h-full items-start justify-between gap-3 rounded-xl border border-border bg-background/70 px-3.5 py-3 transition-all hover:-translate-y-0.5 hover:border-ai-2/40 hover:shadow-md hover:shadow-ai-2/10"
            >
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground group-hover:text-ai-2">
                  {d.label}
                </span>
                <span className="text-xs text-muted-foreground">{d.what}</span>
              </span>
              <ArrowRight
                className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-ai-2"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
      <div className="relative mt-4">
        <UatReservationTools sessionId={sessionId} />
      </div>
    </div>
  )
}

/** A tick that draws itself inside a gradient disc. */
function DoneCheck() {
  return (
    <span
      aria-hidden
      className="ai-gradient animate-ai-pop flex size-12 shrink-0 items-center justify-center rounded-full text-white shadow-lg shadow-ai-2/30"
    >
      <svg viewBox="0 0 24 24" className="size-6" fill="none">
        <path
          d="M5 12.5l4.5 4.5L19 7.5"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="48"
          className="animate-ai-check"
        />
      </svg>
    </span>
  )
}

/** A one-off burst of CSS confetti behind the tick. Decorative only. */
const CONFETTI = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2
  const distance = 60 + (i % 4) * 22
  return {
    dx: Math.round(Math.cos(angle) * distance),
    dy: Math.round(Math.sin(angle) * distance * 0.7 + 30),
    rot: (i % 2 ? 1 : -1) * (180 + i * 25),
    color: ["var(--ai-1)", "var(--ai-2)", "var(--ai-3)", "var(--success)"][i % 4],
    delay: (i % 6) * 40,
    round: i % 3 === 0,
  }
})

function Confetti() {
  return (
    <span aria-hidden className="pointer-events-none absolute top-11 left-11">
      {CONFETTI.map((piece, i) => (
        <span
          key={i}
          className="animate-ai-confetti absolute block"
          style={
            {
              "--dx": `${piece.dx}px`,
              "--dy": `${piece.dy}px`,
              "--rot": `${piece.rot}deg`,
              width: piece.round ? 6 : 4,
              height: piece.round ? 6 : 9,
              borderRadius: piece.round ? 9999 : 1,
              background: piece.color,
              animationDelay: `${piece.delay}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  )
}
