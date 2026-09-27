import type { Metadata } from "next"

import { ValidationPage } from "@/features/initiative-13/pages/validation-page"
import {
  parseSearchParams,
  type RawSearchParams,
} from "@/features/initiative-13/utils/search-params"

export const metadata: Metadata = {
  title: "Validation — OAR Utilization — Spares AI",
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  return <ValidationPage searchParams={parseSearchParams(await searchParams)} />
}
