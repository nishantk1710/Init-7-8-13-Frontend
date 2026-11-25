import { redirect } from "next/navigation"
import { connection } from "next/server"

import { MaterialsFilterBar } from "@/components/materials/materials-filters"
import { MaterialsLoadingBanner } from "@/components/materials/materials-loading"
import { materialsHref, type MaterialsFilters } from "@/components/materials/materials-params"
import { MaterialsTable } from "@/components/materials/materials-table"
import { AlertBanner } from "@/components/shared/alert-banner"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { ProfileMenu } from "@/components/shared/profile-menu"
import { TablePagination } from "@/components/shared/table-pagination"
import { ApiError } from "@/lib/api/client"
import { formatWhen } from "@/lib/api/format"
import { getMaterialCounts, getMaterials, type MaterialCounts, type MaterialStock } from "@/lib/api/materials"
import { DEFAULT_PAGE_SIZE, pageCountOf } from "@/lib/pagination"

/**
 * More -> Materials: every active material at Black Mountain and Gamsberg with
 * its stock on hand -- OAR and every other type.
 *
 * Filtered and paged on the server (the list runs to tens of thousands of
 * rows), with the filters in the URL so a filtered list is a link.
 */
export async function MaterialsPage({ filters }: { filters: MaterialsFilters }) {
  // Without this `next build` would fetch once and serve that snapshot forever.
  await connection()

  let rows: MaterialStock[] | null = null
  let total: number | null = null
  let counts: MaterialCounts | null = null
  let loadError: string | null = null
  // 503: the backend is still reading the list from SAP (first read after a
  // deploy); not an error, so it gets its own banner that retries by itself.
  let stillLoading: string | null = null
  try {
    const [list, totals] = await Promise.all([
      getMaterials({
        search: filters.search,
        plant: filters.plant,
        classification: filters.classification,
        limit: DEFAULT_PAGE_SIZE,
        offset: (filters.page - 1) * DEFAULT_PAGE_SIZE,
      }),
      getMaterialCounts({ search: filters.search, plant: filters.plant }).catch(() => null),
    ])
    rows = list.items
    total = list.total
    counts = totals
  } catch (error) {
    if (error instanceof ApiError && error.status === 503) {
      stillLoading = typeof error.detail === "string" ? error.detail : "The materials list is still loading from SAP."
    } else {
      loadError = error instanceof Error ? error.message : String(error)
    }
  }

  // Past the end (a stale link): go to the last page rather than show an empty
  // one. Outside the try -- redirect() throws.
  if (total && filters.page > pageCountOf(total, DEFAULT_PAGE_SIZE)) {
    redirect(materialsHref({ ...filters, page: pageCountOf(total, DEFAULT_PAGE_SIZE) }))
  }

  const filtered = Boolean(filters.search || filters.plant || filters.classification)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Materials"
          description="Every active material at each plant with its unrestricted stock on hand, OAR and Non-OAR. Materials flagged for deletion in SAP are left out."
          actions={<ProfileMenu />}
        />

        <MaterialsFilterBar filters={filters} counts={counts} />

        {stillLoading !== null ? (
          <MaterialsLoadingBanner message={stillLoading} />
        ) : rows === null ? (
          <AlertBanner tone="critical" title="The materials list could not be loaded">
            {loadError}
          </AlertBanner>
        ) : rows.length === 0 ? (
          <EmptyState
            title={filtered ? "No materials match these filters" : "No materials loaded yet"}
            description={
              filtered
                ? "Try another search, or choose all plants and both classifications."
                : "Materials appear here once the SAP material master (MARC) has been loaded."
            }
          />
        ) : (
          <>
            <MaterialsTable rows={rows} />
            <div className="flex flex-col gap-1">
              <TablePagination
                page={filters.page}
                pageSize={DEFAULT_PAGE_SIZE}
                total={total}
                count={rows.length}
                noun="materials"
                hrefFor={(p) => materialsHref({ ...filters, page: p })}
              />
              {counts?.loadedAt && (
                <p className="text-xs text-muted-foreground">
                  SAP material and stock data read {formatWhen(counts.loadedAt)}; refreshed every 10 minutes.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
