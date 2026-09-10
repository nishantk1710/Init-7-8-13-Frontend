import { FileText } from "lucide-react"

import type { SAPDocumentReference } from "@/lib/domain/contracts"
import { cn } from "@/lib/utils"

const TYPE_LABELS: Record<SAPDocumentReference["type"], string> = {
  RR: "RR",
  RESERVATION: "Reservation",
  PR: "PR",
  PO: "PO",
  GR: "GR",
  GI: "GI",
}

/**
 * Small pill showing a mock SAP document reference (RR/Reservation/PR/PO/GR/GI
 * + number, optional line). Every module that shows a document chain
 * (Initiative 8 repair PR->PO, Initiative 13 RR->...->GI) uses this instead
 * of hand-rolling its own document badge.
 */
export function SAPDocumentChip({
  doc,
  className,
}: {
  doc: SAPDocumentReference
  className?: string
}) {
  const typeLabel = TYPE_LABELS[doc.type]
  // Some callers already bake the type into the document number itself
  // (e.g. "PO-81001") — avoid rendering it twice as "PO PO-81001".
  const alreadyPrefixed = doc.documentNumber
    .toUpperCase()
    .startsWith(typeLabel.toUpperCase())

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-foreground",
        className
      )}
    >
      <FileText className="size-3 text-muted-foreground" />
      {alreadyPrefixed ? doc.documentNumber : `${typeLabel} ${doc.documentNumber}`}
      {doc.line && <span className="text-muted-foreground">/{doc.line}</span>}
    </span>
  )
}
