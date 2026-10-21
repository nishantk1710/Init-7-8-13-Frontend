"use client"

import type { PropsWithChildren } from "react"
import { createPortal } from "react-dom"

import "@/features/initiative-8/components/overview-print.css"

export type OverviewPrintHeader = {
  title: string
  /** The page header's description: what the page covers, as at when. */
  caption: string
  /** The filter labels the figures were drawn under. */
  filters: { plant: string; vendor: string; criticality: string }
  /** "818 of 818 repair lines" -- how much of the register the filters kept. */
  lines: string
  /** What each filter narrows, as the strip under the filters says on screen. */
  note: string
  printedAt: string
}

/**
 * The overview's "Download PDF" copy, mounted straight under `<body>` for as
 * long as the print dialog is open.
 *
 * Same approach as the I07 quarterly report and the I13 summary report: the
 * PDF is the user's browser printing the page -- there is no headless browser
 * on the backend. The page itself cannot simply be printed: it scrolls inside
 * an `overflow-y-auto` container, and print shows only that container's first
 * screenful. A copy under `<body>` sits outside every scroll container, and
 * `overview-print.css` shows only it.
 *
 * `aria-hidden`: it is a duplicate of what the screen already says.
 */
export function OverviewPrint(props: PropsWithChildren<OverviewPrintHeader>) {
  return createPortal(
    <div className="i08-overview-print light-scope" aria-hidden>
      <OverviewPrintDocument {...props} />
    </div>,
    document.body,
  )
}

/**
 * What the PDF says, without the portal: the figures under a header that
 * names the slice they were drawn from. A page saved into a report has to say
 * which plant, vendor and criticality it is about; the dropdowns that say so
 * on screen do not print.
 */
export function OverviewPrintDocument({
  title,
  caption,
  filters,
  lines,
  note,
  printedAt,
  children,
}: PropsWithChildren<OverviewPrintHeader>) {
  return (
    <div className="flex flex-col gap-4 bg-background text-foreground">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{caption}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Filters:</span> Plant: {filters.plant} ·
          Vendor: {filters.vendor} · Criticality: {filters.criticality} · {lines}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Printed {printedAt}</p>
      </div>
      {children}
    </div>
  )
}
