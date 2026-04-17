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

/**
 * Thin, quiet progress indicator.
 *
 * Replaces the previous 6-circle stepper (~120px tall) with:
 *   - one-line status ("Step 1 of 6 · Goal Setting · Overdue Apr 10")
 *   - a thin segmented bar underneath
 *
 * Total height ~40px. Keeps all the signal (how many steps, which step,
 * deadline urgency) but drops the visual weight.
 */
export function ProgressStepper({ steps }: ProgressStepperProps) {
  if (steps.length === 0) return null;

  // Active step = explicit .active OR first !done step whose predecessors are all done
  const activeIdx = (() => {
    const explicit = steps.findIndex((s) => s.active);
    if (explicit !== -1) return explicit;
    const next = steps.findIndex(
      (s, i) => !s.done && (i === 0 || steps[i - 1].done),
    );
    return next === -1 ? steps.length - 1 : next;
  })();

  const activeStep = steps[activeIdx];
  const deadlineDate = activeStep.deadline ? new Date(activeStep.deadline) : null;
  const isOverdue = !!deadlineDate && isPast(deadlineDate) && !activeStep.done;

  return (
    <div className="space-y-2">
      {/* Inline status line */}
      <div className="flex items-baseline gap-2 text-xs flex-wrap">
        <span className="text-muted-foreground">
          Step {activeIdx + 1} of {steps.length}
        </span>
        <span className="text-muted-foreground/40">·</span>
        <span className="font-semibold text-foreground">{activeStep.label}</span>
        {deadlineDate && (
          <>
            <span className="text-muted-foreground/40">·</span>
            <span
              className={
                isOverdue
                  ? "text-red-600 font-semibold"
                  : "text-muted-foreground"
              }
            >
              {isOverdue
                ? `Overdue ${format(deadlineDate, "MMM d")}`
                : `Due ${format(deadlineDate, "MMM d")}`}
            </span>
          </>
        )}
      </div>

      {/* Segmented bar */}
      <div className="flex gap-1" aria-hidden="true">
        {steps.map((step, i) => {
          const color = step.done
            ? "bg-emerald-500"
            : i === activeIdx
              ? isOverdue
                ? "bg-red-400"
                : "bg-primary"
              : "bg-muted";
          return (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${color}`}
              title={step.label}
            />
          );
        })}
      </div>
    </div>
  );
}
