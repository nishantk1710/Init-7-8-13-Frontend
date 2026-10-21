import type { Metadata } from "next"

import { SparesHome } from "@/components/home/spares-home"

export const metadata: Metadata = {
  title: "Home — Spares AI",
}

export default function Page() {
  return <SparesHome />
}
