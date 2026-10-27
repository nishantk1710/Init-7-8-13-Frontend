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
 * tells "shipped back" apart from "still at the vendor". "PR Raised" is a
 * repair requested on a PR with no PO yet (`lineKind: "PR"`): served since
 * 27-Oct-2026 when the backend switches PR rows on, because FRS acceptance
 * criterion 3 counts open repair PR lines too.
 *
 * The live register's PO lines are "PO Issued" or "At Vendor": since
 * 19-Oct-2026 it serves the lines SAP still has open, and none other.
 * "Received" and "Closed" remain for the scenario fixtures.
 */
export type RepairStatus =
  | "PR Raised"
  | "PO Issued"
  | "At Vendor"
  | "Received"
  | "Closed"

/**
 * Condition-to-repair declaration status (FR-4).
 *
 * `Flagged` means an attestation covers the line but did NOT find the part
 * repairable, and it went for repair anyway. There is no "Pending": the FRS
 * has no approval step, so an attestation is recorded or it is not.
 */
export type DeclarationStatus = "Required" | "Completed" | "Flagged" | "Historical"

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
 *
 * The backend never sends "RECEIVED" since 19-Oct-2026 -- every line it serves
 * is open in SAP. It stays here for the scenario fixtures, whose closed rows
 * `overdueStatusOf()` reads as received.
 *
 * "NOT_ORDERED" (since 27-Oct-2026) is a repair requested on a PR with no PO
 * yet: nothing is ordered, so no date can have been promised. Only PR rows
 * carry it.
 */
export type OverdueStatus = "ON_TIME" | "OVERDUE" | "NO_DUE_DATE" | "RECEIVED" | "NOT_ORDERED"

/**
 * What a register row is: a repair PO line, or an open repair PR with no PO
 * yet. Test it through `isPrOnly()` in `utils/status.ts`, which also treats a
 * row with no PO reference as a PR row.
 */
export type RegisterLineKind = "PO" | "PR"

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
 * A single repairable material's repair chain — the core entity behind the
 * Repair Register and Repair Detail pages. Live, every one is a repair PO line
 * SAP still has open (not "Delivery completed", deleted or blocked) -- or,
 * since 27-Oct-2026, an open repair PR with no PO yet (`lineKind: "PR"`).
 */
export interface RepairChain {
  /** `{EBELN}-{EBELP}` on a PO row; `PR-{BANFN}-{BNFPO}` on a PR row. */
  id: string
  /** `PO` for a repair PO line, `PR` for a repair requested with no PO yet. */
  lineKind: RegisterLineKind
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

  /** Units out for repair: the whole ordered quantity until SAP closes the
   *  line (0 on a closed scenario fixture). */
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
  declarationStatus: DeclarationStatus
  /**
   * The attestation covering this line, when one does.
   *
   * Served so the detail page can offer to AMEND it. Without the id the only
   * thing somebody who disagrees with a declaration could do is record a
   * second, unrelated one — which is how an audit chain becomes a pile.
   */
  declarationId?: string
  /** How that declaration was matched to the line; undefined when none
   *  covers it or the backend does not say. */
  declarationLink?: "BOUND" | "REFERENCE" | "WINDOW"

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
   * to the reference date. Not measured from the PR, despite the column's name
   * -- except on a PR row (no PO yet), where it runs from the PR date
   * (`EBAN.BADAT`).
   *
   * It keeps counting until SAP closes the line ("Delivery completed"), and the
   * line then leaves the register. The backend serves the same number as
   * `daysElapsed`, and `agingBucket` is the band this falls in.
   */
  daysOpen: number
  agingBucket: AgingBucket

  /**
   * The repair's duration so far: raised to the reference date. The same clock
   * as `daysOpen`.
   *
   * This is what `leadTimeStatus` and `daysOverLeadTime` are computed from.
   * Optional because the mock-data path does not produce it.
   */
  daysElapsed?: number

