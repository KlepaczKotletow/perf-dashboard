import { cn } from "@/lib/utils";
import { Shield, Users, Briefcase, Globe } from "lucide-react";

interface RoleTagProps {
  role: string;
}

const roleConfig: Record<
  string,
  { colors: string; icon: React.ElementType; label: string }
> = {
  admin: {
    colors:
      "bg-red-50 text-red-600 ring-red-200/50 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-800/30",
    icon: Shield,
    label: "Admin",
  },
  hr: {
    colors:
      "bg-purple-50 text-purple-600 ring-purple-200/50 dark:bg-purple-950/40 dark:text-purple-400 dark:ring-purple-800/30",
    icon: Users,
    label: "HR",
  },
  manager: {
    colors:
      "bg-blue-50 text-blue-600 ring-blue-200/50 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-800/30",
    icon: Briefcase,
    label: "Manager",
  },
  all: {
    colors:
      "bg-muted text-muted-foreground ring-border/50 dark:bg-muted dark:text-muted-foreground dark:ring-border/30",
    icon: Globe,
    label: "Everyone",
  },
};

export function RoleTag({ role }: RoleTagProps) {
  const config = roleConfig[role.toLowerCase()] ?? roleConfig.all;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        config.colors
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}
