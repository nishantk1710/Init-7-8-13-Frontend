import { permanentRedirect } from "next/navigation"

import {
  parseSearchParams,
  type RawSearchParams,
} from "@/features/initiative-13/utils/search-params"

/**
 * Captured consumption plans are a Dashboard tab, not a screen of their own.
 * An old link (the assistant's, a bookmark) lands on that tab with its plant
 * and material scope intact.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  const { plant, material } = parseSearchParams(await searchParams)
  const query = new URLSearchParams({ tab: "plans" })
  if (plant) query.set("plant", plant)
  if (material) query.set("material", material)
  permanentRedirect(`/oar-utilization?${query.toString()}`)
}
