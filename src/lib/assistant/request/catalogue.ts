/**
 * The multi-material request's demo materials -- one per case the screen has to
 * handle, for both initiatives. **Mock data only.**
 *
 * Every number here is invented to land a material in one specific case (the
 * `scenario` line says which); none of it is read from SAP. The suggestion and
 * window arithmetic in `suggest.ts` runs on these facts exactly as it would on
 * a WATCH row, so changing a number here changes what the screen suggests.
 */

/** What the router would decide for a material at a plant. */
export type RequestRouting =
  | { kind: "i13"; facts: OarFacts }
  | { kind: "i08"; facts: RepairableFacts; alsoMatchedOar: boolean }
  /** In the catalogue, but no assistant session is needed (a consumable). */
  | { kind: "out_of_scope"; reason: string }
  /** OAR by MRP type, but WATCH has no row for it -- live returns a 422. */
  | { kind: "data_gap"; reason: string }

export type OarFacts = {
  stockOnHand: number
  openPoQuantity: number
  /** Per month, over the last 12 months. */
  averageMonthlyConsumption: number
  consumptionCount12m: number
  daysSinceLastMovement: number | null
  crossPlantStock: { plant: string; stockOnHand: number }[]
}

export type RepairableFacts = {
  /** Repaired units sitting in stock at this plant. */
  stockOnHand: number
  openRepairs: {
    purchasingDocument: string
    quantity: number
    dueDate: string
    daysOverdue: number
    vendorName: string
  }[]
  newUnitLeadTimeDays: number
}

export type DemoRequestMaterial = {
  materialId: string
  plant: string
  plantName: string
  description: string
  /** One line for the tester: the case this material exercises. */
  scenario: string
  routing: RequestRouting
}

const BMM = "Black Mountain Mining"
const GAMSBERG = "Gamsberg"

