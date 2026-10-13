"use client"

import { useSyncExternalStore } from "react"
import { createPortal } from "react-dom"

import { SummaryReportDocument } from "@/features/initiative-13/components/summary-report-document"
import type { SummaryReport } from "@/lib/api/i13-report"

import "@/features/initiative-13/components/summary-report-print.css"

/**
 * The "Download PDF" view: the same document, mounted straight under `<body>`.
 *
 * Same approach as the I07 quarterly report (`report-print-view.tsx`): the PDF
 * is the user's browser printing the page — there is no headless browser on
 * the backend. Printing the page in place would clip it, because the I13 pages
 * scroll inside an `overflow-y-auto` container and print only its first
 * screenful. A copy portalled under `<body>` sits outside every scroll
 * container, and the print stylesheet shows only it.
 *
 * `print-portal` is also carried so the I07 print stylesheet — global once
 * loaded, if the user visited that screen first — shows this view instead of
 * hiding it.
 */
const noSubscription = () => () => {}

export function SummaryReportPrint({ report }: { report: SummaryReport }) {
  // `document` exists only in the browser: false while server-rendering and
  // hydrating, true after -- without a setState-in-effect re-render.
  const inBrowser = useSyncExternalStore(noSubscription, () => true, () => false)
  if (!inBrowser) return null

  return createPortal(
    <div className="print-portal i13-print-portal" aria-hidden>
      <SummaryReportDocument report={report} />
    </div>,
    document.body
  )
}
