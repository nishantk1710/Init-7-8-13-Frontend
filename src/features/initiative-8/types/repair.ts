import type { MaterialReference, PlantReference, SAPDocumentReference } from "@/lib/domain/contracts"

/**
 * Initiative 8 domain types. These are richer than the shared
 * `contracts.ts` shapes on purpose — cross-initiative code only ever sees
 * `GlobalAction` / `AuditEvent` / `Material360Signal` / `InitiativeSummary`,
 * never these.
 */

/**
 * Where a repair chain sits in its lifecycle.
 *
 * No "In Transit Return": it is not an FRS stage, and nothing in MSEG or EKBE
 * tells "shipped back" apart from "still at the vendor". "PR Raised" is not
 * emitted today -- the register is built from PO lines -- but FRS acceptance
 * criterion 3 counts open repair PR lines too, so the stage stays.
 */
export type RepairStatus =
  | "PR Raised"
  | "PO Issued"
  | "At Vendor"
  | "Received"
  | "Closed"

/** Physical receipt state of the repaired unit(s) back into stores. */
export type ReceiptStatus =
  | "Not Yet Shipped"
  | "Awaiting Receipt"
  | "Partially Received"
  | "Received"

/**
 * Condition-to-repair declaration status (FR-4).
 *
 * `Flagged` means an attestation covers the line but did NOT find the part
 * repairable, and it went for repair anyway. There is no "Pending": the FRS
 * has no approval step, so an attestation is recorded or it is not.
 */
export type DeclarationStatus = "Required" | "Completed" | "Flagged"

export type DeclarationCondition = "Repairable" | "Beyond Economical Repair" | "Scrap"

/**
 * A label like `"0-15"` or `"60+"`.
 *
 * Not a fixed literal union: the day boundaries behind these bands are
 * configuration on the backend (`I8_AGING_BAND_BOUNDARIES`, FRS open item 5,
 * pending VZI calibration), so the set of valid labels can change without a
 * frontend deploy. `DEFAULT_AGING_BUCKETS` in `utils/status.ts` is the
 * fallback used in `scenario` mode and if a live snapshot fetch fails — it is
 * a default, not the contract.
 */
export type AgingBucket = string

/**
 * Where a repair line stands against its promised return date.
 *
 * Served by `GET /api/i8/register` as `overdueStatus`. It exists because
 * "not overdue" and "nobody ever agreed a date" are different answers, and
 * collapsing them hides exactly the lines that need chasing — 63 of the 1,225
 * repair lines in the July extract have no schedule line at all.
 *
 * Prefer `isRepairOverdue()` in `utils/status.ts` over comparing
 * `daysRemainingInRepair` directly: that field is now optional, and
 * `undefined < 0` is `false`, which would silently mark an undated line as
 * on time.
 */
export type OverdueStatus = "ON_TIME" | "OVERDUE" | "NO_DUE_DATE" | "RECEIVED"

/**
 * Where a repair line stands against the material's planned delivery time.
 *
 * Served by `GET /api/i8/register` as `leadTimeStatus`. A **second,
 * independent** signal, not a fallback for `OverdueStatus`: one asks whether
 * the line passed the date somebody promised on the PO, this asks whether it
 * has taken longer than this material normally takes. A row can be `ON_TIME`
 * and `BEYOND_LEAD_TIME` at once — that disagreement is the finding, not an
 * error to resolve away, and it is why the check runs on every line rather
 * than only the 63 with no agreed date.
 *
 * The benchmark is `MARC.PLIFZ` (planned delivery time, calendar days, PO to
 * received) — the same field Initiative 07 uses, so the two initiatives cannot
 * report different turnarounds for the same part.
 *
 * `NO_LEAD_TIME` means there is nothing to compare against, and covers every
 * Gamsberg line: the planning extract omits plant 1500 entirely. Render it as
 * "not known", never as "fine".
 */
