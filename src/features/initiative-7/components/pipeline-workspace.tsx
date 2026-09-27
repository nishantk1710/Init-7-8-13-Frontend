"use client"

import { LivePipelineWorkspace } from "@/features/initiative-7/components/live-pipeline-workspace"

/** Pipeline Age Check for the live route tree — always renders the live,
 * backend-backed workspace. Mock/scenario rendering lives only in the
 * separate demo route tree (src/demo/features/initiative-7/...). */
export function PipelineWorkspace() {
  return <LivePipelineWorkspace />
}
