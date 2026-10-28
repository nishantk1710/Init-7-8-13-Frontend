import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { connection } from "next/server"

import { DeclarationsScreen } from "@/features/initiative-8/components/declarations-screen"
import { I08Page } from "@/features/initiative-8/components/kit/page"
import {
  cutoverFromRules,
  declarablePlants,
  declarationsHref,
  loadDeclarationLog,
  loadDeclarationsPage,
  loadHistoricalLines,
  parseDeclarationParams,
  parseDeclarationTab,
  registerPlants,
  type DeclarationsPage,
} from "@/features/initiative-8/data/live-declarations"
import type { RawSearchParams } from "@/features/initiative-8/data/url-params"
import { getAttestations, getSnapshot } from "@/lib/api/i8"
import { DEFAULT_PAGE_SIZE, pageCountOf } from "@/lib/pagination"

export const metadata: Metadata = {
  title: "Repair Declarations — Spares AI",
}

/**
 * Initiative 08 FR-4 — the condition-to-repair declaration queue.
 *
 * ## Why this screen is back
 *
 * It was folded into the Repair Register on 08-Oct-2026 and this route became
 * a `redirect()`. The 09-Oct FRS audit found that the register's Declaration
 * Status column answers a different question: it tells you the state of ONE
 * repair line you are already looking at, and FR-4 asks who has not declared
 * anything yet. You cannot work a queue you have to go looking for, and the
 * register sorts by repair line rather than by what is outstanding.
 *
 * So the queue is a screen again, reading the same backend check the register
 * reads — `GET /api/i8/declarations`, which has been live throughout.
 *
 * ## What it does not do
 *
 * It does not enforce anything. The platform never writes to SAP, so a missing
 * declaration cannot block a dispatch; recording the declaration is half the
 * control and detecting its absence is the other half, and this screen is the
 * second half. Saying otherwise on screen would be a lie about what the
 * platform can do.
 *
 * ## Where the form is
 *
 * Everywhere it is needed, since 12-Oct-2026. It is still on the repair detail
 * page, where the line's own evidence is, but it is also on each row of the
 * queue below — working a queue should not mean a round trip per row — and
 * behind "Declare a part", which needs no repair line at all.
 *
 * That last one matters more than it looks. FR-4 assesses a part when it comes
 * off the machine, and a part judged Scrap or Beyond Economical Repair never
 * gets a repair PO. While the form was reachable only from a repair line,
 * exactly those judgements had nowhere to go.
 *
 * ## Paged on the server
 *
 * `?q=`, `?plant=`, `?vendor=`, `?repairStatus=` and `?page=` are read here,
 * and the backend searches, filters, counts and pages the queue. It used to
 * load all 5,153 rows and filter them in the browser: a 17 MB page that took
 * ten seconds to arrive. See `loadDeclarationsPage`. The declaration log is
 * still loaded whole -- it holds six rows.
 *
 * ## Three tabs
 *
 * `?tab=log` shows the log, `?tab=historical` the open lines raised before
 * declarations began (28-Oct-2026); anything else, the queue. The log used to
 * sit four screens down, under the queue and its pager
 * (I08_Live_UI_Redesign_Plan.md, L4). The counts of all three are loaded
 * either way: the tab strip shows them, and the queue's empty state says how
 * many lines are Historical and since when (the snapshot's cutover date).
 */
export default async function I08DeclarationsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  // Reads a table that changes whenever somebody records a declaration, so a
  // build-time snapshot would be stale the moment it was built.
  await connection()

  const raw = await searchParams
  const { filters, page } = parseDeclarationParams(raw)
  const tab = parseDeclarationTab(raw)

  let data: DeclarationsPage | null = null
  let loadError: string | null = null
  // Best-effort and fetched in parallel: a failure costs the forms their
  // category list (they then say so and cannot submit), never the screen.
  const faultCategories = getAttestations()
    .then((body) => body.faultCategories ?? [])
    .catch(() => [] as string[])
  // Null on failure, which the log section reports as such.
  const declarationLog = loadDeclarationLog()
  // Best-effort, both: the Historical tab's count, and the day declarations
  // began, for the queue's empty state. Without them it says less.
  const historicalLines = loadHistoricalLines()
  const cutoverDate = getSnapshot()
    .then((snapshot) => cutoverFromRules(snapshot.rules))
    .catch(() => undefined)
  try {
    data = await loadDeclarationsPage(filters, page, { list: tab === "historical" ? "historical" : "queue" })
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }
  const categories = await faultCategories
  const log = await declarationLog
  const historical = await historicalLines
  const cutover = await cutoverDate

  // Past the end -- a stale link, or a filter that now matches fewer: go to
  // the last page there is rather than show an empty one. Outside the try:
  // `redirect` throws, and the catch would swallow it as a load error.
  if (data) {
    const lastPage = pageCountOf(data.total, DEFAULT_PAGE_SIZE)
    if (page > lastPage) redirect(declarationsHref(filters, lastPage, tab))
  }

  if (data === null) {
    return (
      <I08Page
        crumbs={[{ label: "Repairable Spares", href: "/repairable-spares" }, { label: "Repair Declarations" }]}
        title="Repair Declarations"
      >
        <div role="alert" className="mt-6 rounded-xl border border-i08-crit-border bg-i08-crit-tint p-5">
          <p className="text-sm text-foreground">The declaration queue could not be loaded.</p>
          <p className="mt-1 text-[13px] text-muted-foreground">{loadError}</p>
          <p className="mt-3 text-[13px] text-muted-foreground">
            This is not &ldquo;nothing outstanding&rdquo;, it is a failed request. Try again in a minute.
          </p>
        </div>
      </I08Page>
    )
  }

  // "Declare a part" needs plants even when both lists are empty: the
  // register's, then the two the backend accepts.
  const listed = [data.facets.plants, historical?.plants ?? []]
  const plants = declarablePlants(listed.some((p) => p.length > 0) ? listed : [await registerPlants()])

  return (
    <DeclarationsScreen
      tab={tab}
      historical={historical?.total}
      cutoverDate={cutover}
      declarablePlants={plants}
      rows={data.rows}
      total={data.total}
      page={page}
      pageSize={DEFAULT_PAGE_SIZE}
      summary={data.summary}
      facets={data.facets}
      filters={filters}
      faultCategories={categories}
      log={log}
    />
  )
}
