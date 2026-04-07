import { Badge } from "@/components/ui/badge";

interface SectionHeaderProps {
  title: string;
  action?: React.ReactNode;
  count?: number;
}

export function SectionHeader({ title, action, count }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground tracking-wide border-l-2 border-primary/40 pl-3">
          {title}
        </h2>
        {count !== undefined && (
          <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-medium">
            {count}
          </Badge>
        )}
      </div>
      {action}
    </div>
  );
}
