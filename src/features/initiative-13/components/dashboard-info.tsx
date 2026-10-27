import type { ReactNode } from "react"

import { INFO_TONE, InfoPopup, riseIn, slideIn, type InfoTone } from "@/components/shared/info-popup"
import { DASHBOARD_INFO, type DashboardInfoId } from "@/features/initiative-13/data/dashboard-info"
import { cn } from "@/lib/utils"

function Section({
  heading,
  tone,
  delayMs,
  children,
}: {
  heading: string
  tone: InfoTone
  delayMs: number
  children: ReactNode
}) {
  const motion = riseIn(delayMs)
  return (
    <section className={cn("flex min-w-0 flex-col gap-2", motion.className)} style={motion.style}>
      <h3 className={cn("flex items-center gap-2 text-xs font-semibold tracking-wide uppercase", INFO_TONE[tone].heading)}>
        <span className={cn("h-3 w-1 rounded-sm", INFO_TONE[tone].tick)} aria-hidden />
        {heading}
      </h3>
      {children}
    </section>
  )
}

/**
 * The (i) icon on an OAR Utilization dashboard card or Details tab; its popup explains the rule and
 * one worked example from `DASHBOARD_INFO`. Laid out like the Initiative 7 Overview's popup -- the
 * rule on the left, the example on the right -- and written out here rather than imported, because
 * modules do not import each other.
 */
export function DashboardInfo({ id, className }: { id: DashboardInfoId; className?: string }) {
  const spec = DASHBOARD_INFO[id]
  const { example, tone } = spec
  const colours = INFO_TONE[tone]
  const result = riseIn(600)
  return (
    <InfoPopup title={spec.title} description={spec.summary} tone={tone} className={className}>
      <div className="grid gap-5 md:grid-cols-2">
        <Section heading="How it is worked out" tone={tone} delayMs={80}>
          <div className={cn("rounded-sm border-l-4 px-3 py-2 font-mono text-xs leading-relaxed text-foreground", colours.callout)}>
            {spec.rule.map((line, i) => {
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
            <span className="text-sm font-medium text-foreground">{example.subject}</span>
            <span className="rounded-sm bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              Illustrative numbers
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
          <p
            className={cn("rounded-sm border-l-4 px-3 py-2 text-sm font-semibold text-foreground", colours.callout, result.className)}
            style={result.style}
          >
            {example.result}
          </p>
        </Section>
      </div>
    </InfoPopup>
  )
}
