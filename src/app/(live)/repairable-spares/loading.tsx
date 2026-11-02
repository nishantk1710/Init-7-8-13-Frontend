import { PageLoader } from "@/components/shared/page-loader"

/** Shown the moment the Overview is clicked -- a refresh or a click in the sidebar -- until its figures are ready. */
export default function Loading() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <PageLoader label="Loading Repairable Spares" className="h-64 w-full" />
    </div>
  )
}
