import { Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { gradeColor } from "@/lib/status";

interface CompetencyRating {
  name: string;
  rating: number;
}

interface FeedbackPreview {
  reviewerName: string;
  reviewerRole: string;
  comment: string;
  rating: number | null;
}

interface ResultsSectionProps {
  overallRating: number | null;
  grade: string | null;
  ratingMax: number;
  competencyRatings: CompetencyRating[];
  feedbackPreviews: FeedbackPreview[];
  gradesReleased: boolean;
}

const roleBadgeColors: Record<string, string> = {
  self: "text-violet-700 bg-violet-50 dark:text-violet-400 dark:bg-violet-400/10",
  manager: "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10",
  upward: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10",
  peer: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10",
};

function StarRating({
  rating,
  max,
  size = "sm",
}: {
  rating: number;
  max: number;
  size?: "sm" | "md";
}) {
  const cls = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
        <Star
          key={star}
          className={`${cls} ${
            star <= rating
              ? "fill-yellow-400 text-yellow-400"
              : "text-muted-foreground/20"
          }`}
        />
      ))}
      <span className="ml-1.5 text-xs font-medium text-muted-foreground tabular-nums">
        {rating}/{max}
      </span>
    </div>
  );
}

export function ResultsSection({
  overallRating,
  grade,
  ratingMax,
  competencyRatings,
  feedbackPreviews,
  gradesReleased,
}: ResultsSectionProps) {
  if (!gradesReleased) {
    return (
      <div className="rounded-lg border border-border/60 bg-muted/30 px-5 py-6 text-center">
        <p className="text-sm text-muted-foreground">
          Grades not yet released for this cycle.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overall rating + grade */}
      {(overallRating != null || grade) && (
        <div className="flex items-center gap-4">
          {overallRating != null && (
            <StarRating rating={overallRating} max={ratingMax} size="md" />
          )}
          {grade && (
            <span className={`text-sm font-semibold ${gradeColor(grade)}`}>
              {grade}
            </span>
          )}
        </div>
      )}

      {/* Competency breakdown */}
      {competencyRatings.length > 0 && (
        <Card className="border-border/60">
          <CardContent className="py-4 px-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Competencies
            </p>
            <div className="space-y-2.5">
              {competencyRatings.map((comp) => (
                <div
                  key={comp.name}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-sm text-foreground truncate">
                    {comp.name}
                  </span>
                  <StarRating rating={comp.rating} max={ratingMax} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feedback previews */}
      {feedbackPreviews.length > 0 && (
        <Card className="border-border/60">
          <CardContent className="py-4 px-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Feedback
            </p>
            <div className="divide-y divide-border">
              {feedbackPreviews.map((fb, idx) => {
                const badgeClass =
                  roleBadgeColors[fb.reviewerRole] || roleBadgeColors.peer;
                return (
                  <div
                    key={`${fb.reviewerName}-${idx}`}
                    className="py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground">
                        {fb.reviewerName}
                      </span>
                      <Badge
                        className={`text-[10px] font-medium ${badgeClass}`}
                      >
                        {fb.reviewerRole.charAt(0).toUpperCase() +
                          fb.reviewerRole.slice(1)}
                      </Badge>
                      {fb.rating != null && (
                        <StarRating rating={fb.rating} max={ratingMax} />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {fb.comment}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
