import { Info, AlertTriangle, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalloutProps {
  type?: "info" | "warning" | "tip";
  children: React.ReactNode;
}

const config = {
  info: {
    icon: Info,
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-800",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-800",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  tip: {
    icon: Lightbulb,
    bg: "bg-green-50 dark:bg-green-950/40",
    border: "border-green-200 dark:border-green-800",
    iconColor: "text-green-600 dark:text-green-400",
  },
};

export function Callout({ type = "info", children }: CalloutProps) {
  const { icon: Icon, bg, border, iconColor } = config[type];

  return (
    <div
      className={cn(
        "my-4 flex gap-3 rounded-lg border p-4",
        bg,
        border
      )}
    >
      <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", iconColor)} />
      <div className="text-sm leading-relaxed [&>p]:m-0">{children}</div>
    </div>
  );
}
