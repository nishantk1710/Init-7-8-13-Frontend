// W2.5 — what each initiative actually needs from SAP, declared per initiative
// and asserted against the measured contract.
//
// This is the list that catches the `Value_old` vs `ValueOld` class of error —
// a wrong assumption we genuinely held until the 08-Sep sweep corrected it.
//
// Scope: only fields the plan names for I07/I08/I13 and that exist today. It
// grows as the mappers are written (W2.6b); it is not meant to be a wishlist,
// and a field belongs here only once real code depends on it. Fields SAP has
// not exposed yet (Sernp, Bednr on ReservationItemSet) live in
// known-conditions.ts as expected-absent instead.

export interface InitiativeRequirement {
  initiative: "I07" | "I08" | "I13"
  entitySet: string
  fields: string[]
  why: string
}

export const REQUIRED_FIELDS: InitiativeRequirement[] = [
  // ---- I07 — inventory planning ----
  {
    initiative: "I07",
    entitySet: "MaterialPlantSet",
    fields: ["Matnr", "Werks", "Minbe", "Eisbe", "Mabst", "Plifz"],
    why: "Reorder point, safety stock and max stock are what a recommendation moves; Plifz is the W2.9 lead-time source.",
  },
  {
    initiative: "I07",
    entitySet: "MaterialSet",
    fields: ["Matnr", "Mtart", "Matkl", "Meins", "Mstae"],
    why: "Material identity and unit for display; Mstae is the obsolete signal in the scope rule.",
  },
  {
    initiative: "I07",
    entitySet: "MaterialValuationSet",
    fields: ["Matnr", "Bwkey", "Lbkum", "Salk3", "Verpr", "Stprs", "Peinh"],
    why: "Stock value and value-of-avoided-purchase figures. Currently returns zero rows (§1.3).",
  },
  {
    initiative: "I07",
    entitySet: "ChangeDocItemSet",
    fields: ["Objectclas", "Objectid", "Changenr", "Tabname", "Fname", "Value_old", "Value_new"],
    why: "FR-9: did the recommendation actually get applied in SAP? Filter-first only — 929k rows (§1.4).",
  },
  {
    initiative: "I07",
    entitySet: "ChangeDocHeaderSet",
    fields: ["Objectclas", "Objectid", "Changenr", "Username", "Udate", "Utime"],
    why: "Who applied the change and when. Utime is Edm.Time, not Edm.DateTime.",
  },
  {
    initiative: "I07",
    entitySet: "PurchaseRequisitionSet",
    fields: ["Banfn", "Bnfpo", "Matnr", "Werks"],
    why: "The PR-to-PO view. $count was broken here until the 09-Sep 2026 sweep; now reads count normally under auto paging (W2.3).",
  },

  // ---- I08 — repairable spares ----
  {
    initiative: "I08",
    entitySet: "PurchaseOrderItemSet",
    fields: ["Ebeln", "Ebelp", "Matnr", "Werks", "Netpr", "Netwr", "Bednr"],
    why: "Repair POs on 80-series materials. Netpr/Netwr are Edm.String today — never coerce by shape.",
  },
  {
    initiative: "I08",
    entitySet: "GoodsMovementItemSet",
    fields: ["Mblnr", "Mjahr", "Zeile", "Matnr", "Werks", "Bwart"],
    why: "Movements in and out of repair. $count was broken here too until the 09-Sep 2026 sweep (W2.3).",
  },

  // ---- I13 — consumption planning (OAR) ----
  {
    initiative: "I13",
    entitySet: "ReservationItemSet",
    fields: ["Rsnum", "Rspos", "Matnr", "Werks", "Bdter", "Bdmng", "Enmng", "Banfn", "Bnfpo", "Bwart", "Wempf"],
    why: "Reservations are the backbone of consumption plans. Returned zero rows until the 09-Sep 2026 sweep (§1.3); now 1,000.",
  },
  {
    initiative: "I13",
    entitySet: "ReservationItemSet",
    fields: ["Umwrk", "Umlgo"],
    why: "Receiving plant and storage location on a transfer — found by the sweep, directly useful to redeployment.",
  },
  {
    initiative: "I13",
    entitySet: "MaterialPlantSet",
    fields: ["Matnr", "Werks", "Dismm"],
    why: "OAR scope is per material per plant. Read only through lib/sap/scope, never directly.",
  },
]
