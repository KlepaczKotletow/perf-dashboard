"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { createBrowserClient } from "@supabase/ssr";
import { getEmployeeEvidence, EmployeeEvidence } from "./evidence-data";

interface AssignmentLite {
  id: string;
  employee: { id: string; slack_name: string | null } | null;
}

interface Props {
  assignmentId: string | null;
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  cycleId: string;
  assignments: AssignmentLite[];
}

// Recency window for the "Recent" badge. Items within this window are flagged
// so calibrators can consciously weight against recency bias — research finds
// ~40% of annual appraisals show recency error (SHRM/Engagedly).
const RECENT_WINDOW_DAYS = 14;

function isRecent(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const ageMs = Date.now() - new Date(iso).getTime();
  return ageMs >= 0 && ageMs <= RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

// Minimum anonymous-kudos count required to surface them at calibration time.
// Single anonymous comments are too easy to weaponize (Bloomfield et al. 2024
// on strategic peer-harming disclosures); 360 instruments anonymize peers in
// aggregate (≥3 raters per category) for the same reason.
const ANON_AGGREGATE_THRESHOLD = 3;

export function EvidenceSheet({ assignmentId, open, onClose, workspaceId, cycleId, assignments }: Props) {
  const [data, setData] = useState<EmployeeEvidence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const assignment = assignmentId ? assignments.find((a) => a.id === assignmentId) : null;

  useEffect(() => {
    if (!assignmentId || !assignment?.employee?.id) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    getEmployeeEvidence(supabase, workspaceId, cycleId, assignmentId, assignment.employee.id)
      .then(setData)
      .catch((err) => setError(err?.message ?? "Failed to load evidence"))
      .finally(() => setLoading(false));
  }, [assignmentId, assignment?.employee?.id, workspaceId, cycleId]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto px-6">
        <SheetHeader className="px-0 pt-2 pb-4">
          <SheetTitle>{assignment?.employee?.slack_name ?? "Evidence"}</SheetTitle>
          <SheetDescription>What&apos;s underneath this calibration decision</SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="space-y-3 pb-6">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {data && !loading && (
          <div className="space-y-6 pb-6">
            {data.priorGrade && (
              <section>
                <h4 className="text-sm font-semibold mb-2">Last cycle</h4>
                <p className="text-sm text-muted-foreground">
                  {data.priorGrade.cycle_name}
                  {data.priorGrade.cycle_end && (
                    <> &middot; {format(new Date(data.priorGrade.cycle_end), "MMM yyyy")}</>
                  )}
                </p>
                <Badge variant="outline" className="mt-1">{data.priorGrade.final_grade ?? "(no grade)"}</Badge>
              </section>
            )}

            {data.managerResponses.length > 0 && (
              <section>
                <h4 className="text-sm font-semibold mb-2">Manager review</h4>
                <div className="space-y-2">
                  {data.managerResponses.map((r, i) => (
                    <div key={i} className="border-l-2 border-border pl-3 py-1 text-sm">
                      <div className="text-xs text-muted-foreground">
                        {r.competency ?? "Overall"}
                        {r.rating != null && <> &middot; {r.rating}/5</>}
                      </div>
                      {r.comment && <p className="mt-0.5">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {data.peerComments.length > 0 && (
              <section>
                <h4 className="text-sm font-semibold mb-2">Peer feedback ({data.peerComments.length})</h4>
                <div className="space-y-2">
                  {data.peerComments.slice(0, 5).map((p, i) => (
                    <blockquote key={i} className="border-l-2 border-border pl-3 py-1 text-sm italic">
                      &ldquo;{p.comment}&rdquo;
                      <div className="text-[10px] text-muted-foreground not-italic mt-0.5 flex items-center gap-1.5">
                        {p.created_at && (
                          <span>{format(new Date(p.created_at), "MMM d")}</span>
                        )}
                        {isRecent(p.created_at) && (
                          <Badge variant="outline" className="px-1 py-0 text-[9px] font-normal h-4 border-amber-300 text-amber-700 dark:border-amber-400/40 dark:text-amber-400">
                            Recent
                          </Badge>
                        )}
                      </div>
                    </blockquote>
                  ))}
                </div>
              </section>
            )}

            {data.upwardComments.length > 0 && (
              <section>
                <h4 className="text-sm font-semibold mb-2">Upward feedback</h4>
                <div className="space-y-2">
                  {data.upwardComments.map((p, i) => (
                    <blockquote key={i} className="border-l-2 border-amber-300 pl-3 py-1 text-sm italic">
                      &ldquo;{p.comment}&rdquo;
                      {isRecent(p.created_at) && (
                        <div className="text-[10px] text-muted-foreground not-italic mt-0.5">
                          <Badge variant="outline" className="px-1 py-0 text-[9px] font-normal h-4 border-amber-300 text-amber-700 dark:border-amber-400/40 dark:text-amber-400">
                            Recent
                          </Badge>
                        </div>
                      )}
                    </blockquote>
                  ))}
                </div>
              </section>
            )}

            {(() => {
              // Split kudos into named (always shown individually) and anonymous
              // (aggregated when count >= threshold; suppressed below threshold to
              // avoid weaponizing single anonymous comments at decision time).
              const named = data.recentKudos.filter((k) => !k.anonymous);
              const anon = data.recentKudos.filter((k) => k.anonymous);
              const showAnonAggregate = anon.length >= ANON_AGGREGATE_THRESHOLD;
              if (named.length === 0 && anon.length === 0) return null;
              return (
                <section>
                  <h4 className="text-sm font-semibold mb-2">Recent kudos</h4>
                  <div className="space-y-2">
                    {named.map((k, i) => (
                      <div key={`named-${i}`} className="text-sm">
                        <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                          <span>{k.sender_name ?? "Someone"}</span>
                          <span aria-hidden>&middot;</span>
                          <span>{k.created_at && format(new Date(k.created_at), "MMM d")}</span>
                          {isRecent(k.created_at) && (
                            <Badge variant="outline" className="px-1 py-0 text-[9px] font-normal h-4 border-amber-300 text-amber-700 dark:border-amber-400/40 dark:text-amber-400">
                              Recent
                            </Badge>
                          )}
                        </span>
                        <p className="mt-0.5">{k.message}</p>
                      </div>
                    ))}
                    {showAnonAggregate ? (
                      <div className="text-sm rounded-md border border-dashed border-border/60 bg-muted/20 p-2.5">
                        <p className="text-xs text-muted-foreground">
                          {anon.length} anonymous kudos
                          {anon.some((k) => isRecent(k.created_at)) && (
                            <>
                              {" "}
                              <Badge variant="outline" className="px-1 py-0 text-[9px] font-normal h-4 border-amber-300 text-amber-700 dark:border-amber-400/40 dark:text-amber-400">
                                Recent
                              </Badge>
                            </>
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Individual content withheld at calibration time. Anonymous content has not been verified by a named author &mdash; weight accordingly.
                        </p>
                      </div>
                    ) : anon.length > 0 ? (
                      <p className="text-[11px] text-muted-foreground italic">
                        {anon.length} anonymous kudos withheld (below {ANON_AGGREGATE_THRESHOLD}-rater aggregation threshold).
                      </p>
                    ) : null}
                  </div>
                </section>
              );
            })()}

            {data.managerResponses.length === 0 &&
             data.peerComments.length === 0 &&
             data.upwardComments.length === 0 &&
             data.recentKudos.length === 0 &&
             !data.priorGrade && (
              <p className="text-sm text-muted-foreground">
                No evidence yet — this employee has no manager reviews, peer/upward comments, kudos, or prior grades.
              </p>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
