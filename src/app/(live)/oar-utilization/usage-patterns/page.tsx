import { permanentRedirect } from "next/navigation"

import { redirectTarget } from "@/features/initiative-13/utils/redirects"
import type { RawSearchParams } from "@/features/initiative-13/utils/search-params"

/** Usage Pattern is a WATCH tab now (FR-6); old links keep working. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  permanentRedirect(redirectTarget("/oar-utilization/watch", await searchParams, { view: "usage" }))
}
