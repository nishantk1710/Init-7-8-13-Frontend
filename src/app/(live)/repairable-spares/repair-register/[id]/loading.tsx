import { PageLoader } from "@/components/shared/page-loader"

/** Shown the moment a repair line is opened, while it loads. */
export default function Loading() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <PageLoader label="Loading the repair line" className="h-64 w-full" />
    </div>
  )
}
