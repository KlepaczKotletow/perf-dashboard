import Link from "next/link";
import { reviewHref } from "@/lib/review-links";
import { ArrowRight, ChevronRight } from "lucide-react";
import { format, isPast } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
    className: "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10",
  },
  "upward-feedback": {
    label: "Upward",
    className:
      "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10",
  },
};

// Every task type goes to the same place now. This function used to fork on
// `manager-review`, sending manager reviews to /dashboard/reviews/[id] and self
// and upward reviews to the cycles route — two different forms, two different
// draft stores. A reviewer who started from Team Overview and came back via
// Home was handed the other form, and their draft was gone.
function getTaskHref(task: ActionTask): string {
  return reviewHref(task.assignmentId);
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

/**
 * Flat row list — no Table chrome.
 * Small uppercase label above, one padded row per task with divider between.
 */
export function ActionRequiredSection({ tasks }: ActionRequiredSectionProps) {
  if (tasks.length === 0) return null;

  return (
    <section className="space-y-2">
      <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
        Pending · {tasks.length}
      </p>

      <div className="rounded-lg border border-border/60 bg-card divide-y divide-border/60 overflow-hidden">
        {tasks.map((task) => {
          const badge = typeBadgeConfig[task.type];
          const cta = getTaskCta(task.type);
          const dueDate = task.dueDate ? new Date(task.dueDate) : null;
          const isOverdue = !!dueDate && isPast(dueDate);

          return (
            <div
              key={task.id}
              className="flex items-center gap-3 px-4 py-3"
            >
              <Badge
                className={`text-[10px] font-medium shrink-0 ${badge.className}`}
              >
                {badge.label}
              </Badge>

              <span className="text-sm font-medium text-foreground flex-1 min-w-0 truncate">
                {task.label}
              </span>

              {dueDate && (
                <span
                  className={`text-xs shrink-0 ${
                    isOverdue
                      ? "text-red-600 dark:text-red-400 font-semibold"
                      : "text-muted-foreground"
                  }`}
                >
                  {isOverdue
                    ? `Overdue ${format(dueDate, "MMM d")}`
                    : `Due ${format(dueDate, "MMM d")}`}
                </span>
              )}

              <Button size="sm" className="text-xs h-7 shrink-0" asChild>
                <Link href={getTaskHref(task)}>
                  {cta.text} <cta.icon className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
