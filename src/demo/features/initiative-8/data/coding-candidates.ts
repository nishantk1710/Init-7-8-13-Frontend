import type { CodingCandidate } from "@demo/features/initiative-8/types/repair"

/**
 * Deterministic mock data — no live SAP connection, no model call. Screening
 * timestamps are anchored at 2 Sep 2026.
 *
 * Every row is a material whose purchase-order free text talks about repair,
 * refurbishment or overhaul while the material itself is NOT 80-series coded.
 * The screen is advisory: nothing here writes to SAP or recodes a material.
 *
 * `twins` carries the strongest evidence the screen produces, and it owes
 * nothing to a language model — an 80-series material already carrying the
 * identical description, which shows the naming convention was applied to this
 * exact text elsewhere and not here. A candidate with a twin is
 * `isCorroborated`.
 *
 * The verdicts deliberately span the full vocabulary, so the demo shows the
 * screen rejecting its own candidates as well as raising them:
 * `REPAIR_SERVICE` (a service line, not a part) and `CONSUMABLE_FOR_REPAIR`
 * (a part consumed during a repair) are both correctly coded today.
 */
/** Who screened the fixtures — the banner's "Screened by …" line. */
export const CODING_SCREEN = { provider: "foundry", model: "gpt-4o" }

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
      "Six purchase orders across two plants describe this part being sent out and returned after overhaul. An identical description is already coded 800-14201, so the convention exists and was not applied here.",
    plants: ["Gamsberg", "Black Mountain Mining"],
    lines: [
      {
        purchasingDocument: "4500881204",
        item: "10",
        plant: { plantId: "PLANT-GBG", name: "Gamsberg" },
        shortText: "REPAIR & OVERHAUL GEARBOX ASSY BEVEL HELICAL SAG DRIVE",
        matchedKeywords: ["REPAIR", "OVERHAUL"],
        raisedAt: "14 Mar 2026",
      },
      {
        purchasingDocument: "4500903817",
        item: "20",
        plant: { plantId: "PLANT-BMM", name: "Black Mountain Mining" },
        shortText: "GEARBOX ASSY — RETURN FROM VENDOR REFURBISHMENT",
        matchedKeywords: ["REFURBISHMENT"],
        raisedAt: "2 Jun 2026",
      },
    ],
    twins: [
      {
        materialId: "800-14201",
        sharedText: "GEARBOX ASSY, BEVEL HELICAL — SAG MILL DRIVE",
      },
    ],
    isCorroborated: true,
    isActionable: true,
    meetsConfidenceThreshold: true,
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
      "Purchase text repeatedly refers to re-tipping and rebuild of the same serialised unit, not to a replacement part. Rebuild of a returned unit is the defining 80-series behaviour.",
    plants: ["Black Mountain Mining"],
    lines: [
      {
        purchasingDocument: "4500876650",
        item: "10",
        plant: { plantId: "PLANT-BMM", name: "Black Mountain Mining" },
        shortText: "RE-TIP AND REBUILD IMPELLER SLURRY PUMP 14/12",
        matchedKeywords: ["REBUILD"],
        raisedAt: "28 Jan 2026",
      },
      {
        purchasingDocument: "4500919044",
        item: "10",
        plant: { plantId: "PLANT-BMM", name: "Black Mountain Mining" },
        shortText: "IMPELLER REBUILD — RETURN SERIAL IMP-14/12-0087",
        matchedKeywords: ["REBUILD"],
        raisedAt: "17 Jul 2026",
      },
    ],
    twins: [
      {
        materialId: "800-18830",
        sharedText: "SLURRY PUMP IMPELLER ASSEMBLY",
      },
    ],
    isCorroborated: true,
    isActionable: true,
    meetsConfidenceThreshold: true,
    screenedAt: "2 Sep 2026, 09:16",
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
      "Two of four lines describe reseal and test of a returned cylinder; the other two read as outright replacement purchases. Could be a repairable unit or a cheap consumable bought both ways — a cataloguer should decide.",
    plants: ["Skorpion Zinc"],
    lines: [
      {
        purchasingDocument: "4500890311",
        item: "30",
        plant: { plantId: "PLANT-SKZ", name: "Skorpion Zinc" },
        shortText: "RESEAL AND PRESSURE TEST HYD CYLINDER APRON FEEDER",
        matchedKeywords: ["RESEAL"],
        raisedAt: "9 Apr 2026",
      },
      {
        purchasingDocument: "4500912880",
        item: "10",
        plant: { plantId: "PLANT-SKZ", name: "Skorpion Zinc" },
        shortText: "HYDRAULIC CYLINDER APRON FEEDER TENSIONER — NEW",
        matchedKeywords: [],
        raisedAt: "21 Jun 2026",
      },
    ],
    twins: [],
    isCorroborated: false,
    isActionable: true,
    meetsConfidenceThreshold: true,
    screenedAt: "2 Sep 2026, 09:19",
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
    plants: ["Gamsberg", "Skorpion Zinc"],
    lines: [
      {
        purchasingDocument: "4500884402",
        item: "10",
        plant: { plantId: "PLANT-GBG", name: "Gamsberg" },
        shortText: "MOTOR REWIND SERVICE 630KW INCL BALANCE AND TEST",
        matchedKeywords: ["REWIND", "SERVICE"],
        raisedAt: "3 Feb 2026",
      },
    ],
    twins: [],
    isCorroborated: false,
    isActionable: false,
    meetsConfidenceThreshold: true,
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
    plants: ["Skorpion Zinc"],
    lines: [
      {
        purchasingDocument: "4500890311",
        item: "40",
        plant: { plantId: "PLANT-SKZ", name: "Skorpion Zinc" },
        shortText: "SEAL KIT FOR CYLINDER REPAIR 125MM BORE",
        matchedKeywords: ["REPAIR"],
        raisedAt: "9 Apr 2026",
      },
    ],
    twins: [],
    isCorroborated: false,
    isActionable: false,
    meetsConfidenceThreshold: true,
    screenedAt: "2 Sep 2026, 09:22",
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
      "Text mentions exchange-unit pricing, which implies a core return. No 80-series twin carries this description, so the call rests on the free text alone.",
    plants: ["Skorpion Zinc"],
    lines: [
      {
        purchasingDocument: "4500907210",
        item: "10",
        plant: { plantId: "PLANT-SKZ", name: "Skorpion Zinc" },
        shortText: "VIBRATOR MOTOR 7.5KW EXCHANGE UNIT — CORE RETURN REQD",
        matchedKeywords: ["EXCHANGE", "CORE RETURN"],
        raisedAt: "30 May 2026",
      },
    ],
    twins: [],
    isCorroborated: false,
    isActionable: true,
    meetsConfidenceThreshold: true,
    screenedAt: "2 Sep 2026, 09:24",
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
    plants: ["Gamsberg"],
    lines: [
      {
        purchasingDocument: "4500921533",
        item: "20",
        plant: { plantId: "PLANT-GBG", name: "Gamsberg" },
        shortText: "DRIVE PULLEY 1200MM RE-LAG CERAMIC",
        matchedKeywords: ["RE-LAG"],
        raisedAt: "25 Jul 2026",
      },
    ],
    twins: [],
    isCorroborated: false,
    isActionable: true,
    meetsConfidenceThreshold: false,
    screenedAt: "2 Sep 2026, 09:26",
  },
]
