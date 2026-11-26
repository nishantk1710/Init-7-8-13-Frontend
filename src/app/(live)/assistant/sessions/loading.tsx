import { AssistantSessionsSkeleton } from "@/components/assistant/skeletons"

/** The sessions log while it is read: filters, the compliance figures and the table, in bones. Its own screen, so the hub's shape is not shown here. */
export default function Loading() {
  return <AssistantSessionsSkeleton />
}
