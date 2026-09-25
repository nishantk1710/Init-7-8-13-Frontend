import Link from "next/link"
import { ArrowRight } from "lucide-react"

import type { ApiRouting } from "@/lib/api/assistant"

type Destination = { href: string; label: string; what: string }

function destinations(sessionId: string, routing: ApiRouting): Destination[] {
  const scope = new URLSearchParams({ material: routing.materialId, plant: routing.plant }).toString()
  const trace: Destination = {
    href: `/assistant/sessions/${encodeURIComponent(sessionId)}`,
    label: "Session trace",
    what: "every question and answer, as recorded",
  }
  if (routing.flow === "i13") {
    return [
      {
        href: `/oar-utilization/plans?${scope}`,
        label: "Consumption plans",
        what: "the plan you just gave, if you gave one",
      },
      {
        href: `/oar-utilization/watch?${scope}`,
        label: "WATCH",
        what: "cover and acquired-vs-plan for this part, now measured against your plan",
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
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <p className="text-sm font-medium text-foreground">This conversation is finished.</p>
      <p className="mt-1 text-xs text-muted-foreground">
        What you recorded is already on these screens:
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {destinations(sessionId, routing).map((d) => (
          <li key={d.href}>
            <Link
              href={d.href}
              className="group inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
            >
              {d.label}
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <span className="ml-2 text-xs text-muted-foreground">{d.what}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
