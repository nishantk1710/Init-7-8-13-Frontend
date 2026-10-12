import { plantRef } from "@demo/features/initiative-8/data/config"
import type { CodingCandidate } from "@demo/features/initiative-8/types/repair"

/**
 * Coding candidates (FR-2) — deterministic mock data, no model call. Screening
 * timestamps are anchored at 2 Sep 2026.
 *
 * Every row is a material whose free text talks about repair, refurbishment or
 * overhaul while the material itself is NOT 80-series coded. The text comes
 * from all three places the FRS names: purchase requisitions (EBAN.TXZ01),
 * purchase orders (EKPO.TXZ01) and goods movements (MSEG.SGTXT) — and two
 * candidates are found ONLY through PR or movement text, which a PO-only
 * screen would have missed.
 *
 * The verdicts are kept, not recomputed on each visit, so every row carries
 * its reason. The screen is advisory: nothing here writes to SAP.
 *
 * `twins` carries the strongest evidence the screen produces, and it owes
 * nothing to a language model — an 80-series material already carrying the
 * identical text, which shows the naming convention was applied to this exact
 * part elsewhere and not here.
 */

const GBG = plantRef("PLANT-GBG")
const BMM = plantRef("PLANT-BMM")

export const CODING_CANDIDATES: CodingCandidate[] = [
  {
    material: {
      materialId: "200-77410",
      materialCode: "200-77410",
      description: "Gearbox Assy, Bevel Helical — SAG Mill Drive",
    },
    verdict: "MISCODED_REPAIRABLE",
    confidence: "high",
    reason:
      "Purchase orders and a requisition across both plants describe this gearbox being sent out and returned after overhaul. An identical description is already coded 80-series, so the convention exists and was not applied here.",
    lines: [
      { source: "PO", document: "4500881204", item: "10", plant: GBG, shortText: "REPAIR & OVERHAUL GEARBOX ASSY BEVEL HELICAL SAG DRIVE", matchedKeywords: ["REPAIR", "OVERHAUL"], raisedAt: "14 Mar 2026" },
      { source: "PO", document: "4500903817", item: "20", plant: BMM, shortText: "GEARBOX ASSY — RETURN FROM VENDOR REFURBISHMENT", matchedKeywords: ["REFURBISHMENT"], raisedAt: "2 Jun 2026" },
      { source: "PR", document: "0010443120", item: "10", plant: GBG, shortText: "OVERHAUL SAG DRIVE GEARBOX — EXCHANGE UNIT", matchedKeywords: ["OVERHAUL", "EXCHANGE"], raisedAt: "9 Aug 2026" },
    ],
    twins: [{ materialId: "800-14388", sharedText: "GEARBOX ASSY, BEVEL HELICAL — SAG MILL DRIVE" }],
    screenedAt: "2 Sep 2026, 09:14",
  },
  {
    material: {
      materialId: "300-41255",
      materialCode: "300-41255",
      description: "Impeller, Slurry Pump 14/12 — Metal Lined",
    },
    verdict: "MISCODED_REPAIRABLE",
    confidence: "high",
    reason:
      "Purchase text repeatedly refers to re-tipping and rebuilding the same serialised unit, and a 541 moved it into vendor stock for the rebuild. Rebuilding a returned unit is the defining 80-series behaviour.",
    lines: [
      { source: "PO", document: "4500876650", item: "10", plant: BMM, shortText: "RE-TIP AND REBUILD IMPELLER SLURRY PUMP 14/12", matchedKeywords: ["REBUILD"], raisedAt: "28 Jan 2026" },
      { source: "PO", document: "4500919044", item: "10", plant: BMM, shortText: "IMPELLER REBUILD — RETURN SERIAL IMP-14/12-0087", matchedKeywords: ["REBUILD"], raisedAt: "17 Jul 2026" },
      { source: "MOVEMENT", document: "4900179911", item: "1", movementType: "541", plant: BMM, shortText: "IMPELLER TO WEIR FOR RE-TIP", matchedKeywords: ["RE-TIP"], raisedAt: "18 Jul 2026" },
    ],
    twins: [{ materialId: "800-18830", sharedText: "SLURRY PUMP IMPELLER ASSEMBLY" }],
    screenedAt: "2 Sep 2026, 09:16",
  },
  {
    material: {
      materialId: "300-77105",
      materialCode: "300-77105",
      description: "Agitator Shaft Seal Assembly — Leach Tank",
    },
    verdict: "MISCODED_REPAIRABLE",
    confidence: "high",
    reason:
      "Found only in goods-movement text: the seal has twice been moved into vendor stock (541) for refurbishment in four months. A part that goes to a vendor and comes back is repairable, whatever its purchase text says.",
    lines: [
      { source: "MOVEMENT", document: "4900176233", item: "1", movementType: "541", plant: GBG, shortText: "SEAL ASSY TO VENDOR FOR REFURB", matchedKeywords: ["REFURB"], raisedAt: "12 May 2026" },
      { source: "MOVEMENT", document: "4900180460", item: "1", movementType: "541", plant: GBG, shortText: "AGITATOR SEAL — SEND FOR REFURB, RETURN SAME UNIT", matchedKeywords: ["REFURB", "RETURN"], raisedAt: "5 Aug 2026" },
    ],
    twins: [],
    screenedAt: "2 Sep 2026, 09:17",
  },
  {
    material: {
      materialId: "200-55730",
      materialCode: "200-55730",
      description: "Vibrator Motor, Screen Deck 7.5 kW",
    },
    verdict: "MISCODED_REPAIRABLE",
    confidence: "medium",
    reason:
      "Purchase text mentions exchange-unit pricing, which implies a core return, and a movement sent one out for rewind. No 80-series twin carries this description, so the call rests on the free text alone.",
    lines: [
      { source: "PO", document: "4500907210", item: "10", plant: BMM, shortText: "VIBRATOR MOTOR 7.5KW EXCHANGE UNIT — CORE RETURN REQD", matchedKeywords: ["EXCHANGE", "CORE RETURN"], raisedAt: "30 May 2026" },
      { source: "MOVEMENT", document: "4900182015", item: "1", movementType: "541", plant: BMM, shortText: "MOTOR SENT FOR REWIND", matchedKeywords: ["REWIND"], raisedAt: "14 Aug 2026" },
    ],
    twins: [],
    screenedAt: "2 Sep 2026, 09:24",
  },
  {
    material: {
      materialId: "200-48812",
      materialCode: "200-48812",
      description: "Hydraulic Pump, Piston — Loader Steering",
    },
    verdict: "MISCODED_REPAIRABLE",
    confidence: "medium",
    reason:
      "Found only in requisition text: two PRs ask for the same pump to be repaired and returned. The purchase orders that followed say only \"PUMP PISTON 45CC\", so a PO-only screen would never have raised it.",
    lines: [
      { source: "PR", document: "0010439022", item: "10", plant: BMM, shortText: "OVERHAUL STEERING PUMP EX LOADER 7", matchedKeywords: ["OVERHAUL"], raisedAt: "30 Jun 2026" },
      { source: "PR", document: "0010451877", item: "10", plant: BMM, shortText: "REPAIR PISTON PUMP LOADER STEERING — RETURN UNIT", matchedKeywords: ["REPAIR", "RETURN"], raisedAt: "18 Aug 2026" },
    ],
    twins: [],
    screenedAt: "2 Sep 2026, 09:25",
  },
  {
    material: {
      materialId: "200-63118",
      materialCode: "200-63118",
      description: "Hydraulic Cylinder, Apron Feeder Tensioner",
    },
    verdict: "UNCLEAR",
    confidence: "medium",
    reason:
      "One line describes reseal and test of a returned cylinder; the other reads as an outright replacement. Could be a repairable unit or a cheap part bought both ways — a cataloguer should decide.",
    lines: [
      { source: "PO", document: "4500890311", item: "30", plant: BMM, shortText: "RESEAL AND PRESSURE TEST HYD CYLINDER APRON FEEDER", matchedKeywords: ["RESEAL"], raisedAt: "9 Apr 2026" },
      { source: "PO", document: "4500912880", item: "10", plant: BMM, shortText: "HYDRAULIC CYLINDER APRON FEEDER TENSIONER — NEW", matchedKeywords: [], raisedAt: "21 Jun 2026" },
    ],
    twins: [],
    screenedAt: "2 Sep 2026, 09:19",
  },
  {
    material: {
      materialId: "300-12006",
      materialCode: "300-12006",
      description: "Conveyor Pulley, Drive — 1200 mm Lagged",
    },
    verdict: "UNCLEAR",
    confidence: "low",
    reason:
      "A single line mentions re-lagging, which is maintenance of a shell that may or may not be returned. One piece of evidence below the confidence threshold — listed so nobody has to rediscover it, not as a finding.",
    lines: [
      { source: "PO", document: "4500921533", item: "20", plant: GBG, shortText: "DRIVE PULLEY 1200MM RE-LAG CERAMIC", matchedKeywords: ["RE-LAG"], raisedAt: "25 Jul 2026" },
    ],
    twins: [],
    screenedAt: "2 Sep 2026, 09:26",
  },
  {
    material: {
      materialId: "400-90027",
      materialCode: "400-90027",
      description: "Motor Rewind Service — 400 kW and above",
    },
    verdict: "REPAIR_SERVICE",
    confidence: "high",
    reason:
      "A service line, not a part: the text buys labour to rewind a motor the site already owns. Correctly coded as a service today — recoding it 80-series would put a service into the repairable universe.",
    lines: [
      { source: "PO", document: "4500884402", item: "10", plant: GBG, shortText: "MOTOR REWIND SERVICE 630KW INCL BALANCE AND TEST", matchedKeywords: ["REWIND", "SERVICE"], raisedAt: "3 Feb 2026" },
      { source: "PR", document: "0010447301", item: "20", plant: GBG, shortText: "REWIND SERVICE — BALL MILL MOTOR 2", matchedKeywords: ["REWIND", "SERVICE"], raisedAt: "4 Aug 2026" },
    ],
    twins: [],
    screenedAt: "2 Sep 2026, 09:21",
  },
  {
    material: {
      materialId: "100-20884",
      materialCode: "100-20884",
      description: "Seal Kit, Hydraulic Cylinder 125 mm Bore",
    },
    verdict: "CONSUMABLE_FOR_REPAIR",
    confidence: "high",
    reason:
      "Bought to carry out a repair, not itself repairable — the kit is consumed and discarded. The keyword hit comes from the job it is used on, which is exactly the false positive this verdict exists to absorb.",
    lines: [
      { source: "PO", document: "4500890311", item: "40", plant: BMM, shortText: "SEAL KIT FOR CYLINDER REPAIR 125MM BORE", matchedKeywords: ["REPAIR"], raisedAt: "9 Apr 2026" },
    ],
    twins: [],
    screenedAt: "2 Sep 2026, 09:22",
  },
  {
    material: {
      materialId: "100-33019",
      materialCode: "100-33019",
      description: "Wear Plate, Chute — Hardox 450",
    },
    verdict: "CONSUMABLE_FOR_REPAIR",
    confidence: "high",
    reason:
      "The word is in movement text, but the movement is a 201 issue to a cost centre: the plates were fitted during a chute refurbishment and used up. Nothing comes back.",
    lines: [
      { source: "MOVEMENT", document: "4900178802", item: "3", movementType: "201", plant: GBG, shortText: "CHUTE REFURB — WEAR PLATES FITTED", matchedKeywords: ["REFURB"], raisedAt: "22 Jul 2026" },
    ],
    twins: [],
    screenedAt: "2 Sep 2026, 09:27",
  },
]
