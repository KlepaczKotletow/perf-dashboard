import { Info, AlertTriangle, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalloutProps {
  type?: "info" | "warning" | "tip";
  children: React.ReactNode;
}

const config = {
  info: {
    icon: Info,
    bg: "bg-blue-50/80 dark:bg-blue-950/30",
    border: "border-blue-200/60 dark:border-blue-800/40",
    iconColor: "text-blue-500 dark:text-blue-400",
    label: "Info",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-amber-50/80 dark:bg-amber-950/30",
    border: "border-amber-200/60 dark:border-amber-800/40",
    iconColor: "text-amber-500 dark:text-amber-400",
    label: "Warning",
  },
  tip: {
    icon: Lightbulb,
    bg: "bg-emerald-50/80 dark:bg-emerald-950/30",
    border: "border-emerald-200/60 dark:border-emerald-800/40",
    iconColor: "text-emerald-500 dark:text-emerald-400",
    label: "Tip",
  },
};

export function Callout({ type = "info", children }: CalloutProps) {
  const { icon: Icon, bg, border, iconColor, label } = config[type];

  return (
    <div
      className={cn(
        "my-6 flex gap-3 rounded-xl border p-4",
        bg,
        border
      )}
    >
      <div className="flex flex-col items-center gap-1 shrink-0">
        <Icon className={cn("h-4.5 w-4.5", iconColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-[11px] font-semibold uppercase tracking-wider mb-1", iconColor)}>
          {label}
        </p>
        <div className="text-sm leading-relaxed text-muted-foreground [&>p]:mb-1 [&>p:last-child]:mb-0">
          {children}
        </div>
      </div>
    </div>
  );
}
