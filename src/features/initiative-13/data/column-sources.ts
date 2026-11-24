/**
 * Where every OAR Utilization table column comes from, shown on hovering its
 * heading (`ColumnHead`). One entry per column meaning, so "Issued" reads the
 * same on every screen.
 *
 * Three kinds, said in words so nobody looks in SAP for a platform value:
 * a SAP table-field, a value calculated from SAP fields, or Spares AI's own.
 */

export const COLUMN_SOURCES = {
  // --- shared
  material: "SAP: MARA-MATNR (material) · name from MAKT-MAKTX",
  plant: "SAP: MARC-WERKS (plant)",
  reservation: "SAP: RESB-RSNUM / RSPOS (reservation / item)",
  stockOnHand: "SAP: MARD-LABST (unrestricted stock), summed over storage locations",

  // --- reservations
  required: "SAP: RESB-BDTER (requirement date)",
  reservedQty: "SAP: RESB-BDMNG (requirement quantity)",
  issuedOnReservation:
    "SAP: MSEG-MENGE, movements 201/261 less reversals 202/262, matched on MSEG-RSNUM/RSPOS · date MKPF-BUDAT",
  stage:
    "Calculated from SAP: RESB-BANFN → EBAN (PR) → EKPO (PO) → EKBE (receipts) → MSEG 201/261 (issues), deletion flags RESB-XLOEK / EBAN-LOEKZ",
  sessionItemText: "SAP: RESB-SGTXT (item text), read for the request (R…) or session (S…) ID",
  requester: "Spares AI: the Requester box of the assistant session the reservation's item text names (not in SAP)",

  // --- procurement lines
  poPr: "SAP: EKPO-EBELN / EBELP (PO / item) · EBAN-BANFN / BNFPO (PR / item)",
  received: "SAP: EKBE-MENGE, movement 101 less reversal 102 · date EKBE-BUDAT",
  procurement:
    "Calculated from SAP: received (EKBE) vs ordered (EKPO-MENGE); closed by EKPO-ELIKZ / LOEKZ; expected date EKET-EINDT",
  raisedBy: "SAP: RESB-BANFN (the reservation whose PR this is)",

  // --- 30-day GR not issued
  po: "SAP: EKPO-EBELN / EBELP (PO / item)",
  lastGr: "SAP: EKBE-BUDAT (goods-receipt posting date)",
  daysSinceGr: "Calculated from SAP: data date − EKBE-BUDAT of the receipt",
  matchedIssue:
    "Calculated from SAP: MSEG 201/261 for the material and plant, matched to receipts oldest delivery first (an estimate: SAP links an issue to a reservation, not to a PO)",
  nextPlannedIssue: "Spares AI: consumption plan captured in the assistant",

  // --- consumption
  stockType: "Calculated from SAP: days since the last MSEG 201/261 (Fast ≤ 365, Slow 366–730, Non-moving > 730 or never)",
  daysSinceMovement: "Calculated from SAP: data date − MKPF-BUDAT of the last goods movement of any type",
  issues: "SAP: MSEG-MENGE, movements 201/261 less reversals 202/262 · date MKPF-BUDAT",
  lastIssue: "SAP: MKPF-BUDAT of the last goods issue (MSEG 201/261, not reversed)",
  monthsOfCover: "Calculated from SAP: MARD-LABST ÷ average monthly issues (MSEG 201/261, last 12 months)",
  inventoryTurns: "Calculated from SAP: 12-month issues (MSEG 201/261) ÷ MARD-LABST",
  grNotIssued: "Calculated from SAP: receipts (EKBE 101) 30+ days old not matched by issues (MSEG 201/261)",

  // --- plans and acquired vs plan
  planned: "Spares AI: the plan's quantity · or SAP: RESB-BDMNG for a reservation made directly in SAP",
  acquiredVsPlan: "Calculated: planned quantity vs issued (MSEG 201/261 on the reservation)",
  planQty: "Spares AI: planned quantity captured in the assistant",
  planPurpose: "Spares AI: consumption plan captured in the assistant",
  planWindow: "Spares AI: usage window captured in the assistant",
  planCaptured: "Spares AI: when the plan was captured in the assistant",
  planSession: "Spares AI: assistant session or request ID",
  planReservation: "SAP: RESB-RSNUM / RSPOS whose item text (RESB-SGTXT) names this plan's request or session",

  // --- exceptions
  exceptionType: "Spares AI: exception rule that raised it",
  exceptionOwner: "Spares AI: requester the exception is assigned to",
  exceptionStatus: "Spares AI: exception workflow status",
  exceptionDetected: "Spares AI: when detection first raised it",
  exceptionDue: "Spares AI: response due date (5 days after assignment)",
  exceptionAction: "Spares AI: what can be done on the exception",
} as const

export type ColumnSource = keyof typeof COLUMN_SOURCES
