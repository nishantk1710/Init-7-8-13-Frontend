import type { AssistantSession, ReservationSeed } from "@demo/features/initiative-8/types/repair"

/**
 * Reservation-time Spares Assistant sessions (FR-5) and the 80-series
 * reservations they were for (FR-8).
 *
 * The session id is typed into the reservation's item text (RESB.SGTXT), as
 * agreed with the SAP team, and read back from there — so a reservation with
 * no id, an id nobody issued, or an id from a different part is a
 * MISSING_SESSION_ID exception.
 *
 * Session ids follow live's format: `S`, eight characters, one check
 * character.
 */
export const ASSISTANT_SESSIONS: AssistantSession[] = [
  { id: "SK4T7QW2MD", materialId: "800-14201", plantId: "PLANT-GBG", requester: "Sipho Mahlangu", openedAt: "26 Jul 2026, 09:05", quantity: 1, basis: ["STOCK"], outcome: "CHOSE_REPAIR" },
  { id: "SR8N3XJ5PB", materialId: "800-14201", plantId: "PLANT-GBG", requester: "Riaan Kruger", openedAt: "22 Aug 2026, 10:31", quantity: 1, basis: ["STOCK", "OPEN_REPAIR"], outcome: "BOUGHT_NEW" },
  { id: "SB2Q9LM6TC", materialId: "800-52260", plantId: "PLANT-GBG", requester: "Anton de Villiers", openedAt: "14 Aug 2026, 11:40", quantity: 2, basis: ["STOCK"], outcome: "BOUGHT_NEW" },
  { id: "SM6V1RK8EH", materialId: "800-52260", plantId: "PLANT-GBG", requester: "Anton de Villiers", openedAt: "17 Aug 2026, 07:55", quantity: 2, basis: ["STOCK"], outcome: "CHOSE_REPAIR" },
  { id: "SD9F4TA7WN", materialId: "800-22110", plantId: "PLANT-BMM", requester: "Thabo Nkosi", openedAt: "27 Aug 2026, 14:20", quantity: 1, basis: ["STOCK"], outcome: "CHOSE_REPAIR" },
  { id: "SH3K8PZ1QA", materialId: "800-39950", plantId: "PLANT-GBG", requester: "Thabo Nkosi", openedAt: "21 Aug 2026, 08:10", quantity: 1, basis: ["STOCK"], outcome: "CHOSE_REPAIR" },
  { id: "SW5C2NE9JR", materialId: "800-39950", plantId: "PLANT-GBG", requester: "Marius Botha", openedAt: "2 Sep 2026, 07:02", quantity: 1, basis: ["STOCK", "OPEN_REPAIR"], outcome: "BOUGHT_NEW" },
  { id: "SL7X4DB3UF", materialId: "800-33870", plantId: "PLANT-GBG", requester: "Nomvula Dlamini", openedAt: "20 Jul 2026, 06:48", quantity: 1, basis: ["STOCK"], outcome: "CHOSE_REPAIR" },
  { id: "SQ1J6WH8YC", materialId: "800-47120", plantId: "PLANT-BMM", requester: "Sarah van Wyk", openedAt: "28 Jul 2026, 13:15", quantity: 1, basis: ["STOCK"], outcome: "CHOSE_REPAIR" },
  { id: "SF8P2MV5KG", materialId: "800-71205", plantId: "PLANT-GBG", requester: "Pieter Steyn", openedAt: "5 Aug 2026, 10:02", quantity: 1, basis: [], outcome: "CHOSE_REPAIR" },
  { id: "SN4R7TC2XE", materialId: "800-27340", plantId: "PLANT-BMM", requester: "Nangula Shivute", openedAt: "27 Aug 2026, 09:30", quantity: 1, basis: ["STOCK", "OPEN_REPAIR"], outcome: "BOUGHT_NEW" },
  { id: "SY9D3HK6LB", materialId: "800-47120", plantId: "PLANT-GBG", requester: "Riaan Kruger", openedAt: "20 Jul 2026, 15:44", quantity: 1, basis: ["STOCK"], outcome: "CHOSE_REPAIR" },
  { id: "SG2M8WQ4NV", materialId: "800-58830", plantId: "PLANT-GBG", requester: "Amanda Petersen", openedAt: "15 Jul 2026, 08:25", quantity: 1, basis: [], outcome: "CHOSE_REPAIR" },
  { id: "SZ6T1LF9PD", materialId: "800-12090", plantId: "PLANT-GBG", requester: "Pieter Steyn", openedAt: "10 Aug 2026, 11:11", quantity: 1, basis: [], outcome: "NO_REPAIRABLE_UNIT" },
  { id: "SC5H9RB2MJ", materialId: "800-36640", plantId: "PLANT-BMM", requester: "Riaan Kruger", openedAt: "15 Jul 2026, 12:00", quantity: 2, basis: ["STOCK"], outcome: "CHOSE_REPAIR" },
  { id: "SX3W7GN1KT", materialId: "800-29010", plantId: "PLANT-BMM", requester: "Riaan Kruger", openedAt: "1 Sep 2026, 16:05", quantity: 1, basis: ["AT_VENDOR_NO_PO"], outcome: "CHOSE_REPAIR" },
  { id: "SV8L2QP5HA", materialId: "800-60415", plantId: "PLANT-BMM", requester: "Thabo Nkosi", openedAt: "30 Aug 2026, 10:40", quantity: 1, basis: ["STOCK"], outcome: "ABANDONED" },
  { id: "SP4K9DX2RW", materialId: "800-27340", plantId: "PLANT-BMM", requester: "Nomvula Dlamini", openedAt: "23 Jul 2026, 07:30", quantity: 2, basis: ["STOCK"], outcome: "CHOSE_REPAIR" },
  { id: "SE7R3VY8JN", materialId: "800-18830", plantId: "PLANT-BMM", requester: "Pieter Steyn", openedAt: "28 Aug 2026, 09:45", quantity: 1, basis: ["STOCK", "OPEN_REPAIR"], outcome: "CHOSE_REPAIR" },
]