  /** Days in the CURRENT lifecycle stage, as the backend counts it.
   *
   *  Distinct from `daysOpen`, which runs from the PO line's creation date.
   *  FR-9 asks for aging per stage and this is the figure that answers it:
   *  a line 200 days open but 3 days at the vendor is not the same problem
   *  as one 200 days open and 190 at the vendor. */
  daysInCurrentStage?: number

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

  /**
   * When a closed scenario fixture came back. Never set on a live line: the
   * register serves only lines SAP still has open, and reads no goods receipts.
   */
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
  /** The requisitioner — a CODE, not a name. On a repair PR it is a 5-digit
   *  department code. */
  requester?: string
  /** The department's name for `requester`, when the department list knows
   *  it. Undefined otherwise: the code is shown, never an invented name. */
  requesterName?: string

  /**
   * FR-7 on this line. Undefined when no reason was recorded while it was out
   * and no new purchase overlapped it without one — the Justifications screen
   * was folded into the register on 08-Oct-2026.
   */
  justification?: RepairJustification
  /**
   * The exception-queue items raised against this line.
   *
   * Served with the register line since 18-Oct-2026 (`toRegisterLine`);
   * until then the page loaded the whole exception queue and joined it here.
   * Absent — not an empty array — where they were not read: the Overview, which
   * has no use for them, or a backend older than that. So "no findings" and
   * "could not be checked" stay distinguishable.
   */
  exceptions?: RepairLineException[]
}

