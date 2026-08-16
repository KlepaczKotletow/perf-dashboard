"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, AlertTriangle, Info, CheckCircle2, ArrowRight } from "lucide-react";

// Pre-launch readiness check.
//
// The wizard used to launch into silent partial delivery: people with no Slack
// account were skipped by nami-bot, people with no manager got a standard
// assignment nobody could ever complete, and neither was surfaced. A cycle that
// half-delivers is discovered weeks later, by which point responses are missing
// and the admin has no idea why. Naming every affected person — with the reason
// and the fix — before the launch button is the cheapest possible guard.

export interface ReadinessUser {
  id: string;
  slack_name: string | null;
  slack_email: string | null;
  slack_user_id: string | null;
  manager_id: string | null;
  level_id?: string | null;
}

export interface ReadinessIssue {
  key: string;
  severity: "blocking" | "warning" | "info";
  title: string;
  /** What actually happens if the admin launches anyway. */
  consequence: string;
  fix: string;
  fixHref: string;
  fixLabel: string;
  people: ReadinessUser[];
}

export function computeReadiness(
  users: ReadinessUser[],
  selectedIds: string[]
): ReadinessIssue[] {
  const selected = new Set(selectedIds);
  const participants = users.filter((u) => selected.has(u.id));
  const issues: ReadinessIssue[] = [];

  // Blocking: no Slack account. These people cannot be DM'd by Nami AND cannot
  // sign in to the dashboard — getUserWorkspace resolves identity from
  // slack_user_id, so a row without one never authenticates.
  const noSlack = participants.filter((u) => !u.slack_user_id);
  if (noSlack.length > 0) {
    issues.push({
      key: "no-slack",
      severity: "blocking",
      title: `${noSlack.length} ${noSlack.length === 1 ? "person has" : "people have"} no Slack account`,
      consequence:
        "Nami can't DM them, and they can't sign in to the dashboard either — identity is keyed on their Slack account. Their reviews will sit pending for the whole cycle.",
      fix: "Link them by syncing from Slack, or remove them from this cycle.",
      fixHref: "/dashboard/team",
      fixLabel: "Open Directory",
      people: noSlack,
    });
  }

  // Warning: no manager — a standard assignment is still created, but nobody
  // owns the manager half, so it can never reach "completed".
  const noManager = participants.filter((u) => !u.manager_id);
  if (noManager.length > 0) {
    issues.push({
      key: "no-manager",
      severity: "warning",
      title: `${noManager.length} ${noManager.length === 1 ? "person has" : "people have"} no manager`,
      consequence:
        "They can complete a self-review, but no manager review will ever be written — the assignment stays In Progress and the cycle can't auto-complete. Expected for the most senior person; a problem for anyone else.",
      fix: "Assign a manager in the Directory, or mark the cycle complete manually when only the org root is left.",
      fixHref: "/dashboard/team",
      fixLabel: "Open Directory",
      people: noManager,
    });
  }

  // Info: manager exists, is a real colleague, but was left out of this cycle,
  // so no upward review row is generated.
  //
  // Deliberately excludes the most senior participant(s): in a strict hierarchy
  // the top of any selection never has an enrolled manager, so reporting it
  // every time is noise that teaches admins to skip this panel. We only flag it
  // when someone ELSE in the selection reports into the same missing manager's
  // chain — i.e. the omission looks accidental rather than structural.
  const participantIds = new Set(participants.map((p) => p.id));
  const mostSenior = new Set(
    participants
      .filter((p) => !p.manager_id || !participantIds.has(p.manager_id))
      .filter((p) => {
        // Someone is structurally senior if nobody in the selection manages
        // them AND their manager manages nobody else here either.
        const managerId = p.manager_id;
        if (!managerId) return true;
        const managerIsColleague = users.some((x) => x.id === managerId);
        return !managerIsColleague;
      })
      .map((p) => p.id)
  );
  const managerNotEnrolled = participants.filter(
    (u) => u.manager_id && !selected.has(u.manager_id) && !mostSenior.has(u.id)
  );
  if (managerNotEnrolled.length > 0) {
    issues.push({
      key: "manager-not-enrolled",
      severity: "info",
      title: `${managerNotEnrolled.length} ${managerNotEnrolled.length === 1 ? "manager is" : "managers are"} not in this cycle`,
      consequence:
        "No upward review will be created for them — upward reviews only exist when the manager is also a participant.",
      fix: "Add their managers on the People step if you want upward feedback.",
      fixHref: "#",
      fixLabel: "",
      people: managerNotEnrolled,
    });
  }

  // Info: no level means the reviewer sees no expected-proficiency anchor.
  const noLevel = participants.filter((u) => u.level_id === null || u.level_id === undefined);
  if (noLevel.length > 0) {
    issues.push({
      key: "no-level",
      severity: "info",
      title: `${noLevel.length} ${noLevel.length === 1 ? "person has" : "people have"} no competency bracket`,
      consequence:
        "Their reviewers won't see an expected proficiency target, so ratings have no anchor to calibrate against.",
      fix: "Assign a function and level in the Directory.",
      fixHref: "/dashboard/team?filter=unassigned",
      fixLabel: "Show unassigned",
      people: noLevel,
    });
  }

  return issues;
}

