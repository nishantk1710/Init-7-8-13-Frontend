import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ChatWorkspace } from "@/components/chat/chat-workspace"
import { createDraftSession, getMaterialById } from "@/lib/mock-data"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ materialId: string }>
}): Promise<Metadata> {
  const { materialId } = await params
  const material = getMaterialById(materialId)

  return {
    title: material
      ? `${material.description} — Spares AI`
      : "Material not found — Spares AI",
  }
}

export default async function NewMaterialSessionPage({
  params,
}: {
  params: Promise<{ materialId: string }>
}) {
  const { materialId } = await params
  const material = getMaterialById(materialId)

  if (!material) {
    notFound()
  }

  const session = createDraftSession(material)

  return <ChatWorkspace key={session.id} session={session} />
}
