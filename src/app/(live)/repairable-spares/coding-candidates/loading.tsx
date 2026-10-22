import { ListSkeleton } from "@/features/initiative-8/components/kit/skeletons"

/**
 * Shown the moment Repair Candidates is clicked. This screen reads a lot of
 * purchase text and takes several seconds; without this the click looked dead.
 */
export default function Loading() {
  return <ListSkeleton label="Loading Repair Candidates" />
}
