import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "outline" | "secondary";
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: EmptyStateAction[];
}

export function EmptyState({ icon: Icon, title, description, actions }: EmptyStateProps) {
  return (
    <Card className="border-border/60">
      <CardContent className="py-16 flex flex-col items-center text-center">
        <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">{title}</p>
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
        {actions && actions.length > 0 && (
          <div className="flex items-center gap-2 mt-5">
            {actions.map((action) =>
              action.href ? (
                <Button key={action.label} size="sm" variant={action.variant || "default"} asChild>
                  <Link href={action.href}>{action.label}</Link>
                </Button>
              ) : (
                <Button key={action.label} size="sm" variant={action.variant || "default"} onClick={action.onClick}>
                  {action.label}
                </Button>
              )
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
