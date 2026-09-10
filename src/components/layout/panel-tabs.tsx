import { TabsList, TabsTrigger } from "@/components/ui/tabs"

export function PanelTabs() {
  return (
    <TabsList
      variant="line"
      className="h-auto w-full justify-start gap-3 rounded-none border-b border-border bg-muted/40 px-3 py-0"
    >
      <TabsTrigger value="workflow" className="px-0 py-2.5">
        Workflow
      </TabsTrigger>
      <TabsTrigger value="emails" className="px-0 py-2.5">
        Emails
      </TabsTrigger>
      <TabsTrigger value="trace" className="px-0 py-2.5">
        Trace
      </TabsTrigger>
    </TabsList>
  )
}
