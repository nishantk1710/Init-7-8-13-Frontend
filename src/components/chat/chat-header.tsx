import { EllipsisVertical } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ChatHeader({
  title,
  sessionId,
}: {
  title: string
  sessionId: string
}) {
  return (
    <div className="flex items-center gap-2.5 border-b border-border bg-muted/40 px-4 py-3">
      <span
        className="size-2 shrink-0 rounded-full bg-success"
        aria-label="AI online"
      />
      <h4 className="text-sm font-medium text-foreground">{title}</h4>
      <span className="ml-auto text-xs text-muted-foreground">
        Session #{sessionId}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground">
          <EllipsisVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>Rename session</DropdownMenuItem>
          <DropdownMenuItem>Export transcript</DropdownMenuItem>
          <DropdownMenuItem variant="destructive">
            Archive session
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
