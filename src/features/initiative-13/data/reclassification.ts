// Seed dataset for the Reclassification Candidates page — OAR materials with
// consumption patterns frequent/predictable enough to warrant review as a
// stocked material by Initiative 7. `500-31005` is mandatory here (Scenario
// I) so the "Review in Initiative 7" link has a real recommendation to land
// on — see `pages/reclassification-page.tsx`.

import type { ReclassificationCandidate } from "@/features/initiative-13/types/oar"
import { materialRef } from "@/features/initiative-13/data/materials"

export const RECLASSIFICATION_CANDIDATES: ReclassificationCandidate[] = [
  {
    id: "RCL-0001",
    material: materialRef("500-31005"),
    consumptionFrequency: "Monthly",
    annualRequests: 14,
    annualIssues: 13,
    sites: 3,
    utilizationRate: 93,
    recommendation: "Candidate for Stocked Material Review — high, predictable demand across sites",
  },
  {
    id: "RCL-0002",
    material: materialRef("500-14892"),
    consumptionFrequency: "Bi-monthly",
    annualRequests: 9,
    annualIssues: 8,
    sites: 2,
    utilizationRate: 89,
    recommendation: "Candidate for Stocked Material Review — consistent demand, short lead time risk",
  },
  {
    id: "RCL-0003",
    material: materialRef("500-55210"),
    consumptionFrequency: "Quarterly",
    annualRequests: 4,
    annualIssues: 4,
    sites: 2,
    utilizationRate: 100,
    recommendation: "Candidate for Stocked Material Review — 100% utilization on every request",
  },
  {
    id: "RCL-0004",
    material: materialRef("500-08823"),
    consumptionFrequency: "Quarterly",
    annualRequests: 5,
    annualIssues: 4,
    sites: 2,
    utilizationRate: 80,
    recommendation: "Monitor — below reclassification threshold this cycle",
  },
  {
    id: "RCL-0005",
    material: materialRef("500-19560"),
    consumptionFrequency: "Ad hoc",
    annualRequests: 3,
    annualIssues: 2,
    sites: 1,
    utilizationRate: 66,
    recommendation: "Retain as OAR — infrequent, plant-specific demand",
  },
]
