import type { NewUnitPurchase, UnpaperedDispatch } from "@demo/features/initiative-8/types/repair"

/**
 * New-unit purchases of 80-series materials — PR and PO lines that are NOT
 * repair lines (item category is not 3). Every one is checked against the
 * repairable-unit rule (FR-6) on the day it was raised: was there stock on the
 * shelf, a repair open, or a unit at a vendor with no repair PO? If so, and no
 * justification names the purchase, it is an UNJUSTIFIED_ACQUISITION.
 *
 * `stockAtTime` is MARD as the check recorded it on the day: MARD itself only
 * ever shows today's stock.
 */
export const NEW_UNIT_PURCHASES: NewUnitPurchase[] = [
  { line: { type: "PO", documentNumber: "PO-94477", line: "20" }, materialId: "800-14201", plantId: "PLANT-GBG", quantity: 1, raisedAt: "22 Aug 2026", requester: "Riaan Kruger", sessionId: "SR8N3XJ5PB", stockAtTime: 1 },
  { line: { type: "PO", documentNumber: "PO-93980", line: "10" }, materialId: "800-52260", plantId: "PLANT-GBG", quantity: 2, raisedAt: "14 Aug 2026", requester: "Anton de Villiers", sessionId: "SB2Q9LM6TC", stockAtTime: 2 },
  { line: { type: "PO", documentNumber: "PO-94655", line: "10" }, materialId: "800-31090", plantId: "PLANT-BMM", quantity: 1, raisedAt: "20 Aug 2026", requester: "Jacques Louw", stockAtTime: 0 },
  { line: { type: "PR", documentNumber: "PR-90112", line: "10" }, materialId: "800-18830", plantId: "PLANT-BMM", quantity: 2, raisedAt: "1 Sep 2026", requester: "MRP", stockAtTime: 1 },
  { line: { type: "PR", documentNumber: "PR-90640", line: "10" }, materialId: "800-39950", plantId: "PLANT-GBG", quantity: 1, raisedAt: "2 Sep 2026", requester: "Marius Botha", sessionId: "SW5C2NE9JR", stockAtTime: 1 },
  { line: { type: "PO", documentNumber: "PO-94812", line: "10" }, materialId: "800-58830", plantId: "PLANT-GBG", quantity: 1, raisedAt: "1 Sep 2026", requester: "Thabo Nkosi", stockAtTime: 0 },
  { line: { type: "PO", documentNumber: "PO-94930", line: "10" }, materialId: "800-29010", plantId: "PLANT-BMM", quantity: 1, raisedAt: "25 Aug 2026", requester: "Riaan Kruger", stockAtTime: 0 },
  { line: { type: "PO", documentNumber: "PO-93120", line: "10" }, materialId: "800-60415", plantId: "PLANT-BMM", quantity: 1, raisedAt: "20 Jun 2026", requester: "Thabo Nkosi", stockAtTime: 1 },
  { line: { type: "PO", documentNumber: "PO-94701", line: "10" }, materialId: "800-27340", plantId: "PLANT-BMM", quantity: 1, raisedAt: "27 Aug 2026", requester: "Nangula Shivute", sessionId: "SN4R7TC2XE", stockAtTime: 2 },
  // Nothing repairable existed: no stock, no repair, nothing at a vendor. The
  // check ran and passed — the reason "purchases checked" is bigger than the
  // exception count.
  { line: { type: "PO", documentNumber: "PO-94020", line: "10" }, materialId: "800-12090", plantId: "PLANT-GBG", quantity: 1, raisedAt: "10 Aug 2026", requester: "Pieter Steyn", sessionId: "SZ6T1LF9PD", stockAtTime: 0 },
]

/**
 * 541s to vendor stock with no repair PR or PO behind them. FR-6(b) read as
 * "a unit at a vendor without the paperwork" — the reading the July MSEG
 * extract supports (16 such rows), and the Snapshot's default until VZI picks.
 */
export const UNPAPERED_DISPATCHES: UnpaperedDispatch[] = [
  {
    id: "UPD-1",
    materialDocument: { type: "GI", documentNumber: "4900183320", line: "2" },
    materialId: "800-29010",
    plantId: "PLANT-BMM",
    vendor: "Metso Outotec Workshop",
    quantity: 1,
    postedAt: "18 Aug 2026",
  },
  {
    id: "UPD-2",
    materialDocument: { type: "GI", documentNumber: "4900181174", line: "2" },
    materialId: "800-44500",
    plantId: "PLANT-GBG",
    vendor: "Weir Minerals Service Center",
    quantity: 1,
    postedAt: "12 Aug 2026",
  },
]