/** Every 80-series reservation in the extract, with what its item text says. */
export const RESERVATIONS: ReservationSeed[] = [
  { reservation: { type: "RESERVATION", documentNumber: "0041207", line: "1" }, materialId: "800-14201", plantId: "PLANT-GBG", quantity: 1, requester: "Sipho Mahlangu", createdAt: "26 Jul 2026", itemText: "SK4T7QW2MD" },
  { reservation: { type: "RESERVATION", documentNumber: "0041288", line: "1" }, materialId: "800-14201", plantId: "PLANT-GBG", quantity: 1, requester: "Riaan Kruger", createdAt: "22 Aug 2026", itemText: "SR8N3XJ5PB" },
  { reservation: { type: "RESERVATION", documentNumber: "0041251", line: "1" }, materialId: "800-52260", plantId: "PLANT-GBG", quantity: 2, requester: "Anton de Villiers", createdAt: "14 Aug 2026", itemText: "SB2Q9LM6TC" },
  { reservation: { type: "RESERVATION", documentNumber: "0041266", line: "1" }, materialId: "800-52260", plantId: "PLANT-GBG", quantity: 2, requester: "Anton de Villiers", createdAt: "17 Aug 2026", itemText: "SM6V1RK8EH" },
  { reservation: { type: "RESERVATION", documentNumber: "0041301", line: "1" }, materialId: "800-22110", plantId: "PLANT-BMM", quantity: 1, requester: "Thabo Nkosi", createdAt: "27 Aug 2026", itemText: "SD9F4TA7WN" },
  { reservation: { type: "RESERVATION", documentNumber: "0041280", line: "1" }, materialId: "800-39950", plantId: "PLANT-GBG", quantity: 1, requester: "Thabo Nkosi", createdAt: "21 Aug 2026", itemText: "SH3K8PZ1QA" },
  { reservation: { type: "RESERVATION", documentNumber: "0041330", line: "1" }, materialId: "800-39950", plantId: "PLANT-GBG", quantity: 1, requester: "Marius Botha", createdAt: "2 Sep 2026", itemText: "SW5C2NE9JR" },
  { reservation: { type: "RESERVATION", documentNumber: "0041180", line: "1" }, materialId: "800-33870", plantId: "PLANT-GBG", quantity: 1, requester: "Nomvula Dlamini", createdAt: "20 Jul 2026", itemText: "SL7X4DB3UF" },
  { reservation: { type: "RESERVATION", documentNumber: "0041211", line: "1" }, materialId: "800-47120", plantId: "PLANT-BMM", quantity: 1, requester: "Sarah van Wyk", createdAt: "28 Jul 2026", itemText: "SQ1J6WH8YC" },
  { reservation: { type: "RESERVATION", documentNumber: "0041230", line: "1" }, materialId: "800-71205", plantId: "PLANT-GBG", quantity: 1, requester: "Pieter Steyn", createdAt: "5 Aug 2026", itemText: "SF8P2MV5KG" },
  { reservation: { type: "RESERVATION", documentNumber: "0041298", line: "1" }, materialId: "800-27340", plantId: "PLANT-BMM", quantity: 1, requester: "Nangula Shivute", createdAt: "27 Aug 2026", itemText: "SN4R7TC2XE" },
  { reservation: { type: "RESERVATION", documentNumber: "0041185", line: "1" }, materialId: "800-47120", plantId: "PLANT-GBG", quantity: 1, requester: "Riaan Kruger", createdAt: "20 Jul 2026", itemText: "SY9D3HK6LB" },
  { reservation: { type: "RESERVATION", documentNumber: "0041160", line: "1" }, materialId: "800-58830", plantId: "PLANT-GBG", quantity: 1, requester: "Amanda Petersen", createdAt: "15 Jul 2026", itemText: "SG2M8WQ4NV" },
  { reservation: { type: "RESERVATION", documentNumber: "0041240", line: "1" }, materialId: "800-12090", plantId: "PLANT-GBG", quantity: 1, requester: "Pieter Steyn", createdAt: "10 Aug 2026", itemText: "SZ6T1LF9PD" },
  { reservation: { type: "RESERVATION", documentNumber: "0041150", line: "1" }, materialId: "800-36640", plantId: "PLANT-BMM", quantity: 2, requester: "Riaan Kruger", createdAt: "15 Jul 2026", itemText: "SC5H9RB2MJ" },
  { reservation: { type: "RESERVATION", documentNumber: "0041325", line: "1" }, materialId: "800-29010", plantId: "PLANT-BMM", quantity: 1, requester: "Riaan Kruger", createdAt: "1 Sep 2026", itemText: "SX3W7GN1KT" },
  { reservation: { type: "RESERVATION", documentNumber: "0041205", line: "1" }, materialId: "800-27340", plantId: "PLANT-BMM", quantity: 2, requester: "Nomvula Dlamini", createdAt: "23 Jul 2026", itemText: "SP4K9DX2RW" },

  // Blank item text: the requester was never given, or never typed, an id.
  { reservation: { type: "RESERVATION", documentNumber: "0041318", line: "1" }, materialId: "800-45210", plantId: "PLANT-GBG", quantity: 1, requester: "Riaan Kruger", createdAt: "30 Aug 2026" },
  // The old pilot's format -- no session carries it.
  { reservation: { type: "RESERVATION", documentNumber: "0041292", line: "1" }, materialId: "800-18830", plantId: "PLANT-BMM", quantity: 1, requester: "Pieter Steyn", createdAt: "28 Aug 2026", itemText: "SESS 4471" },
  // A real session id, but for a seal cartridge at Gamsberg, not this motor.
  { reservation: { type: "RESERVATION", documentNumber: "0041274", line: "1" }, materialId: "800-27340", plantId: "PLANT-BMM", quantity: 1, requester: "Nomvula Dlamini", createdAt: "20 Aug 2026", itemText: "SB2Q9LM6TC" },
  // Reserved before the assistant went live -- nobody could have had an id.
  { reservation: { type: "RESERVATION", documentNumber: "0041098", line: "1" }, materialId: "800-60415", plantId: "PLANT-BMM", quantity: 1, requester: "Thabo Nkosi", createdAt: "25 Jun 2026" },
]
