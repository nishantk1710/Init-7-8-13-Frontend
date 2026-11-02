import { PageLoader } from "@/components/shared/page-loader"

/** Shown the moment the requests screens are requested, until their data is ready. */
export default function Loading() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <PageLoader label="Loading requests" className="h-64 w-full" />
    </div>
  )
}
