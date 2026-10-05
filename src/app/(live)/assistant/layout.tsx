import { DemoStrip } from "@/components/assistant/demo/demo-strip"
import { ASSISTANT_DEMO } from "@/lib/assistant/demo/flag"

/**
 * Every assistant screen, with the demo line across the top while the demo
 * switch is on. A fragment, so the pages stay direct children of the shell's
 * flex column and keep their own scroll containers.
 */
export default function AssistantLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {ASSISTANT_DEMO && <DemoStrip />}
      {children}
    </>
  )
}
