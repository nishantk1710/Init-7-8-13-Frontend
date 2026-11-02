"use client"

import type { ReactNode } from "react"

import { INFO_TONE, InfoPopup, riseIn, slideIn, type InfoTone } from "@/components/shared/info-popup"
import { cn } from "@/lib/utils"
import { useOverviewFormulas } from "@/features/initiative-7/components/overview-formulas-context"
import type { OverviewInfoId } from "@/features/initiative-7/data/overview-info"
import { overviewInfoFor } from "@/features/initiative-7/data/overview-info-live"

function Section({
  heading,
  tone,
  delayMs,
  className,
  children,
}: {
  heading: string
  tone: InfoTone
  delayMs: number
  className?: string
  children: ReactNode
}) {
  const motion = riseIn(delayMs)
  return (
    <section className={cn("flex min-w-0 flex-col gap-2", motion.className, className)} style={motion.style}>
      <h3 className={cn("flex items-center gap-2 text-xs font-semibold tracking-wide uppercase", INFO_TONE[tone].heading)}>
        <span className={cn("h-3 w-1 rounded-sm", INFO_TONE[tone].tick)} aria-hidden />
        {heading}
      </h3>
      {children}
    </section>
  )
}

/** The (i) icon on an Overview card or chart; its popup explains the rule, the formula and one worked
 * example from `OVERVIEW_INFO`, or from the saved formulas when somebody has edited them (see
 * `overviewInfoFor`). Two columns on a wide screen -- the rule on the left, the example on
 * the right -- so it reads as a landscape card rather than a tall one. */
export function OverviewInfo({ id }: { id: OverviewInfoId }) {
  const spec = overviewInfoFor(id, useOverviewFormulas())
  const { example, tone } = spec
  const colours = INFO_TONE[tone]
  const result = riseIn(700)
  return (
    <InfoPopup title={spec.title} description={spec.summary} tone={tone}>
      <div className="grid gap-5 md:grid-cols-2">
        <Section heading="How it is calculated" tone={tone} delayMs={80}>
          <div className={cn("rounded-sm border-l-4 px-3 py-2 font-mono text-xs leading-relaxed text-foreground", colours.callout)}>
            {spec.formula.map((line, i) => {
              const motion = slideIn(200 + i * 110)
              return (
                <div key={line} className={motion.className} style={motion.style}>
                  {line}
                </div>
              )
            })}
          </div>
          <ul className="list-disc space-y-1 pl-4 text-sm text-foreground marker:text-muted-foreground">
            {spec.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </Section>

        <Section heading="Example" tone={tone} delayMs={220}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium text-foreground">{example.material}</span>
            <span
              className={cn(
                "rounded-sm px-2 py-0.5 text-[10px] font-medium",
                example.kind === "real" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
              )}
            >
              {example.kind === "real" ? "Real material" : "Illustrative numbers"}
            </span>
          </div>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-sm">
            {example.inputs.map((input) => (
              <div key={input.label} className="col-span-2 grid grid-cols-subgrid border-b border-dashed border-border py-0.5">
                <dt className="text-muted-foreground">{input.label}</dt>
                <dd className="text-right font-medium tabular-nums text-foreground">{input.value}</dd>
              </div>
            ))}
          </dl>
          <div className="rounded-sm border border-border bg-muted/50 px-3 py-2 font-mono text-xs leading-relaxed text-foreground">
            {example.substitution.map((line, i) => {
              const motion = slideIn(450 + i * 150)
              return (
                <div key={line} className={motion.className} style={motion.style}>
                  {line}
                </div>
              )
            })}
          </div>
          <p
            className={cn("rounded-sm border-l-4 px-3 py-2 text-sm font-semibold text-foreground", colours.callout, result.className)}
            style={result.style}
          >
            {example.result}
          </p>
        </Section>
      </div>

      {spec.note && <p className="mt-4 border-t border-dashed border-border pt-3 text-xs text-muted-foreground">{spec.note}</p>}
    </InfoPopup>
  )
}
