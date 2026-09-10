"use client"

import { PanelTabs } from "@/components/layout/panel-tabs"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { ApprovalStepper } from "@/components/workflow/approval-stepper"
import { EmailTracker } from "@/components/workflow/email-tracker"
import { TraceabilityLog } from "@/components/workflow/traceability-log"
import type {
  EmailNotificationData,
  TraceInfo,
  WorkflowStepData,
} from "@/lib/types"

export function RightPanel({
  workflow,
  emails,
  trace,
  activeTab,
  onTabChange,
}: {
  workflow: WorkflowStepData[]
  emails: EmailNotificationData[]
  trace: TraceInfo
  activeTab: string
  onTabChange: (value: string) => void
}) {
  return (
    <aside className="flex w-[260px] shrink-0 flex-col overflow-y-auto border-l border-border bg-card">
      <Tabs value={activeTab} onValueChange={onTabChange} className="flex-1">
        <PanelTabs />
        <TabsContent value="workflow">
          <ApprovalStepper steps={workflow} />
        </TabsContent>
        <TabsContent value="emails">
          <EmailTracker items={emails} />
        </TabsContent>
        <TabsContent value="trace">
          <TraceabilityLog trace={trace} />
        </TabsContent>
      </Tabs>
    </aside>
  )
}