export const REQUEST_CATALOGUE: readonly DemoRequestMaterial[] = [
  // --- OAR (I13) -------------------------------------------------------------
  {
    materialId: "1000000123",
    plant: "1300",
    plantName: BMM,
    description: "Seal kit, mill gearbox",
    scenario: "OAR · normal suggestion (suggests 4)",
    routing: {
      kind: "i13",
      facts: {
        stockOnHand: 2,
        openPoQuantity: 0,
        averageMonthlyConsumption: 0.5,
        consumptionCount12m: 6,
        daysSinceLastMovement: 41,
        crossPlantStock: [{ plant: "1500", stockOnHand: 1 }],
      },
    },
  },
  {
    materialId: "1000000934",
    plant: "1500",
    plantName: GAMSBERG,
    description: "Hydraulic hose assembly, 1in",
    scenario: "OAR · open PO lowers the suggestion (suggests 5)",
    routing: {
      kind: "i13",
      facts: {
        stockOnHand: 1,
        openPoQuantity: 3,
        averageMonthlyConsumption: 0.75,
        consumptionCount12m: 9,
        daysSinceLastMovement: 12,
        crossPlantStock: [],
      },
    },
  },
  {
    materialId: "1000000456",
    plant: "1300",
    plantName: BMM,
    description: "Bearing, spherical roller 22320",
    scenario: "OAR · stock already covers 12 months (suggests 0)",
    routing: {
      kind: "i13",
      facts: {
        stockOnHand: 30,
        openPoQuantity: 0,
        averageMonthlyConsumption: 1.5,
        consumptionCount12m: 18,
        daysSinceLastMovement: 9,
        crossPlantStock: [{ plant: "1500", stockOnHand: 6 }],
      },
    },
  },
  {
    materialId: "1000000789",
    plant: "1500",
    plantName: GAMSBERG,
    description: "Coupling insert, flexible",
    scenario: "OAR · too little history to suggest (2 issues in 12 months)",
    routing: {
      kind: "i13",
      facts: {
        stockOnHand: 0,
        openPoQuantity: 0,
        averageMonthlyConsumption: 0.17,
        consumptionCount12m: 2,
        daysSinceLastMovement: 160,
        crossPlantStock: [],
      },
    },
  },
  {
    materialId: "1000000812",
    plant: "1300",
    plantName: BMM,
    description: "V-belt set, SPC 3350",
    scenario: "OAR · never consumed in 12 months (no rate)",
    routing: {
      kind: "i13",
      facts: {
        stockOnHand: 4,
        openPoQuantity: 0,
        averageMonthlyConsumption: 0,
        consumptionCount12m: 0,
        daysSinceLastMovement: 443,
        crossPlantStock: [],
      },
    },
  },
  {
    materialId: "1000001001",
    plant: "1300",
    plantName: BMM,
    description: "Liner plate, ball mill shell",
    scenario: "OAR · no WATCH data, cannot be assessed",
    routing: {
      kind: "data_gap",
      reason:
        "This OAR part has no consumption record on the platform yet, so its stock and " +
        "cover cannot be assessed. Reserve it as usual; no session is opened for it.",
    },
  },

  // --- Repairable (I08) ------------------------------------------------------
  {
    materialId: "8000005632",
    plant: "1300",
    plantName: BMM,
    description: "Pump, centrifugal",
    scenario: "Repairable · repair overdue by 61 days",
    routing: {
      kind: "i08",
      alsoMatchedOar: false,
      facts: {
        stockOnHand: 0,
        openRepairs: [
          {
            purchasingDocument: "4500001234",
            quantity: 1,
            dueDate: "2026-08-15",
            daysOverdue: 61,
            vendorName: "Acme Rotating",
          },
        ],
        newUnitLeadTimeDays: 30,
      },
    },
  },
  {
    materialId: "8000006120",
    plant: "1300",
    plantName: BMM,
    description: "Motor, 75 kW 4-pole",
    scenario: "Repairable · repaired unit in stock",
    routing: {
      kind: "i08",
      alsoMatchedOar: false,
      facts: { stockOnHand: 1, openRepairs: [], newUnitLeadTimeDays: 45 },
    },
  },
  {
    materialId: "8000006344",
    plant: "1500",
    plantName: GAMSBERG,
    description: "Valve actuator, pneumatic",
    scenario: "Repairable · repair on time, back in 12 days",
    routing: {
      kind: "i08",
      alsoMatchedOar: false,
      facts: {
        stockOnHand: 0,
        openRepairs: [
          {
            purchasingDocument: "4500002210",
            quantity: 1,
            dueDate: "2026-10-27",
            daysOverdue: 0,
            vendorName: "Valvetech SA",
          },
        ],
        newUnitLeadTimeDays: 60,
      },
    },
  },
  {
    materialId: "8000006590",
    plant: "1500",
    plantName: GAMSBERG,
    description: "Impeller, slurry pump",
    scenario: "Repairable · no unit anywhere (nothing to decide)",
    routing: {
      kind: "i08",
      alsoMatchedOar: false,
      facts: { stockOnHand: 0, openRepairs: [], newUnitLeadTimeDays: 30 },
    },
  },
  {
    materialId: "8000007781",
    plant: "1300",
    plantName: BMM,
    description: "Gearbox, flotation drive",
    scenario: "80-series and OAR · repairable wins",
    routing: {
      kind: "i08",
      alsoMatchedOar: true,
      facts: {
        stockOnHand: 0,
        openRepairs: [
          {
            purchasingDocument: "4500003001",
            quantity: 2,
            dueDate: "2026-09-30",
            daysOverdue: 15,
            vendorName: "DriveServ",
          },
        ],
        newUnitLeadTimeDays: 120,
      },
    },
  },

  // --- Neither ---------------------------------------------------------------
  {
    materialId: "3000001122",
    plant: "1300",
    plantName: BMM,
    description: "Grease, lithium EP2 18kg",
    scenario: "Consumable · no session needed",
    routing: {
      kind: "out_of_scope",
      reason: "A consumable: neither repairable (80-series) nor OAR, so the assistant has nothing to check.",
    },
  },
]

export const DEMO_PLANTS = [
  { plant: "1300", plantName: BMM },
  { plant: "1500", plantName: GAMSBERG },
] as const

function bareNumber(materialId: string): string {
  return materialId.trim().replace(/^0+/, "")
}

/** The catalogue entry for a material at a plant, if there is one. */
export function findDemoMaterial(materialId: string, plant: string): DemoRequestMaterial | undefined {
  const id = bareNumber(materialId)
  return REQUEST_CATALOGUE.find((m) => m.materialId === id && m.plant === plant.trim())
}

/** Number prefix, or every word of the name -- as the live search does. */
export function searchRequestCatalogue(raw: string): DemoRequestMaterial[] {
  const text = raw.trim()
  if (text.length < 2) return []
  const compact = text.replace(/[\s-]/g, "")
  if (/^\d+$/.test(compact)) {
    const prefix = compact.replace(/^0+/, "")
    return prefix ? REQUEST_CATALOGUE.filter((m) => m.materialId.startsWith(prefix)) : []
  }
  const words = (text.toUpperCase().match(/[A-Z0-9]+/g) ?? []).filter((w) => w.length >= 2)
  return REQUEST_CATALOGUE.filter((m) => {
    const haystack = `${m.description} ${m.materialId}`.toUpperCase()
    return words.length > 0 && words.every((w) => haystack.includes(w))
  })
}
