"use client";

import { useState } from "react";
import { ListChecks, ChevronDown, CheckCircle2 } from "lucide-react";

interface BehaviorsPanelProps {
  behaviors: string[];
  expectedLevel?: number | null;
}

const PROFICIENCY_LABELS: Record<number, string> = {
  1: "Basic",
  2: "Developing",
  3: "Proficient",
  4: "Advanced",
  5: "Expert",
};

export function BehaviorsPanel({ behaviors, expectedLevel }: BehaviorsPanelProps) {
  const [open, setOpen] = useState(false);

  if (!behaviors || behaviors.length === 0) return null;

  return (
    <div className="mt-1.5">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <ListChecks className="h-3 w-3" />
        {open ? "Hide" : "Show"} observable behaviors ({behaviors.length})
        <ChevronDown
          className={`h-3 w-3 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-2 pl-0.5">
          {expectedLevel && (
            <p className="text-[10px] text-muted-foreground/70 mb-1.5 font-medium uppercase tracking-wide">
              At {expectedLevel} · {PROFICIENCY_LABELS[expectedLevel]}, you should observe:
            </p>
          )}
          <ul className="space-y-1">
            {behaviors.map((b, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3 w-3 text-primary/60 shrink-0 mt-0.5" />
                {b}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