/** One exception-queue item, as the register's own column needs it. */
export interface RepairLineException {
  id: string
  /** `MISSING_ATTESTATION`, `UNJUSTIFIED_ACQUISITION`, `OVERDUE_REPAIR`, … */
  type: string
  severity: string
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

/** A new unit requested or bought while the line was out, with no reason
 *  recorded. */
export interface UnjustifiedPurchase {
  /** The `UNJUSTIFIED_ACQUISITION` exception this is. */
  exceptionId: string
  /** The new-buy PR (`type: 'PR'`), or a PO ordered directly with no PR. */
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

/**
 * Which free-text field a coding-candidate line's words came from.
 *
 * Declared here rather than imported from `lib/api/i8`: these domain types
 * stay independent of the wire module, the same way every other type in this
 * file does. A closed union, unlike `verdict` — these are the three fields the
 * FRS names, not a vocabulary the backend may extend.
 *
 * - `PO` — EKPO.TXZ01, purchase order item short text
 * - `PR` — EBAN.TXZ01, requisition item short text (the earlier signal)
 * - `MOVEMENT` — MSEG.SGTXT, goods movement item text
 */
export type CodingCandidateSource = "PO" | "PR" | "MOVEMENT"

/**
 * One document line whose free text mentioned repair (FR-2 coding-candidate
 * screen).
 *
 * Not only a PO line any more: FR-2 names three free-text sources, and the
 * source travels with the line because EBELN/EBELP, BANFN/BNFPO and
 * MBLNR/ZEILE look alike and are opened in different SAP transactions.
 */
export interface CodingCandidateLine {
  source: CodingCandidateSource
  /** EBELN for a PO, BANFN for a PR, MBLNR for a movement. */
  document: string
  /** EBELP, BNFPO or ZEILE. */
  documentItem: string
  plant?: PlantReference
  /** The text the verdict was reached on — served so a cataloguer can check
   *  the call without going back to SAP. */
  shortText: string
  matchedKeywords: string[]
  /** ERDAT on a PO line, BADAT on a requisition, BUDAT on a movement. */
  raisedAt?: string
  /** PSTYP on a PO or PR line. Absent on a movement, which has none. */
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
  /** What the part costs new, one entry per plant in `plants`, from MBEW. */
  newItemPrices: NewItemPrice[]
}

/**
 * What a coding candidate costs new at one plant: MBEW's moving average price
 * (VERPR / PEINH), in ZAR. A missing price is `undefined` with `missing`
 * saying why — never 0, which would read as a free part.
 */
export interface NewItemPrice {
  plant: string
  price?: number
  /** "NEW" when the material is split-valuated at this plant. */
  valuationType?: string
  /** TOKEN_VALUE / NO_NEW_VALUATION / NOT_IN_MBEW, or `undefined` when priced. */
  missing?: string
  /** What MBEW holds on the row read — the placeholder, on TOKEN_VALUE. */
  mbewValue?: number
}

/**
 * One row of the LIVE exception queue (FR-8, FR-9, FR-11).
 *
 * `type` and `severity` are plain strings, not closed unions. The backend
 * DECLARES more exception types than it raises — `MISSING_SESSION_ID` is
 * defined and never raised today — and a type this build has not heard of
 * must still render rather than crash a queue somebody is working. Nothing
 * here may switch exhaustively over either field.
 */
export interface ExceptionQueueRow {
  id: string
  /** `MISSING_ATTESTATION`, `UNJUSTIFIED_ACQUISITION`, or one added later. */
  type: string
  severity: string
  material: MaterialReference
  plant?: PlantReference
  /** The repair, as the register keys it: `{EBELN}-{EBELP}` for a repair PO
   *  line, `PR-{BANFN}-{BNFPO}` for a repair requested on a PR with no PO yet.
   *  For an unjustified acquisition, the repair that was already open when the
   *  new unit was requested or bought. */
  repairLine: string
  /** The register detail key, when the line can be linked at all. */
  repairId?: string
  /** `PO` or `PR` (since 27-Oct-2026 a repair can be a PR with no PO yet).
   *  An older backend always says `PO`. */
  repairLineType?: SAPDocumentReference["type"]
  /** The new-unit purchase, as `{document}-{item}`, on an unjustified
   *  acquisition only. Usually a new-buy PR since 27-Oct-2026; a PO only when
   *  it was ordered directly, with no PR. `acquisitionType` says which. */
  acquisitionLine?: string
  /** `PR` or `PO`. Undefined when there is no purchase on the item. */
  acquisitionType?: SAPDocumentReference["type"]
  /** The reservation line, as `{RSNUM}-{RSPOS}`, on a reservation with no
   *  R-reference (`MISSING_SESSION_ID`) only. */
  reservationLine?: string
  /** The declaration the item is about, on the two declaration-based checks. */
  declarationId?: string
  title: string
  /** Says what is missing AND what was searched for — a finding nobody can
   *  trace to a rule is a finding nobody will act on. */
  detail: string
  /** The repair line's own date, not when the check ran. Every repair line
   *  an item names is open in SAP. */
  raisedAt?: string
  /**
   * The line predates the control, so the gap is explained by when it was
   * raised rather than by anyone failing to act. Render it as a reason, not a
   * violation. Always false while no cutover date is configured, which is the
   * current state (audit §11.5).
   */
  preAutomation: boolean

  // --- FR-11: what people have done about it --------------------------
  //
  // The finding above is recomputed from SAP data on every read. Everything
  // below is stored against its id by the backend, and is the half no check
  // can derive. An item nobody has touched is OPEN and unassigned with an
  // empty history — which is the truth about it, not a placeholder.

