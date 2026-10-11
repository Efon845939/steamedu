import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

// Liquid glass buttons. Primary = the theme accent, lit from above, with its own text
// colour (dark text on the 13-15 pink); outline = a clear glass pill. Default height is
// 44px, the touch target minimum. One primary button per view.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-[background-color,border-color,color,filter,transform] duration-press ease-enter active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-[1.1em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "glass-brand hover:brightness-[1.06]",
        destructive: "bg-danger text-on-danger hover:brightness-110",
        outline: "glass text-ink",
        secondary: "bg-neutral-tint text-ink hover:bg-neutral-200",
        ghost: "text-ink hover:bg-surface/55",
        link: "text-brand-ink underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "h-11 px-4",
        sm: "h-9 px-3",
        lg: "h-12 px-6 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props} />
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
