import type { Metadata } from "next"

import { ApprovalsPage, parseApprovalsFilter } from "@/components/approvals/approvals-page"

export const metadata: Metadata = {
  title: "Approvals — Spares AI",
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { module } = await searchParams
  return <ApprovalsPage filter={parseApprovalsFilter(module)} />
}
