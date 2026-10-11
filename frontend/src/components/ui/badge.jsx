import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-brand-tint text-ink",
        secondary: "border-transparent bg-neutral-tint text-ink",
        destructive: "border-danger-rule bg-danger-tint text-danger",
        outline: "border-rule-strong text-ink",
        success: "border-success-rule bg-success-tint text-success",
        warning: "border-warning-rule bg-warning-tint text-warning",
        info: "border-info-rule bg-info-tint text-info",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }
