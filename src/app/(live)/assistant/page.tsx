import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Boxes, ListChecks, ShieldCheck, Sparkles, Wrench } from "lucide-react"

import { AiEyebrow, AiIconBadge, AiOrb } from "@/components/assistant/ai-visuals"
import { AssistantOpener } from "@/components/assistant/assistant-opener"
import { entryFromParams, requestHref } from "@/lib/assistant/request/entry"
import { ASSISTANT_REQUESTS, SINGLE_AS_REQUEST } from "@/lib/assistant/request/flag"

export const metadata: Metadata = {
  title: "Reservation assistant — Spares AI",
}

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const material = typeof params.material === "string" ? params.material : ""
  const plant = typeof params.plant === "string" ? params.plant : ""

  return (
    <div className="ai-scope min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
      {/* The scroll container above carries no flex-col/gap of its own — the
          layout lives on this inner wrapper instead. Putting gap-5 on the
          scrolling element itself is harmless here, but keeping the two
          concerns (scrolling vs. stacking) on separate elements matches the
          rest of the app (see materials/page.tsx) and survives a future
          child that wants to opt out of the gap. */}
      <div className="flex flex-col gap-5">
        <header className="relative overflow-hidden rounded-2xl border border-border p-6 sm:p-8">
          <div
            aria-hidden
            className="ai-aurora animate-ai-aurora pointer-events-none absolute inset-0 opacity-90"
          />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <AiOrb size="lg" thinking />
            <div className="flex flex-col gap-2">
              <AiEyebrow>Reservation assistant</AiEyebrow>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                What are you <span className="ai-gradient-text">reserving</span> today?
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Checks a spare before you reserve it — what is already in repair, what
                stock is available, and how much you actually need.
              </p>
            </div>
          </div>
        </header>

        {SINGLE_AS_REQUEST ? (
          // One flow for one material or many (UAT, 21 Oct): every reservation
          // starts as a request, carrying a ?material=&plant= link through.
          <Link
            href={requestHref(entryFromParams(params))}
            className="group ai-glass ai-glow flex items-center gap-4 rounded-2xl p-5 transition-colors hover:bg-muted/40"
          >
            <ListChecks className="size-5 text-ai-2" aria-hidden />
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="font-medium text-foreground">Start a request</span>
              <span className="text-sm text-muted-foreground">
                One material or several, OAR and repairable together. Each is checked as you add it, and you get one
                reference to type into the SAP reservation.
              </span>
            </span>
            <ArrowRight
              className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        ) : (
          <AssistantOpener defaultMaterial={material} defaultPlant={plant} />
        )}

        {ASSISTANT_REQUESTS && !SINGLE_AS_REQUEST && (
          <Link
            href="/assistant/requests/new"
            className="group flex items-center gap-3 rounded-2xl border border-dashed border-ai-2/30 px-5 py-3 text-sm transition-colors hover:border-ai-2/60 hover:bg-muted/40"
          >
            <ListChecks className="size-4 text-ai-2" aria-hidden />
            <span className="flex-1">
              <span className="font-medium text-foreground">Reserving several materials?</span>{" "}
              <span className="text-muted-foreground">
                Start a multi-material request: OAR and repairable parts in two tables, one reference.
              </span>
            </span>
            <ArrowRight
              className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Sparkles className="size-4 text-ai-2" aria-hidden />
            What it will tell you
          </h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <FeatureTile
              icon={<Wrench className="size-4" />}
              term="For a repairable (80-series) part"
            >
              Whether a usable unit already exists: new or refurbished stock (damaged units are
              shown, not counted), a repair PO with its due date and how late it is, or a repair
              requested but not yet ordered. If you still need a new one, it records why, and you
              can declare the faulty unit you are taking out.
            </FeatureTile>
            <FeatureTile
              icon={<Boxes className="size-4" />}
              term="For a planned-on-demand (OAR) part"
            >
              Stock available, open PO quantity, months of cover, how recently it moved,
              and what other plants hold. Then it captures the consumption plan and suggests a
              quantity.
            </FeatureTile>
          </dl>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-success" aria-hidden />
            Nothing here writes to SAP, and nothing blocks a reservation. The platform advises
            and records; the reservation is yours to make.
          </p>
        </section>
      </div>
    </div>
  )
}

function FeatureTile({
  icon,
  term,
  children,
}: {
  icon: React.ReactNode
  term: string
  children: React.ReactNode
}) {
  return (
    <div className="group flex gap-3 rounded-2xl border border-border bg-card p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-ai-2/40 hover:shadow-lg hover:shadow-ai-2/10">
      <AiIconBadge className="transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-6deg]">
        {icon}
      </AiIconBadge>
      <div className="flex flex-col gap-1">
        <dt className="text-sm font-medium text-foreground">{term}</dt>
        <dd className="text-sm text-muted-foreground">{children}</dd>
      </div>
    </div>
  )
}
