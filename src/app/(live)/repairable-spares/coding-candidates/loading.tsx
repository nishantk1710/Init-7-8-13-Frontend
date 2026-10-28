import { PageLoader } from "@/components/shared/page-loader"

/**
 * Shown the moment Repair Candidates is clicked. This screen reads a lot of
 * purchase text and takes several seconds; without this the click looked dead.
 */
export default function Loading() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <PageLoader label="Loading Repair Candidates" className="h-64 w-full" />
    </div>
  )
}