export type LeadTimeStatus =
  | "WITHIN_LEAD_TIME"
  | "BEYOND_LEAD_TIME"
  | "NO_LEAD_TIME"

/**
 * A single repairable material's active (or recently closed) repair chain —
 * the core entity behind the Repair Register and Repair Detail pages.
 */
export interface RepairChain {
  id: string
  material: MaterialReference
  plant: PlantReference

  /**
   * Unrestricted stock on hand, summed across storage locations.
   *
   * Optional: the backend returns null when the material has no MARD row.
   * That is "we do not know", which is not the same as zero stock — and zero
   * stock is what triggers a duplicate purchase, so the two must not be
   * conflated.
   */
  stockOnHand?: number

  /**
   * Optional, and undefined far more often than you would expect: the MARC
   * extract has rows for plant 1300 only, so **every Gamsberg material has
   * no reorder point at all**. Rendering a missing one as 0 would read as
   * "never reorder this", which is a worse answer than "unknown".
   */
  reorderPoint?: number

  /** Units physically out for repair right now (0 once received/closed). */
  qtyUnderRepair: number
  repairPR: SAPDocumentReference
  repairPO?: SAPDocumentReference

  /**
   * Optional: the vendor comes from the purchase-order header, and 455 of the
   * 1,225 repair lines have no header in the July extract (EKKO starts
   * 07-Jan-2025; EKPO reaches further back). Undefined means "not known from
   * this data" — an empty string would read as a vendor whose name is blank.
   *
   * When it is a bare SAP vendor code, `vendorName` carries the display name
   * if LFA1 knows it. It usually does not: only 4 of the 61 repair vendors in
   * the extract resolve to a name.
   */
  vendor?: string

  /** Display name for `vendor`, when the vendor master knows it. */
  vendorName?: string

  repairStatus: RepairStatus
  receiptStatus: ReceiptStatus
  declarationStatus: DeclarationStatus

  /**
   * Where this line stands against its promised date. Authoritative when
   * present — use `isRepairOverdue()` rather than reading it directly, so the
   * mock-data path keeps working.
   */
  overdueStatus?: OverdueStatus

  /**
   * Whether this line has run past its material's planned delivery time.
   * Independent of `overdueStatus` — see the type's own note. Optional because
   * the mock-data path does not produce it.
   */
  leadTimeStatus?: LeadTimeStatus

  /**
   * How long this repair has been out: whole days from the repair PO line's
   * creation date (`EKPO.ERDAT`, falling back to the PO header's `EKKO.AEDAT`)
   * to the receipt, or to the reference date while the unit is still away. Not
   * measured from the PR, despite the column's name.
   *
   * Stops at the receipt, so a closed line reads its turnaround rather than
   * how old the record is — otherwise a July-2026 extract read with an
   * unpinned `I8_REFERENCE_DATE` shows a long-closed line in the hundreds.
   * The backend serves the same number as `daysElapsed`, and `agingBucket` is
   * the band this falls in.
   */
  daysOpen: number
  agingBucket: AgingBucket

  /**
   * The repair's actual duration: raised to received, or raised to the
   * reference date while the unit is still out. The same clock as `daysOpen`.
   *
   * This is what `leadTimeStatus` and `daysOverLeadTime` are computed from.
   * Optional because the mock-data path does not produce it.
   */
  daysElapsed?: number

  /**
   * The planned delivery time this line is measured against, in calendar days.
   * Undefined where none is maintained — including every Gamsberg line.
   */
  leadTimeDays?: number

  /**
   * Days past the planned delivery time; negative while still inside it.
   * Undefined when there is no lead time to measure against — NOT 0, so an
   * unmeasurable line cannot average in as "finished exactly on time".
   */
  daysOverLeadTime?: number
  raisedAt: string
  poIssuedAt?: string
  sentToVendorAt?: string

