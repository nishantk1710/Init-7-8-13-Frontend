import { cn } from "@/lib/utils"
import { formatZAR } from "@/lib/utils"

type PriceTone = "default" | "success" | "danger"

const TONE_CLASSES: Record<PriceTone, string> = {
  default: "text-foreground",
  success: "text-success",
  danger: "text-destructive",
}

export function PriceDisplay({
  amount,
  tone = "default",
  size = "sm",
  className,
}: {
  amount: number
  tone?: PriceTone
  size?: "sm" | "lg"
  className?: string
}) {
  return (
    <span
      className={cn(
        "font-semibold tabular-nums",
        size === "lg" ? "text-base" : "text-sm",
        TONE_CLASSES[tone],
        className
      )}
    >
      {formatZAR(amount)}
    </span>
  )
}
