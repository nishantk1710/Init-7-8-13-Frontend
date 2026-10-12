// Where a ledger line stands on the Reservation -> PR -> PO -> GR -> GI chain.
//
// Read from the documents and dates the backend already stitched -- the
// furthest leg that exists is the stage. No quantity is recomputed here.

import type { UtilisationLedgerEntry } from "@/lib/api/i13"

export const LEDGER_STAGES = ["RESERVATION", "PR", "PO", "GR", "GI"] as const

export type LedgerStage = (typeof LEDGER_STAGES)[number]

export const LEDGER_STAGE_SHORT: Record<LedgerStage, string> = {
  RESERVATION: "Reservation",
  PR: "PR",
  PO: "PO",
  GR: "GR",
  GI: "GI",
}

export const LEDGER_STAGE_LABEL: Record<LedgerStage, string> = {
  RESERVATION: "Reserved",
  PR: "PR raised",
  PO: "PO raised",
  GR: "Goods received",
  GI: "Goods issued",
}

/** The furthest leg this line has reached, or `null` when none is linked. */
export function ledgerStage(entry: UtilisationLedgerEntry): LedgerStage | null {
  if (entry.firstGiDate || (entry.issuedQuantity ?? 0) > 0) return "GI"
  if (entry.firstGrDate || (entry.receivedQuantity ?? 0) > 0) return "GR"
  if (entry.poNumber) return "PO"
  if (entry.prNumber) return "PR"
  if (entry.reservationNumber) return "RESERVATION"
  return null
}

/** "Goods issued", or "Partly issued" when only some of it went out. */
export function ledgerStageLabel(entry: UtilisationLedgerEntry): string {
  const stage = ledgerStage(entry)
  if (stage === null) return "Not linked"
  if (stage === "GI" && entry.utilisationStatus === "PARTIALLY_ISSUED") return "Partly issued"
  return LEDGER_STAGE_LABEL[stage]
}
