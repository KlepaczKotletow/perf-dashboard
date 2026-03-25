import { Check } from "lucide-react";
import { format, isPast } from "date-fns";

interface Step {
  label: string;
  done: boolean;
  active?: boolean;
  deadline: string | null;
}

interface ProgressStepperProps {
  steps: Step[];
}

export function ProgressStepper({ steps }: ProgressStepperProps) {
  if (steps.length === 0) return null;

  return (
    <div className="flex items-start w-full">
      {steps.map((step, idx) => {
        const isActive =
          step.active ||
          (!step.done && (idx === 0 || steps[idx - 1].done));
        const deadlineDate = step.deadline ? new Date(step.deadline) : null;
        const isOverdue = deadlineDate && isPast(deadlineDate) && !step.done;

        return (
          <div key={step.label} className="flex items-start flex-1">
            {/* Step column */}
            <div className="flex flex-col items-center w-full">
              {/* Dot + connector row */}
              <div className="flex items-center w-full">
                {/* Left connector */}
                {idx > 0 ? (
                  <div
                    className={`flex-1 h-0.5 ${
                      steps[idx - 1].done
                        ? "bg-emerald-400 dark:bg-emerald-600"
                        : "bg-border"
                    }`}
                  />
                ) : (
                  <div className="flex-1" />
                )}

                {/* Dot */}
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold ${
                    step.done
                      ? "bg-emerald-500 text-white"
                      : isActive
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/15"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step.done ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    idx + 1
                  )}
                </div>

                {/* Right connector */}
                {idx < steps.length - 1 ? (
                  <div
                    className={`flex-1 h-0.5 ${
                      step.done
                        ? "bg-emerald-400 dark:bg-emerald-600"
                        : "bg-border"
                    }`}
                  />
                ) : (
                  <div className="flex-1" />
                )}
              </div>

              {/* Label */}
              <span
                className={`mt-2 text-xs text-center whitespace-nowrap ${
                  isActive
                    ? "font-semibold text-foreground"
                    : step.done
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>

              {/* Deadline */}
              {deadlineDate && (
                <span
                  className={`mt-0.5 text-[11px] text-center ${
                    isOverdue
                      ? "text-red-500 font-semibold"
                      : "text-muted-foreground/70"
                  }`}
                >
                  {isOverdue
                    ? `Overdue \u00b7 ${format(deadlineDate, "MMM d")}`
                    : format(deadlineDate, "MMM d")}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
