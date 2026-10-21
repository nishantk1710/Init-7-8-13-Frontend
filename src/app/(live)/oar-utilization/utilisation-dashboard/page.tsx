import { permanentRedirect } from "next/navigation"

import { redirectTarget } from "@/features/initiative-13/utils/redirects"
import type { RawSearchParams } from "@/features/initiative-13/utils/search-params"

/** The dashboard is the module's landing page now; old links keep working. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  permanentRedirect(redirectTarget("/oar-utilization", await searchParams))
}