  /**
   * Optional: 63 of the 1,225 repair lines have no schedule line in SAP, so no
   * return date was ever agreed. Those are the lines nobody is chasing, which
   * is precisely why a placeholder date must not be invented for them — they
   * come through as `overdueStatus: "NO_DUE_DATE"`.
   */
  expectedReturn?: string

  /**
   * Negative once the expected-return date has passed. Undefined when there is
   * no expected return to count towards.
   *
   * Do not test this with `< 0` to mean overdue: `undefined < 0` is `false`,
   * so an undated line would silently read as on time. Use `isRepairOverdue()`.
   */
  daysRemainingInRepair?: number

  receivedAt?: string

  /**
   * Net order price of the repair PO line (EKPO). Undefined when the line
   * carries none — shown as unknown, never as R 0.00, which would read as a
   * free repair.
   */
  repairCost?: number

  /**
   * Lead time to buy a NEW one — the number that makes waiting for a repair
   * worth it.
   *
   * Optional, and undefined on **357 of the 1,225 repair lines**: it comes from
   * the MARC planning extract, which has rows for plant 1300 only, so every
   * Gamsberg line has none. Exactly the same gap as `reorderPoint`, measured on
   * exactly the same rows.
   *
   * Rendering it as 0 would read as "a new one arrives immediately", which is
   * the most persuasive possible argument against repairing anything.
   */
  newUnitLeadTimeDays?: number

  /**
   * NORMAL, OBSOLETE, CRITICAL, IMPACT or INSURANCE, from ZMM065. Undefined
   * when no rating exists — "not recorded", never "NORMAL".
   */
  criticality?: string

  /**
   * The repair PO line is blocked in SAP. Still a live line — it stays in
   * every count and is flagged on screen rather than hidden.
   */
  poBlocked?: boolean

  // --- The declaration, in full ------------------------------------------
  // The Declaration Queue screen was folded into the register on 08-Oct-2026;
  // what it showed per row now travels on the line. All undefined when no
  // attestation covers the line.

  /** Who recorded the attestation. */
  declaredBy?: string
  /** When, as a display date. */
  declaredAt?: string
  /** What the attestation concluded. */
  condition?: DeclarationCondition
  /** What a person should do about this line's declaration, in a sentence. */
  declarationNextAction?: string
  /** EKPO.AFNAM — a requisitioner CODE, not a name. */
  requester?: string

  /**
   * FR-7 on this line. Undefined when no reason was recorded while it was out
   * and no new purchase overlapped it without one — the Justifications screen
   * was folded into the register on 08-Oct-2026.
   */
  justification?: RepairJustification
}

/**
 * The register's Justification cell.
 *
 * A justification is recorded against a material, a plant and an assistant
 * session — never against a repair line — so the backend attaches one to every
 * line of that part that was out when it was recorded. Justifications recorded
 * while a unit was merely on the shelf have no line to sit on; they appear
 * only on the Justifications screen.
 */
export type JustificationStatus = "RECORDED" | "MISSING"

/** One NEW_ACQUISITION justification recorded while the line was out. */
export interface RepairJustificationEntry {
  id?: string
  reasonCategory?: string
  freeText?: string
  author?: string
  /** Display date and time. */
  recordedAt?: string
  /** The assistant session it was recorded in. */
  sessionId?: string
}

/** A new unit bought while the line was out, with no reason recorded. */
export interface UnjustifiedPurchase {
  /** The `UNJUSTIFIED_ACQUISITION` exception this is. */
  exceptionId: string
  purchase: SAPDocumentReference
  raisedAt?: string
  /** Bought before the justification control existed — nobody was asked. */
  preAutomation: boolean
}

export interface RepairJustification {
  /** MISSING whenever any overlapping purchase has no reason, even if another
   *  one does: that is the one somebody has to act on. */
  status: JustificationStatus
  /** Newest first. */
  entries: RepairJustificationEntry[]
  unjustifiedPurchases: UnjustifiedPurchase[]
}

