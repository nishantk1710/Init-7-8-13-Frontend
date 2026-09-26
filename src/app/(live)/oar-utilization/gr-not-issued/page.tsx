import type { Metadata } from "next"

import { GrniPage } from "@/features/initiative-13/pages/grni-page"
import {
  parseSearchParams,
  type RawSearchParams,
} from "@/features/initiative-13/utils/search-params"

export const metadata: Metadata = {
  title: "30-Day GR-Not-Issued — OAR Utilization — Spares AI",
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  return <GrniPage searchParams={parseSearchParams(await searchParams)} />
}
