// W2.6b — which dataset the app renders.
//
//   NEXT_PUBLIC_DATASET=generated npm run dev
//
// "scenario" (the default) uses the hand-written scenario fixtures. They
// encode specific, deliberately-designed demo situations that pages and
// cross-initiative adapters reference BY ID — RC-8002, OAR-LDG-0004, material
// 500-14892 — so they are what makes the prototype demonstrable.
//
// "generated" renders data mapped from SAP-shaped rows through the real
// client, gateway and mappers (`npm run dataset:build`). This is the mode
// that proves the integration end to end.
//
// WHY BOTH STILL EXIST — the finding from W2.6b:
//
// The two datasets cannot simply replace one another yet, because the app and
// SAP do not share identities:
//
//   material   app "500-14892"       vs SAP "000000000080000000"
//   plant      app "PLANT-GBG"       vs SAP "3000"      (5 SAP codes, 3 app plants)
//   user       app "U-007"           vs SAP/platform "VZIREQ01"
//
// Nothing maps between those vocabularies, and no exposed SAP field supplies
// the mapping. Until VZI provides it, switching to "generated" leaves the
// cross-initiative lookups (Material 360, the material router, chat sessions)
// unable to resolve, because they search by app-side identity.
//
// So this flag is not a preference — it is the seam where that reconciliation
// will land. Deleting the scenario fixtures is the last step of W2.6b and it
// is blocked on identity mapping, not on code.

// "live" — Part 21 (I07 frontend/backend integration) — renders data fetched
// from the real FastAPI backend (NEXT_PUBLIC_API_BASE_URL) at request time,
// using real SAP material/plant identities (sap_material_number,
// sap_plant_code) rather than either fixture vocabulary. It does not resolve
// the app<->SAP identity gap above -- Material 360 and other app-identity
// cross-initiative lookups remain unresolvable for live recommendations,
// exactly as they are for "generated", for the same reason.

export type DatasetMode = "scenario" | "generated" | "live"

export const DATASET_MODE: DatasetMode =
  process.env.NEXT_PUBLIC_DATASET === "generated"
    ? "generated"
    : process.env.NEXT_PUBLIC_DATASET === "live"
      ? "live"
      : "scenario"

export const USING_GENERATED_DATA = DATASET_MODE === "generated"
export const USING_LIVE_DATA = DATASET_MODE === "live"
