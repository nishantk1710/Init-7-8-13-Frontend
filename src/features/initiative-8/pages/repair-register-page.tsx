import { redirect } from "next/navigation"
import { connection } from "next/server"

import { PageHeader } from "@/components/shared/page-header"
import { RepairRegisterTable } from "@/features/initiative-8/components/repair-register-table"
import {
  loadRegisterPage,
  parseRegisterParams,
  registerDescription,
  registerHref,
  type RegisterPage,
} from "@/features/initiative-8/data/live-register"
import type { RawSearchParams } from "@/features/initiative-8/data/url-params"
import { DEFAULT_PAGE_SIZE, pageCountOf } from "@/lib/pagination"

/**
 * The Repair Register (FR-10).
 *
 * A server component that fetches one page of the register for the filters in
 * the URL; `RepairRegisterTable` draws it and writes the URL when a filter
 * changes. `?q=`, `?plant=`, `?vendor=`, `?repairStatus=`, `?overdue=`,
 * `?criticality=`, `?declarationStatus=`, `?aging=`, `?exceptions=` and
 * `?page=` are read here, and the backend searches, filters, counts and pages.
 *
 * Until 18-Oct-2026 it loaded all 5,063 lines and the whole exception queue
 * and filtered them in the browser: a 35 MB page that took 27 seconds, and
 * about 23 backend calls per visit on a single-worker backend.
 *
 * **This screen is live-only.** It has no fixture fallback: the demo rows it
 * used to fall back to described a material (`800-14201` at `PLANT-GBG`) that
 * does not exist in SAP, and a register that cannot reach its backend must say
 * so rather than quietly showing eight invented repairs.
 */
export async function RepairRegisterPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  // Opt this render out of static prerendering. Without it `next build`
  // fetches the register once, at build time, and serves that forever -- so
  // an attestation recorded afterwards never shows up -- and a build on a
  // machine that cannot reach the backend fails, or worse, succeeds against a
  // stale cache.
  await connection()

  const { filters, page } = parseRegisterParams(await searchParams)

  // The try/catch wraps ONLY the fetch. Building JSX inside it would put the
  // render under the same handler as the request, so an error thrown while
  // rendering would be silently reported as a failed load -- which is the
  // opposite of this page's whole point about distinguishing the two.
  let data: RegisterPage | null = null
  let loadError: string | null = null
  try {
    data = await loadRegisterPage(filters, page)
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }

  // Past the end -- a stale link, or a filter that now matches fewer: go to
  // the last page there is rather than show an empty one. Outside the try:
  // `redirect` throws, and the catch would swallow it as a load error.
  if (data) {
    const lastPage = pageCountOf(data.total, DEFAULT_PAGE_SIZE)
    if (page > lastPage) redirect(registerHref(filters, lastPage))
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Repair Register"
          description={
            data
              ? registerDescription(
                  data.meta,
                  data.referenceDate,
                  data.sourceLoadedAt,
                  data.meta.heldLines,
                )
              : "Every repairable material currently in, or eligible for, a repair chain."
          }
        />
        {data === null ? (
          // Shown as a failure, never as an empty table. "No repairs" and
          // "cannot reach the server" are different statements and must not
          // look alike.
          <div
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center text-sm"
          >
            <p className="font-medium text-foreground">The repair register could not be loaded.</p>
            <p className="mt-1 text-muted-foreground">{loadError}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              This is not an empty register — it is a failed request. Check that the
              backend is running and that NEXT_PUBLIC_API_BASE_URL points at it.
            </p>
          </div>
        ) : (
          <RepairRegisterTable
            chains={data.chains}
            total={data.total}
            overall={data.meta.totalLines}
            page={page}
            pageSize={DEFAULT_PAGE_SIZE}
            facets={data.facets}
            agingBands={data.agingBands}
            filters={filters}
          />
        )}
      </div>
    </div>
  )
}