  status: ExceptionStatus
  /** Undefined means unassigned, which is a real and common state. */
  owner?: string
  /** Whether a check still raises this. False only for an item looked up by
   *  id after the data moved under it. */
  stillDetected: boolean
  /** Oldest first, the order a history is read in. */
  history: ExceptionEvent[]
}

/**
 * Two since 21-Oct-2026. In progress said what the owner already says, and
 * Resolved behaved exactly like Closed. Who closed an item — a person, or the
 * check no longer finding it — is in its history, not its status.
 */
export type ExceptionStatus = "OPEN" | "CLOSED"

/** One thing that happened to an exception. */
export interface ExceptionEvent {
  id: string
  /** `AUTO_RESOLVED` is kept apart from `STATUS` deliberately: "Priya resolved
   *  this" and "the check stopped finding it" are different claims. */
  kind: "ASSIGNED" | "COMMENT" | "STATUS" | "AUTO_RESOLVED"
  /** The status this entry set; absent on a comment or an assignment. */
  status?: ExceptionStatus
  /** Who the item was assigned to, on an `ASSIGNED` entry. Absent there means
   *  it was unassigned — `kind` tells the two absences apart. */
  owner?: string
  /** `system` on an AUTO_RESOLVED entry. */
  actor: string
  text: string
  /** Already formatted for display. */
  at: string
}

/** The counts the exception queue reports over the whole check, not a page. */
export interface ExceptionQueueSummary {
  /** The business case. */
  total: number
  /** `total` less `preAutomation` — the work.
   *
   *  Both are shown, always: quoting either alone misleads in a different
   *  direction, and this screen's numbers end up in status reports. */
  actionable: number
  preAutomation: number
  byType: Record<string, number>
  bySeverity: Record<string, number>
  linesChecked: number
  linesCovered: number
  /**
   * Which types the backend actually raises, so an empty count reads as "none
   * found" rather than as "not implemented". The two are completely different
   * facts and the screen must not blur them.
   */
  typesRaised: string[]
  /** The ±N-day windows that produced these findings. Rules WE invented, not
   *  ones the FRS states (audit §11.5), so they are shown. */
  attestationWindowDays: number
  justificationWindowDays?: number
  attestationCutoverDate?: string
  acquisitionsChecked?: number
}

/**
 * One row of the LIVE declaration queue (FR-4).
 *
 * Separate from `DeclarationItem` below, and the split is deliberate. That one
 * describes the six hand-written scenario fixtures in `data/declarations.ts`,
 * whose `requester` is a person's name somebody typed. This one describes what
 * the backend actually serves, where `requester` is EKPO's requisitioner CODE
 * and most fields can legitimately be absent.
 *
 * Merging them would mean one optional field per difference and a reader
 * unable to tell which rows are real.
 */
export interface DeclarationQueueRow {
  id: string
  material: MaterialReference
  /** The attestation is recorded per material-PLANT: the same part assessed
   *  at Black Mountain and at Gamsberg is two different records. */
  plant?: PlantReference
  /** EKPO's requisitioner, a CODE rather than a name — no person directory
   *  was delivered, so it is served as what it is. */
  requester?: string
  /** The department's name for `requester`, when the department list knows it. */
  requesterName?: string
  /** The declaration covering this line, when one does: the row then offers
   *  Amend (a new record superseding it), never a second Declare. */
  declarationId?: string
  /** Absent where the repair line carries no requisition number. */
  purchaseRequisition?: string
  /** The repair line this declaration belongs to, as `{document}-{item}`. */
  relatedRepairId: string
  /** The same line, unjoined, for FR-4's link on the declaration form. */
  repairPO?: SAPDocumentReference
  /** The vendor the part went to — its name when known, else its code. */
  vendor?: string
  /** Where the REPAIR stands -- PO Issued or At Vendor: every row is on a
   *  repair SAP still has open. Not `status`, which is the declaration. */
  repairStatus?: RepairStatus
  status: DeclarationStatus
  declaredBy?: string
  declaredAt?: string
  condition?: DeclarationCondition
  nextAction: string
  createdAt?: string
}

/** The counts the declaration queue reports over everything, not over a page. */
export interface DeclarationQueueSummary {
  total: number
  /** Required + Flagged — the rows wanting somebody's attention. */
  outstanding: number
  byStatus: Record<string, number>
  /**
   * The ±N-day window that decided these statuses.
   *
   * Shown on the screen because it is a rule WE invented, not one the FRS
   * states (audit §11.5), and a status nobody can trace to a rule is a status
   * nobody will act on.
   */
  attestationWindowDays: number
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

