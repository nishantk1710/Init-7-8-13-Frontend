/**
 * Whether the multi-material request screens are offered (menu entry,
 * landing-page link). Build-time, like every `NEXT_PUBLIC_*`.
 *
 *   NEXT_PUBLIC_ASSISTANT_REQUESTS=true   offered, against the live backend
 *   NEXT_PUBLIC_ASSISTANT_DEMO=true       offered, on the mock catalogue
 *
 * Switch it on together with the backend's ASSISTANT_REQUESTS_ENABLED: the
 * routes answer 404 until then, and the screens say so rather than failing.
 */
import { ASSISTANT_DEMO } from "@/lib/assistant/demo/flag"

export const ASSISTANT_REQUESTS =
  ASSISTANT_DEMO || process.env.NEXT_PUBLIC_ASSISTANT_REQUESTS === "true"
