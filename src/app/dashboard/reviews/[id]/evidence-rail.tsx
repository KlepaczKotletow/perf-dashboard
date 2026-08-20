import { format } from "date-fns";
import { GOAL_TRACKING_STATUS } from "@/lib/status";
import { Badge } from "@/components/ui/badge";
import type { ReviewEvidence } from "@/lib/review-evidence";

/**
 * The evidence rail.
 *
 * The point of this column is that the reviewer is never asked to recall
 * something the product already stores. It is reference material, so it is
 * deliberately quiet: no cards competing with the form, no colour except where
 * a goal is genuinely off track, one hairline separating each section.
 *
 * It renders nothing at all when there is nothing to show — an empty rail with
 * four "No goals yet" placeholders would be worse than no rail, because it
 * would take a third of the width to say nothing.
 */
export function EvidenceRail({
  evidence,
  employeeName,
  ratingMax,
}: {
  evidence: ReviewEvidence;
  employeeName: string;
  ratingMax: number;
}) {
  const { selfAssessment, goals, kudos, prior } = evidence;
  const selfWithSubstance = selfAssessment.filter((s) => s.comment || s.rating !== null);
  const hasAnything =
    selfWithSubstance.length > 0 || goals.length > 0 || kudos.length > 0 || prior !== null;

  if (!hasAnything) return null;

  const firstName = employeeName.split(" ")[0] || employeeName;

  return (
    <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start" aria-label="Evidence">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        While you write
      </p>

      {prior && (
        <section className="space-y-1">
          <h3 className="text-xs font-semibold text-foreground">Last cycle</h3>
          <p className="text-sm text-muted-foreground tabular-nums">
            {prior.overallRating != null && (
              <span className="font-medium text-foreground">
                {prior.overallRating}/{ratingMax}
              </span>
            )}
            {prior.finalGrade && <> · {prior.finalGrade}</>}
            {prior.cycleName && (
              <span className="text-muted-foreground/70"> · {prior.cycleName}</span>
            )}
          </p>
        </section>
      )}

      {selfWithSubstance.length > 0 && (
        <section className="space-y-2 border-t border-border/40 pt-4">
          <h3 className="text-xs font-semibold text-foreground">
            What {firstName} said
          </h3>
          <ul className="space-y-2.5">
            {selfWithSubstance.map((s, i) => (
              <li key={`${s.competencyName ?? "general"}-${i}`} className="text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground truncate">
                    {s.competencyName ?? "Overall"}
                  </span>
                  {s.rating !== null && (
                    <span className="text-foreground font-medium tabular-nums shrink-0">
                      {s.rating}
                    </span>
                  )}
                </div>
                {s.comment && (
                  <p className="text-muted-foreground/90 leading-relaxed mt-0.5">
                    &ldquo;{s.comment}&rdquo;
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {goals.length > 0 && (
        <section className="space-y-2 border-t border-border/40 pt-4">
          <h3 className="text-xs font-semibold text-foreground">Goals</h3>
          <ul className="space-y-2">
            {goals.map((g) => {
              const tracking =
                GOAL_TRACKING_STATUS[g.trackingStatus as keyof typeof GOAL_TRACKING_STATUS];
              return (
                <li key={g.id} className="text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-muted-foreground truncate">{g.title}</span>
                    <span className="text-foreground tabular-nums shrink-0">
                      {g.progress ?? 0}%
                    </span>
                  </div>
                  {/* Only off-track goals earn colour. Painting every goal
                      green is how "On Track" ended up next to 0% progress. */}
                  {tracking && g.trackingStatus !== "on_track" && (
                    <Badge className={`text-xs mt-0.5 ${tracking.badge}`}>{tracking.label}</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {kudos.length > 0 && (
        <section className="space-y-2 border-t border-border/40 pt-4">
          <h3 className="text-xs font-semibold text-foreground">Kudos</h3>
          <ul className="space-y-2.5">
            {kudos.map((k) => (
              <li key={k.id} className="text-sm">
                <p className="text-muted-foreground leading-relaxed">{k.message}</p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  {k.fromName ?? "Anonymous"} · {format(new Date(k.createdAt), "MMM d")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
