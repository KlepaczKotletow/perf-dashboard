import { cn } from "@/lib/utils";

interface RoleTagProps {
  role: string;
}

const roleColors: Record<string, string> = {
  admin: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
  hr: "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400",
  manager: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
  all: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
};

export function RoleTag({ role }: RoleTagProps) {
  const colors = roleColors[role.toLowerCase()] ?? roleColors.all;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        colors
      )}
    >
      {role}
    </span>
  );
}
