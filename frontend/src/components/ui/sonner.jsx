import { Toaster as Sonner, toast } from "sonner"
import { useDisplay } from "@/lib/theme"

// Toasts follow the account theme and mode. Status colour comes from the icon and a
// hairline, never a filled coloured toast.
const Toaster = ({
  ...props
}) => {
  const { resolved } = useDisplay()

  return (
    <Sonner
      theme={resolved.dark ? "dark" : "light"}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast font-sans group-[.toaster]:bg-surface group-[.toaster]:text-ink group-[.toaster]:border-rule group-[.toaster]:shadow-float group-[.toaster]:rounded-xl",
          description: "group-[.toast]:text-ink-muted",
          actionButton:
            "group-[.toast]:bg-brand group-[.toast]:text-on-brand",
          cancelButton:
            "group-[.toast]:bg-neutral-tint group-[.toast]:text-ink-muted",
          success: "[&_[data-icon]]:text-success",
          error: "[&_[data-icon]]:text-danger",
          warning: "[&_[data-icon]]:text-warning",
          info: "[&_[data-icon]]:text-info",
        },
      }}
      {...props} />
  );
}

export { Toaster, toast }
