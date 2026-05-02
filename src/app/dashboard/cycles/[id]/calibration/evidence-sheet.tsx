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
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{assignment?.employee?.slack_name ?? "Evidence"}</SheetTitle>
          <SheetDescription>What&apos;s underneath this calibration decision</SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {data && !loading && (
          <div className="mt-6 space-y-6 px-1">
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
                      <div className="text-[10px] text-muted-foreground not-italic mt-0.5">
                        {p.created_at && format(new Date(p.created_at), "MMM d")}
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
                    </blockquote>
                  ))}
                </div>
              </section>
            )}

            {data.recentKudos.length > 0 && (
              <section>
                <h4 className="text-sm font-semibold mb-2">Recent kudos</h4>
                <div className="space-y-2">
                  {data.recentKudos.map((k, i) => (
                    <div key={i} className="text-sm">
                      <span className="text-xs text-muted-foreground">
                        {k.anonymous ? "Anonymous" : k.sender_name ?? "Someone"} &middot; {k.created_at && format(new Date(k.created_at), "MMM d")}
                      </span>
                      <p className="mt-0.5">{k.message}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

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
