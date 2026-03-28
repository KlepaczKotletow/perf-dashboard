import Link from "next/link";
import { Clock, ArrowRight, ChevronRight } from "lucide-react";
import { format, isPast } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ActionTask {
  id: string;
  type: "self-review" | "manager-review" | "upward-feedback";
  label: string;
  cycleName: string;
  cycleId: string;
  dueDate: string | null;
  assignmentId: string;
}

interface ActionRequiredSectionProps {
  tasks: ActionTask[];
}

const typeBadgeConfig: Record<
  ActionTask["type"],
  { label: string; className: string }
> = {
  "self-review": {
    label: "Self-Review",
    className:
      "text-violet-700 bg-violet-50 dark:text-violet-400 dark:bg-violet-400/10",
  },
  "manager-review": {
    label: "Manager Review",
    className:
      "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10",
  },
  "upward-feedback": {
    label: "Upward",
    className:
      "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10",
  },
};

function getTaskHref(task: ActionTask): string {
  if (task.type === "manager-review") {
    return `/dashboard/reviews/${task.assignmentId}`;
  }
  return `/dashboard/cycles/${task.cycleId}/review/${task.assignmentId}`;
}

function getTaskCta(type: ActionTask["type"]): {
  text: string;
  icon: typeof ArrowRight;
} {
  switch (type) {
    case "self-review":
      return { text: "Start", icon: ArrowRight };
    case "manager-review":
      return { text: "Review", icon: ChevronRight };
    case "upward-feedback":
      return { text: "Give Feedback", icon: ChevronRight };
  }
}

export function ActionRequiredSection({ tasks }: ActionRequiredSectionProps) {
  if (tasks.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <span className="h-5 w-5 rounded bg-amber-100 dark:bg-amber-400/10 flex items-center justify-center">
          <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
        </span>
        Action Required
        <Badge className="text-[10px] h-4 px-1.5 bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400 font-medium">
          {tasks.length}
        </Badge>
      </h3>

      <div className="rounded-lg border border-border/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">Type</TableHead>
              <TableHead>Task</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="pr-5 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => {
              const badge = typeBadgeConfig[task.type];
              const cta = getTaskCta(task.type);
              const dueDate = task.dueDate ? new Date(task.dueDate) : null;
              const isOverdue = dueDate && isPast(dueDate);

              return (
                <TableRow key={task.id}>
                  <TableCell className="pl-5">
                    <Badge className={`text-[10px] font-medium ${badge.className}`}>
                      {badge.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium text-sm">
                    {task.label}
                  </TableCell>
                  <TableCell>
                    {dueDate ? (
                      <span
                        className={`text-xs ${
                          isOverdue
                            ? "text-red-500 font-semibold"
                            : "text-muted-foreground"
                        }`}
                      >
                        {isOverdue
                          ? `Overdue \u00b7 ${format(dueDate, "MMM d, yyyy")}`
                          : format(dueDate, "MMM d, yyyy")}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    <Button size="sm" className="text-xs h-7" asChild>
                      <Link href={getTaskHref(task)}>
                        {cta.text} <cta.icon className="h-3 w-3 ml-1" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
