import { ListSkeleton } from "@/features/initiative-8/components/kit/skeletons"

/** Shown the moment Repair Declarations is clicked, while the queue loads. */
export default function Loading() {
  return <ListSkeleton label="Loading Repair Declarations" tabs />
}
