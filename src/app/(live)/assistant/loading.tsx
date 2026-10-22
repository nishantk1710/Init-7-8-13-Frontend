import { PageLoader } from "@/components/shared/page-loader"

/** Shown the moment this screen is requested -- a refresh or a click in the sidebar -- until its data is ready. */
export default function Loading() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <PageLoader label="Loading the Spares Assistant" className="h-64 w-full" />
    </div>
  )
}
