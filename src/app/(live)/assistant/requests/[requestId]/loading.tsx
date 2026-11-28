import { RequestDetailSkeleton } from "@/components/assistant/skeletons"

/** One request while it opens: the reference, the facts and the lines, in bones. request-summary.tsx shows the same shape under the real header while it fetches. */
export default function Loading() {
  return <RequestDetailSkeleton />
}
