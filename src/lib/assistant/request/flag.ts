/**
 * Whether the multi-material request screens are offered (menu entry,
 * landing-page link). Build-time, like every `NEXT_PUBLIC_*`.
 *
 *   NEXT_PUBLIC_ASSISTANT_REQUESTS=true   offered, against the live backend
 *
 * Switch it on together with the backend's ASSISTANT_REQUESTS_ENABLED: the
 * routes answer 404 until then, and the screens say so rather than failing.
 */
export const ASSISTANT_REQUESTS = process.env.NEXT_PUBLIC_ASSISTANT_REQUESTS === "true"

/**
 * One flow for one material or many (UAT, 21 Oct): with requests on, a single
 * material is a request with one line -- the landing page, the opener and the
 * SAP BAdI link (`/assistant/new?material=…&plant=…`) all go to the request
 * screen, and the requester types one `R…` into SAP.
 *
 *   NEXT_PUBLIC_ASSISTANT_CHAT=true   brings the step-by-step chat back for a
 *                                     single material (the fallback)
 *
 * Sessions opened in the chat before the switch stay readable and keep linking.
 */
export const ASSISTANT_CHAT = process.env.NEXT_PUBLIC_ASSISTANT_CHAT === "true"

export const SINGLE_AS_REQUEST = ASSISTANT_REQUESTS && !ASSISTANT_CHAT
