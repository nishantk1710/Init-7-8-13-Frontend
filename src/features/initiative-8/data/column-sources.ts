/**
 * Where every I08 table column comes from, shown on hovering its heading
 * (`I08Head`). One entry per column meaning, not per screen, so "Material"
 * reads the same on the register as on the declarations log.
 *
 * Three kinds, said in words so nobody looks in SAP for a platform value:
 * a SAP table-field, a value calculated from SAP fields, or Spares AI's own.
 *
 * The same idea as Initiative 13's `column-sources.ts`, kept apart from it on
 * purpose: these are I08's columns, and a shared map would make either module
 * a reason to change the other. Where a column genuinely means the same thing
 * in both -- material, plant -- the wording is copied, so the two agree.
 *
 * Sources checked against the backend, not the FRS:
 * `I08_Live_Fields_And_Movement_Codes.md` is the glossary behind the wording.
 */

export const I08_COLUMN_SOURCES = {
  // --- shared
  material:
    "SAP: MARA-MATNR (material) · description from MAKT-MAKTX, falling back to the document line's own short text",

  // --- repair register
  plant: "SAP: EKPO-WERKS (plant) on a PO line, EBAN-WERKS on a PR row",
  repairPr:
    "SAP: EKPO-BANFN / BNFPO — the PR a repair PO line was raised from · EBAN-BANFN / BNFPO on a PR row with no PO yet",
  repairPo: "SAP: EKPO-EBELN / EBELP (PO / item)",
  vendor: "SAP: EKKO-LIFNR (supplier) · name from LFA1-NAME1",
  department:
    "SAP: EBAN-AFNAM (requisitioner) on the line's PR — the department code VZI types · the name beside it is Spares AI's department list",
  stage:
    "Calculated from SAP: At vendor once a 541 on the line is attributable (MSEG), PO issued until then; PR raised while EBAN has no PO yet",
  expectedBack:
    "SAP: the earliest EKET-EINDT over the line's schedule lines · a line with no EKET row has no date agreed, which is not the same as on time",
  daysOpen:
    "Calculated from SAP: data date − the date the line was raised (EKKO-AEDAT; EKPO's own creation date is not delivered)",
  declaration: "Spares AI: the condition declared in the reservation assistant, by whoever took the faulty unit out",
  qtyUnderRepair:
    "Calculated from SAP: EKPO-MENGE less what has been received against the line (MSEG 101 less 102, less 122 plus 123)",
  criticality:
    "SAP: the ZMM065 criticality report, uploaded per plant — a report, not a field on the material master, so a plant with none reads Not rated",

  // --- repair candidates (FR-2)
  candidateVerdict: "Spares AI: the AI's reading of the document text. Advisory — nothing here writes to SAP",
  candidateReason: "Spares AI: why the AI reached that verdict",
  candidatePlants: "SAP: the plants the material's candidate lines sit at (EKPO-WERKS, EBAN-WERKS, MSEG-WERKS)",
  candidateFoundIn:
    "SAP: the document line the text came from — EKPO-EBELN / EBELP (PO), EBAN-BANFN / BNFPO (PR) or MSEG-MBLNR / ZEILE (movement) · the text itself is EKPO-TXZ01, EBAN-TXZ01 or MSEG-SGTXT",
  newItemPrice:
    "SAP: MBEW-VERPR (moving average price) for the material at that plant. No purchase-order fallback: an empty cell means MBEW carries no price, never that the part is free",

  // --- condition declarations (FR-4)
  declaredAt: "Spares AI: when the declaration was made in the reservation assistant",
  declaredPlant: "Spares AI: the plant the part was reserved at, captured in the assistant",
  condition: "Spares AI: the condition the requester declared",
  fault: "Spares AI: the fault the requester described",
  declaredBy: "Spares AI: who made the declaration",

  // --- justifications (FR-7)
  justifiedAt: "Spares AI: when the reason was given in the assistant",
  justificationReason: "Spares AI: the reason chosen in the assistant for buying new",
  justificationNote: "Spares AI: the requester's own words",
  justificationBy: "Spares AI: who gave the reason",
  justifiedPurchase:
    "Calculated from SAP: the new-buy PR (EBAN-BANFN / BNFPO, dated EBAN-BADAT) or direct PO line (EKPO-EBELN / EBELP, dated EKKO-AEDAT) for the same material and plant inside the window. A match on part, plant and date — SAP carries no key tying a purchase to the request it answers",
  justificationSession: "Spares AI: the assistant session the reason was given in",
} as const

export type I08ColumnSource = keyof typeof I08_COLUMN_SOURCES
