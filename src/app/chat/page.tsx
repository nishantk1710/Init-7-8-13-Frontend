import { redirect } from "next/navigation"

import { DEFAULT_SESSION_ID } from "@/lib/constants"

export default function ChatIndexPage() {
  redirect(`/chat/${DEFAULT_SESSION_ID}`)
}
