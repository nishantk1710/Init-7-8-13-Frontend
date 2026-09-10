import type {
  AgingBucket,
  DeclarationStatus,
  ReceiptStatus,
  RepairStatus,
} from "@/features/initiative-8/types/repair"

type Tone = "default" | "success" | "warning" | "danger"

export const REPAIR_STATUS_TONE: Record<RepairStatus, Tone> = {
  "PR Raised": "default",
  "PO Issued": "default",
  "At Vendor": "warning",
  "In Transit Return": "warning",
  Received: "success",
  Closed: "success",
}

export const RECEIPT_STATUS_TONE: Record<ReceiptStatus, Tone> = {
  "Not Yet Shipped": "default",
  "Awaiting Receipt": "warning",
  "Partially Received": "warning",
  Received: "success",
}

export const DECLARATION_STATUS_TONE: Record<DeclarationStatus, Tone> = {
  Required: "warning",
  Pending: "default",
  Completed: "success",
  Flagged: "danger",
}

export const AGING_BUCKETS: AgingBucket[] = ["0-15", "16-30", "31-45", "46-60", "60+"]

export function agingBucketForDays(days: number): AgingBucket {
  if (days <= 15) return "0-15"
  if (days <= 30) return "16-30"
  if (days <= 45) return "31-45"
  if (days <= 60) return "46-60"
  return "60+"
}
