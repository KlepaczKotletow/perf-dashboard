"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  ClipboardCheck,
  EyeOff,
  Flag,
  MessageSquare,
  Star,
  Medal,
  BarChart3,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";

interface Assignment {
  id: string;
  status: string;
  selfSubmitted: boolean;
  gradesReleased: boolean;
  overall_rating: number | null;
  final_grade: string | null;
  manager_id: string | null;
  cycle: { id: string; name: string; status: string } | null;
  manager: { slack_name: string } | null;
}

interface FeedbackItem {
  id: string;
  message: string;
  sender: { slack_name: string; job_title: string } | null;
}

interface EmployeeHomeProps {
  firstName: string;
  assignments: Assignment[];
  recentFeedback: FeedbackItem[];
}

export function EmployeeHome({ firstName, assignments, recentFeedback }: EmployeeHomeProps) {
  const pendingSelf = assignments.filter((a) => !a.selfSubmitted && a.status !== "completed");
  const inProgress = assignments.filter((a) => a.selfSubmitted && a.status !== "completed");

  const statusMessage = pendingSelf.length > 0
    ? `You have ${pendingSelf.length} self-review${pendingSelf.length !== 1 ? "s" : ""} waiting for your input.`
    : inProgress.length > 0
    ? "Your self-review is in — your manager is completing their side."
    : "You're all caught up. Check back when a new review cycle starts.";

  return (
    <div className="space-y-8">
      <PageHeader
        hat="my-work"
        title={`Hey ${firstName}`}
        subtitle={statusMessage}
      />


      {/* Action required — pending self-reviews */}
      {pendingSelf.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground tracking-wide border-l-2 border-primary/40 pl-3">
            Action required
          </h2>
          {pendingSelf.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between p-4 rounded-xl border border-amber-200/70 bg-amber-50/40 dark:border-amber-400/20 dark:bg-amber-400/[0.04]"
            >
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Self-review due — {a.cycle?.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Complete your self-assessment to kick off the review process
                  </p>
                </div>
              </div>
              <Button size="sm" className="shrink-0" asChild>
                <Link href={`/dashboard/cycles/${a.cycle?.id}/review/${a.id}`}>
                  Start <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Link>
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* My reviews — current cycle status */}
      {assignments.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground tracking-wide border-l-2 border-primary/40 pl-3">
              My reviews
            </h2>
            <Link
              href="/dashboard/performance"
              className="text-xs text-primary font-medium hover:text-primary/80 flex items-center gap-1 transition-colors"
            >
              View history <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {assignments.map((a) => {
              let statusLabel: string;
              let statusClass: string;
              let StatusIcon: React.ComponentType<{ className?: string }>;

              if (a.status === "completed" && a.gradesReleased) {
                statusLabel = "Results available";
                statusClass = "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10";
                StatusIcon = CheckCircle2;
              } else if (a.status === "completed") {
                statusLabel = "Review complete";
                statusClass = "text-violet-700 bg-violet-50 dark:text-violet-400 dark:bg-violet-400/10";
                StatusIcon = EyeOff;
              } else if (a.selfSubmitted) {
                statusLabel = "In Progress";
                statusClass = "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10";
                StatusIcon = Clock;
              } else {
                statusLabel = "Not Started";
                statusClass = "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10";
                StatusIcon = AlertCircle;
              }

              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-card"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">{a.cycle?.name}</p>
                      <Badge className={`text-[10px] flex items-center gap-1 ${statusClass}`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusLabel}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {a.manager_id ? `Reviewed by: ${a.manager?.slack_name || "Unknown"}` : "No manager assigned"}
                    </p>
                  </div>
                  {a.gradesReleased && a.status === "completed" && (
                    <div className="flex items-center gap-2 shrink-0">
                      {a.overall_rating && (
                        <div className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          <span className="text-sm font-semibold text-foreground">{a.overall_rating}/5</span>
                        </div>
                      )}
                      {a.final_grade && (
                        <Badge variant="outline" className="text-xs">
                          <Medal className="h-3 w-3 mr-1" />
                          {a.final_grade}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No reviews at all — keep the page inviting by pointing people at
          what they CAN do right now (track goals, give kudos) rather than
          leaving them staring at a "waiting" state. */}
      {assignments.length === 0 && pendingSelf.length === 0 && (
        <Card className="border-border/60">
          <CardContent className="py-10 flex flex-col items-center text-center">
            <ClipboardCheck className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-foreground">No active reviews right now</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              You&apos;ll be added to the next performance cycle when one kicks off. In the meantime, keep your goals fresh and send some kudos.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
              <Button size="sm" variant="outline" asChild>
                <Link href="/dashboard/goals">
                  <Flag className="h-3.5 w-3.5 mr-1.5" />
                  Update my goals
                </Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href="/dashboard/feedback">
                  <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                  Give kudos
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent kudos */}
      {recentFeedback.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground tracking-wide border-l-2 border-primary/40 pl-3">
              Recent kudos
            </h2>
            <Link
              href="/dashboard/feedback"
              className="text-xs text-primary font-medium hover:text-primary/80 flex items-center gap-1 transition-colors"
            >
              See all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {recentFeedback.map((f) => (
              <div key={f.id} className="p-4 rounded-xl border border-border/60 bg-card">
                <div className="flex items-start gap-3">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-medium text-primary">
                      {f.sender?.slack_name?.[0]?.toUpperCase() || "?"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">
                      {f.sender?.slack_name || "Anonymous"}{" "}
                      <span className="text-muted-foreground font-normal">· {f.sender?.job_title || ""}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{f.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground tracking-wide border-l-2 border-primary/40 pl-3">
          Quick links
        </h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { href: "/dashboard/goals", label: "My Goals", description: "Track and update your goals", icon: Flag, color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10" },
            { href: "/dashboard/performance", label: "Performance", description: "View your review history", icon: BarChart3, color: "text-primary bg-primary/10" },
            { href: "/dashboard/feedback", label: "Kudos", description: "See feedback from your team", icon: MessageSquare, color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex items-center gap-3 p-3.5 rounded-xl border border-border/60 bg-card hover:border-border hover:shadow-sm transition-all"
            >
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${link.color} shrink-0`}>
                <link.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{link.label}</p>
                <p className="text-xs text-muted-foreground">{link.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0 ml-auto" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
