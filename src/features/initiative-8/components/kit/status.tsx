import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { isUnsigned } from "@/features/initiative-8/utils/format"

/**
 * One status style for I08 (I08_Live_UI_Redesign_Plan.md, V3): a small dot and
 * a word in sentence case.
 *
 * It replaces the upper-case pills, of which the Register carried 150 on one
 * page, most saying the same thing on every row. Colour now means something
 * and only that: red is late or against an assessment, amber is waiting on
 * somebody, green is done, grey is a state that asks nothing. The word always
 * says it too, so nothing rests on colour alone.
 */
export type Tone = "crit" | "warn" | "good" | "neutral" | "muted"

const DOT: Record<Tone, string> = {
  crit: "bg-i08-crit",
  warn: "bg-i08-warn",
  good: "bg-i08-good",
  neutral: "bg-i08-neutral",
  muted: "bg-i08-neutral",
}

export function StatusDot({
  tone = "neutral",
  strong = false,
  small = false,
  wrap = false,
  className,
  children,
}: {
  tone?: Tone
  /** Red text as well as a red dot: for "113 days late", the one number to read. */
  strong?: boolean
  small?: boolean
  /** Wrap onto a second line in a narrow column, the dot staying by the first,
   *  rather than be cut off mid-word. */
  wrap?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex gap-1.5",
        wrap ? "items-start" : "items-center whitespace-nowrap",
        small ? "text-[12.5px]" : "text-[13.5px]",
        tone === "muted" ? "text-muted-foreground" : "text-foreground",
        strong && tone === "crit" && "font-medium text-i08-crit-ink",
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", wrap && "mt-[0.42em]", DOT[tone])} />
      {children}
    </span>
  )
}

/**
 * Who recorded something. A placeholder id -- there is no sign-in yet -- reads
 * "Not signed in", in italics, with the reason on hover: still visibly not a
 * person (lib/api/actor.ts), but no longer an upper-case code.
 */
export function Actor({ actor }: { actor: string | null | undefined }) {
  if (isUnsigned(actor)) {
    return (
      <span
        className="text-muted-foreground italic"
        title="Recorded without a named user: sign-in is not built yet, so this is a test entry."
      >
        Not signed in
      </span>
    )
  }
  return <span>{actor}</span>
}