const TONE = {
  blocking: {
    box: "border-red-200 bg-red-50 dark:bg-red-400/10 dark:border-red-400/20",
    text: "text-red-800 dark:text-red-300",
    sub: "text-red-700 dark:text-red-400",
    icon: AlertTriangle,
    iconClass: "text-red-600 dark:text-red-400",
  },
  warning: {
    box: "border-amber-200 bg-amber-50 dark:bg-amber-400/10 dark:border-amber-400/20",
    text: "text-amber-800 dark:text-amber-300",
    sub: "text-amber-700 dark:text-amber-400",
    icon: AlertTriangle,
    iconClass: "text-amber-600 dark:text-amber-400",
  },
  info: {
    box: "border-border/60 bg-muted/30",
    text: "text-foreground",
    sub: "text-muted-foreground",
    icon: Info,
    iconClass: "text-muted-foreground",
  },
} as const;

export function ReadinessCheck({
  users,
  selectedIds,
}: {
  users: ReadinessUser[];
  selectedIds: string[];
}) {
  const issues = computeReadiness(users, selectedIds);
  const [open, setOpen] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-400/10 dark:border-emerald-400/20">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <p className="text-sm text-emerald-800 dark:text-emerald-300">
          Everyone in this cycle can be reached and reviewed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
        Before you launch
      </h3>
      {issues.map((issue) => {
        const tone = TONE[issue.severity];
        const Icon = tone.icon;
        const isOpen = open.has(issue.key);
        return (
          <div key={issue.key} className={`rounded-lg border ${tone.box}`}>
            <button
              type="button"
              onClick={() => toggle(issue.key)}
              aria-expanded={isOpen}
              className="w-full flex items-start gap-3 px-4 py-3 text-left"
            >
              <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${tone.iconClass}`} />
              <span className="flex-1 min-w-0">
                <span className={`block text-sm font-medium ${tone.text}`}>{issue.title}</span>
                <span className={`block text-xs mt-0.5 ${tone.sub}`}>{issue.consequence}</span>
              </span>
              {isOpen ? (
                <ChevronDown className={`h-4 w-4 shrink-0 mt-0.5 ${tone.iconClass}`} />
              ) : (
                <ChevronRight className={`h-4 w-4 shrink-0 mt-0.5 ${tone.iconClass}`} />
              )}
            </button>

            {isOpen && (
              <div className="px-4 pb-3 pl-11 space-y-2">
                <ul className="flex flex-wrap gap-1.5">
                  {issue.people.map((p) => (
                    <li
                      key={p.id}
                      className="text-[11px] px-1.5 py-0.5 rounded border border-border/60 bg-background/60 text-muted-foreground"
                    >
                      {p.slack_name || p.slack_email || "Unknown"}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-3">
                  <p className={`text-xs ${tone.sub}`}>{issue.fix}</p>
                  {issue.fixLabel && (
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1 shrink-0" asChild>
                      <Link href={issue.fixHref} target="_blank">
                        {issue.fixLabel} <ArrowRight className="h-3 w-3" />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