/** One PO line whose free text mentioned repair (W5.5 coding-candidate screen). */
export interface CodingCandidateLine {
  purchasingDocument: string
  item: string
  plant?: PlantReference
  /** The text the verdict was reached on — served so a cataloguer can check
   *  the call without going back to SAP. */
  shortText: string
  matchedKeywords: string[]
  raisedAt?: string
  itemCategory?: string
}

/**
 * An 80-series material carrying the identical text as a coding candidate.
 *
 * SAP's own counter-example, not a model's opinion: the naming convention was
 * demonstrably applied to this exact description elsewhere and not here.
 */
export interface CodingCandidateTwin {
  materialId: string
  sharedText: string
}

/**
 * One material the coding-candidate screen judged (FR-2): PO free text talks
 * about repair, but the material is not 80-series coded. Advisory only —
 * nothing here writes to SAP or changes a material's coding.
 *
 * `verdict`/`confidence` are plain strings, not a closed union: the verdict
 * vocabulary (`MISCODED_REPAIRABLE`, `REPAIR_SERVICE`,
 * `CONSUMABLE_FOR_REPAIR`, `UNCLEAR`, `UNSCREENED`) is a backend
 * implementation decision, not an FRS-specified set — see
 * `app/initiatives/i8/coding_candidates.py`.
 */
export interface CodingCandidate {
  /** No material-master description exists for most of these (roughly nine
   *  in ten 80-series materials are outside it, and these are the ones
   *  furthest from being coded at all) — `description` falls back to the
   *  first PO short text the material was screened on, which is the only
   *  descriptive text that actually exists for it. */
  material: MaterialReference
  verdict: string
  /** high / medium / low, as the model reported it. Empty when unscreened —
   *  never treated as a real judgement, however low a threshold is set. */
  confidence: string
  /** Why, in the model's own words. */
  reason: string
  plants: string[]
  lines: CodingCandidateLine[]
  distinctTexts: string[]
  twins: CodingCandidateTwin[]
  /** SAP itself carries the counter-example — the strongest evidence this
   *  screen produces, and it owes nothing to the model. */
  isCorroborated: boolean
  /** MISCODED_REPAIRABLE or UNCLEAR — the ones a human should look at. */
  isActionable: boolean
  /** Whether the model's own confidence clears the configured threshold. A
   *  sibling to `isActionable`, not a replacement — they answer different
   *  questions. */
  meetsConfidenceThreshold: boolean
  /** Expected false on every row — true would mean this screen and the
   *  repairable universe (FR-1) disagree about the same material. */
  inRepairableUniverse: boolean
  model: string
  /** WHO answered — "stub" means nothing was really judged. */
  provider: string
  screenedAt?: string
}

/**
 * One condition-to-repair declaration row.
 *
 * The Declaration Queue screen that rendered these is gone (folded into the
 * register, 08-Oct-2026). The type stays for the scenario fixtures in
 * `data/declarations.ts`, which still feed the cross-initiative selectors.
 */
export interface DeclarationItem {
  id: string
  pr: SAPDocumentReference
  material: MaterialReference

  /**
   * Optional, and only populated by the live API.
   *
   * The condition-to-repair attestation is recorded per material-PLANT, not per
   * material — the same part can be assessed at Black Mountain and at Gamsberg
   * and the two are different records. So the form needs the plant, and the
   * queue row is where it comes from.
   *
   * The scenario fixtures omit it: their declarations were written before the
   * write path existed, and inventing a plant for them would put a site on an
   * audit record that never named one.
   */
  plant?: PlantReference

  requester: string
  hasActiveRepair: boolean
  relatedRepairId?: string

  /**
   * Units still out on the related repair line, joined from the register.
   * Only the default for the attestation form's quantity — undefined when the
   * register could not be read or the line is already back.
   */
  quantityUnderRepair?: number
  status: DeclarationStatus
  declaredBy?: string
  declaredAt?: string
  condition?: DeclarationCondition
  nextAction: string
  createdAt: string
}

