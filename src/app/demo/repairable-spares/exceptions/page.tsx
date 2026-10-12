import type { Metadata } from "next"

import { ExceptionQueuePage } from "@demo/features/initiative-8/pages/exception-queue-page"

export const metadata: Metadata = {
  title: "Exception Queue — Repairable Spares — Spares AI",
}

/** A query value as one string; a repeated parameter (`?id=a&id=b`) takes the first. */
function single(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value
  return first?.trim() ? first.trim() : undefined
}

/**
 * `?id=EX-OD-8006` opens that item; `?repair=RC-8006` narrows the queue to one
 * repair line. The page is keyed by both, so following a second link while
 * already here starts from that link rather than the last one's state.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; repair?: string }>
}) {
  const params = await searchParams
  const id = single(params.id)
  const repair = single(params.repair)
  return <ExceptionQueuePage key={`${id ?? ""}|${repair ?? ""}`} initialId={id} initialRepair={repair} />
}
