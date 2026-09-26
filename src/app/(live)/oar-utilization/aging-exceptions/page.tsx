import type { Metadata } from "next"

import { ExceptionsPage } from "@/features/initiative-13/pages/aging-exceptions-page"
import {
  parseSearchParams,
  type RawSearchParams,
} from "@/features/initiative-13/utils/search-params"

export const metadata: Metadata = {
  title: "Exceptions — OAR Utilization — Spares AI",
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  return <ExceptionsPage searchParams={parseSearchParams(await searchParams)} />
}
