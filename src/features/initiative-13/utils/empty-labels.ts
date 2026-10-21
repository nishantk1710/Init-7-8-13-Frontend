// What an I13 cell says when it has no value, in one place.
//
// A bare "—" told the user nothing: "no history", "no PO yet" and "not
// recorded" all looked the same. Each entry names why the value is missing
// (label, kept short for table cells) and says it in full on hover (title).
// Labels only -- no value is derived or reclassified here.

export interface EmptyLabel {
  label: string
  title: string
}

export const EMPTY_LABEL = {
  noConsumptionHistory: {
    label: "No consumption history",
    title: "Nothing was issued in the period, so there is no monthly usage to work this out from.",
  },
  noStockRecord: {
    label: "No stock record",
    title: "No stock figure was found for this material at this plant.",
  },
  notClassified: {
    label: "Not classified",
    title: "This material is not in the consumption tracking data, so it has no fast / slow / non-moving band.",
  },
  noMovement: {
    label: "No movement on record",
    title: "No goods movement was found for this material at this plant in the history the platform holds.",
  },
  noGrNotIssued: {
    label: "None",
    title: "No goods received and left unissued for 30 days or more.",
  },
  noPrOrPo: {
    label: "No PR or PO yet",
    title: "No purchase requisition or purchase order has been raised for this reservation.",
  },
  noPoYet: {
    label: "No PO yet",
    title: "No purchase order yet, so there is no delivery to show.",
  },
  noPoLinked: {
    label: "No PO linked",
    title: "No purchase order is linked to this line.",
  },
  noReservationLinked: {
    label: "No reservation linked",
    title: "No SAP reservation is linked to this exception.",
  },
  beforeHistory: {
    label: "Before history",
    title: "Not known: the reservation predates the goods-movement history the platform holds.",
  },
  notRecorded: {
    label: "Not recorded",
    title: "No value was recorded for this in SAP.",
  },
  noGrYet: {
    label: "No GR yet",
    title: "No goods receipt has been posted for this line.",
  },
  notIssued: {
    label: "Not issued",
    title: "No goods issue has been posted for this line.",
  },
  noPlanCaptured: {
    label: "No plan captured",
    title: "No consumption plan was captured for this material and plant.",
  },
  noneRecorded: {
    label: "None recorded",
    title: "No quantity has been posted for this yet.",
  },
  noPlanToCompare: {
    label: "No plan to compare",
    title: "Variance needs a captured plan to compare against.",
  },
  notRouted: {
    label: "Not routed yet",
    title: "This exception has not been sent to anybody yet.",
  },
  noDueDate: {
    label: "No due date",
    title: "No reply deadline has been set for this exception.",
  },
  unassigned: {
    label: "Unassigned",
    title: "Nobody is currently assigned to this exception.",
  },
} as const satisfies Record<string, EmptyLabel>

export type EmptyKind = keyof typeof EMPTY_LABEL
