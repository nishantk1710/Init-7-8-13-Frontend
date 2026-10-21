import type { Metadata } from "next"

// Shared with the live tree: the sign-in is the same in both data modes.
import { ProfileView } from "@/components/auth/profile-view"

export const metadata: Metadata = {
  title: "My profile — Spares AI",
}

export default function ProfilePage() {
  return <ProfileView />
}
