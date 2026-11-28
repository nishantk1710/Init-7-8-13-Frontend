import { RequestsSkeleton } from "@/components/assistant/skeletons"

/** The request list while it opens: the header, the figures, the search and the day's requests, in bones. request-list.tsx shows the same shape under the real header while it fetches. */
export default function Loading() {
  return <RequestsSkeleton />
}
