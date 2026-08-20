"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { normalizeComment, shouldPersistResponse } from "@/lib/review-responses";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, CheckCircle2, Info, AlertCircle } from "lucide-react";
import { BehaviorsPanel } from "@/components/behaviors-panel";

const PROFICIENCY_LABELS: Record<number, string> = {
  1: "Below expectations",
  2: "Developing",
  3: "Meets expectations",
  4: "Exceeds expectations",
  5: "Outstanding",
};

const ratingColors: Record<number, string> = {
  1: "bg-red-100 text-red-700 border-red-200 hover:bg-red-200",
  2: "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200",
  3: "bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-200",
  4: "bg-green-100 text-green-700 border-green-200 hover:bg-green-200",
  5: "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200",
};

const selectedRatingColors: Record<number, string> = {
  1: "bg-red-500 text-white border-red-500",
  2: "bg-orange-500 text-white border-orange-500",
  3: "bg-yellow-500 text-white border-yellow-500",
  4: "bg-green-500 text-white border-green-500",
  5: "bg-emerald-500 text-white border-emerald-500",
};

export interface CompetencyRating {
  competencyId: string;
  competencyName: string;
  competencyDescription: string | null;
  category: string | null;
  expectedLevel: number | null;
  behavioralIndicators: string[];
  existingResponseId: string | null;
  currentRating: number | null;
  currentComment: string | null;
}

interface ReviewDetailClientProps {
  assignmentId: string;
  workspaceId: string;
  reviewerId: string;
  reviewerRole: "self" | "peer" | "manager" | "skip_level" | "upward";
  competencyRatings: CompetencyRating[];
  existingOverallRating: number | null;
  canEdit: boolean;
  status: string;
  /** Where to navigate after successful submission. Defaults to /dashboard/reviews */
  redirectTo?: string;
  /** Maximum rating value from workspace rating_scale. Defaults to 5. */
  maxRating?: number;
}

export function ReviewDetailClient({
  assignmentId,
  workspaceId,
  reviewerId,
  reviewerRole,
  competencyRatings: initialRatings,
  existingOverallRating,
  canEdit,
  status,
  redirectTo = "/dashboard/reviews",
  maxRating = 5,
}: ReviewDetailClientProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [ratings, setRatings] = useState<Record<string, { rating: number | null; comment: string }>>(
    () =>
      Object.fromEntries(
        initialRatings.map((c) => [
          c.competencyId,
          { rating: c.currentRating, comment: c.currentComment || "" },
        ])
      )
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);

  const ratedCount = Object.values(ratings).filter((r) => r.rating !== null).length;
  const totalCount = initialRatings.length;
  const allRated = ratedCount === totalCount && totalCount > 0;

  // Warn before navigating away with unsaved work
  useEffect(() => {
    if (!isDirty || !canEdit) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, canEdit]);

  function setRating(competencyId: string, rating: number | null) {
    setRatings((prev) => ({ ...prev, [competencyId]: { ...prev[competencyId], rating } }));
    setSaved(false);
    setIsDirty(true);
  }

  function setComment(competencyId: string, comment: string) {
    setRatings((prev) => ({ ...prev, [competencyId]: { ...prev[competencyId], comment } }));
    setSaved(false);
    setIsDirty(true);
  }

  async function handleSave(complete = false) {
    setSaving(true);
    setSaveError(null);
    try {
      // Save everything the reviewer has entered — check EVERY error.
      //
      // This used to `continue` whenever `rating === null`, which silently
      // threw away a comment typed against an unrated competency — and then
      // still rendered the green "Saved" state and cleared `isDirty`, so the
      // beforeunload guard didn't fire either. A reviewer's written assessment
      // is the most valuable thing on this screen; it is never dropped now.
      //
      // `rating` is nullable in the schema and its CHECK (1..5) passes on NULL,
      // and the INSERT policy doesn't reference rating at all — so a
      // comment-only row is legal.
      for (const comp of initialRatings) {
        const { rating, comment } = ratings[comp.competencyId];
        const trimmedComment = normalizeComment(comment);
        const hasExistingRow = Boolean(comp.existingResponseId);
        // Nothing entered and nothing already stored — genuinely nothing to do.
        if (!shouldPersistResponse({ rating, comment, hasExistingRow })) continue;

        if (comp.existingResponseId) {
          // Safe: review_responses scoped through assignment loaded from workspace-verified server component
          const { error } = await supabase
            .from("review_responses")
            .update({ rating, comment: trimmedComment, updated_at: new Date().toISOString() })
            .eq("id", comp.existingResponseId);
          if (error) throw new Error(`Failed to save "${comp.competencyName}": ${error.message}`);
        } else {
          const { error } = await supabase.from("review_responses").insert({
            assignment_id: assignmentId,
            reviewer_id: reviewerId,
            reviewer_role: reviewerRole,
            competency_id: comp.competencyId,
            rating,
            comment: trimmedComment,
          });
          if (error) throw new Error(`Failed to save "${comp.competencyName}": ${error.message}`);
        }
      }

      if (complete && allRated) {
        const rated = Object.values(ratings).filter((r) => r.rating !== null);
        const avg = rated.reduce((sum, r) => sum + (r.rating ?? 0), 0) / rated.length;
        // Safe: review_assignments scoped through assignment loaded from workspace-verified server component
        const { error } = await supabase
          .from("review_assignments")
          .update({
            status: "completed",
            overall_rating: Math.round(avg * 10) / 10,
            updated_at: new Date().toISOString(),
          })
          .eq("id", assignmentId);
        if (error) throw new Error(`Failed to submit review: ${error.message}`);

        // Clear dirty flag before redirect so beforeunload doesn't fire
        setIsDirty(false);
        router.push(redirectTo);
        router.refresh();
        return;
      } else if (status === "pending") {
        // Safe: review_assignments scoped through assignment loaded from workspace-verified server component
        const { error } = await supabase
          .from("review_assignments")
          .update({ status: "in_progress", updated_at: new Date().toISOString() })
          .eq("id", assignmentId);
        if (error) throw new Error(`Failed to update status: ${error.message}`);
      }

      setSaved(true);
      setIsDirty(false);
      router.refresh();
    } catch (err: unknown) {
      console.error("Save error:", err);
      setSaveError((err instanceof Error ? err.message : "") || "Failed to save. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (initialRatings.length === 0) {
    return (
      <Card className="border-border/60">
        <CardContent className="py-12 text-center">
          <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
            <Info className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">No competencies assigned</p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            This employee&apos;s job level has no competencies mapped yet. Go to{" "}
            <span className="font-medium">Competencies → Matrix</span> to set expected proficiency levels.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group by category
  const grouped: Record<string, CompetencyRating[]> = {};
  for (const comp of initialRatings) {
    const cat = comp.category || "Uncategorized";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(comp);
  }

  return (
    <div className="space-y-6">
      {/* Self-reviews are completed via Slack — one-line read-only hint. */}
      {!canEdit && reviewerRole === "self" && (
        <div className="rounded-md border border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30 px-3 py-2 flex items-center gap-2 text-xs">
          <Info className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="text-foreground">
            Self-reviews happen in Slack — reply to <span className="font-medium">Nami</span>&apos;s DM to fill this out.
          </span>
        </div>
      )}

      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-muted rounded-full h-1.5">
          <div
            className="bg-primary rounded-full h-1.5 transition-all duration-500"
            style={{ width: `${totalCount > 0 ? (ratedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {ratedCount}/{totalCount} rated
        </span>
      </div>

      {/* Competency groups */}
      {Object.entries(grouped).map(([category, comps]) => (
        <div key={category}>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {category}
          </h3>
          <div className="space-y-3">
            {comps.map((comp) => {
              const { rating, comment } = ratings[comp.competencyId];
              const isRated = rating !== null;

              return (
                <Card
                  key={comp.competencyId}
                  className={`border-border/60 transition-all ${isRated ? "border-primary/20 bg-primary/[0.02]" : ""}`}
                >
                  <CardHeader className="pb-3 pt-4 px-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-sm font-semibold">{comp.competencyName}</CardTitle>
                          {isRated && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                          )}
                        </div>
                        {comp.competencyDescription && (
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                            {comp.competencyDescription}
                          </p>
                        )}
                        <BehaviorsPanel
                          behaviors={comp.behavioralIndicators}
                          expectedLevel={comp.expectedLevel}
                        />
                      </div>
                      {comp.expectedLevel && (
                        <div className="shrink-0 text-right">
                          <p className="text-[10px] text-muted-foreground">Expected</p>
                          <div className="flex items-center gap-1 justify-end mt-0.5">
                            <span className="text-xs font-semibold">{comp.expectedLevel}</span>
                            <span className="text-[10px] text-muted-foreground">
                              · {PROFICIENCY_LABELS[comp.expectedLevel]}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    {/* Rating — full 1-5 picker when editable, quiet single chip when read-only */}
                    {canEdit ? (
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-2 font-medium uppercase tracking-wide">
                          Rating
                        </p>
                        <div className="flex gap-1.5">
                          {Array.from({ length: maxRating }, (_, i) => i + 1).map((v) => (
                            <button
                              key={v}
                              onClick={() => setRating(comp.competencyId, rating === v ? null : v)}
                              className={`flex-1 h-9 rounded-md text-xs font-semibold border transition-all cursor-pointer ${
                                rating === v
                                  ? (selectedRatingColors[v] || "bg-primary text-white border-primary")
                                  : (ratingColors[v] || "bg-muted text-foreground border-border hover:bg-muted/80")
                              }`}
                              title={`${v}${PROFICIENCY_LABELS[v] ? ` · ${PROFICIENCY_LABELS[v]}` : ""}`}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                        {rating !== null && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {rating} · {PROFICIENCY_LABELS[rating]}
                            {comp.expectedLevel && rating < comp.expectedLevel && (
                              <span className="text-amber-600 ml-1">— below expected</span>
                            )}
                            {comp.expectedLevel && rating === comp.expectedLevel && (
                              <span className="text-primary ml-1">— meets expectation</span>
                            )}
                            {comp.expectedLevel && rating > comp.expectedLevel && (
                              <span className="text-emerald-600 ml-1">— exceeds expectation</span>
                            )}
                          </p>
                        )}
                      </div>
                    ) : rating === null ? (
                      <p className="text-xs text-muted-foreground italic">Not yet rated</p>
                    ) : (
                      <div className="flex items-center gap-2 text-xs">
                        <span
                          className={`inline-flex items-center justify-center h-6 w-6 rounded-md text-xs font-semibold ${
                            selectedRatingColors[rating] || "bg-primary text-white"
                          }`}
                        >
                          {rating}
                        </span>
                        <span className="text-foreground font-medium">
                          {PROFICIENCY_LABELS[rating]}
                        </span>
                        {comp.expectedLevel && rating < comp.expectedLevel && (
                          <span className="text-amber-600 text-[11px]">— below expected</span>
                        )}
                        {comp.expectedLevel && rating === comp.expectedLevel && (
                          <span className="text-primary text-[11px]">— meets expectation</span>
                        )}
                        {comp.expectedLevel && rating > comp.expectedLevel && (
                          <span className="text-emerald-600 text-[11px]">— exceeds expectation</span>
                        )}
                      </div>
                    )}

                    {/* Comment */}
                    {canEdit && (
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">
                          Comment <span className="normal-case font-normal">(optional)</span>
                        </p>
                        <Textarea
                          value={comment}
                          onChange={(e) => setComment(comp.competencyId, e.target.value)}
                          placeholder="Add specific examples or observations..."
                          rows={2}
                          className="text-xs resize-none"
                        />
                      </div>
                    )}
                    {!canEdit && comment && (
                      <p className="text-xs text-muted-foreground italic">&ldquo;{comment}&rdquo;</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {/* Save / Complete actions */}
      {canEdit && (
        <div className="pt-2 border-t border-border/60 space-y-2">
          {saveError && (
            <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 shrink-0" />
              {saveError}
            </p>
          )}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {saved ? (
                <span className="text-primary flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Saved
                </span>
              ) : (
                `${ratedCount} of ${totalCount} competencies rated`
              )}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSave(false)}
                disabled={saving || ratedCount === 0}
              >
                {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Save draft
              </Button>
              <Button
                size="sm"
                onClick={() => setShowSubmitDialog(true)}
                disabled={saving || !allRated || status === "completed"}
              >
                {status === "completed" ? "Completed" : "Submit review"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Submit confirmation dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit this review?</AlertDialogTitle>
            <AlertDialogDescription>
              Once submitted, all ratings will be locked and the review will be marked as complete.
              The overall rating will be calculated from your {totalCount} competency rating{totalCount !== 1 ? "s" : ""}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Go back</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowSubmitDialog(false);
                handleSave(true);
              }}
              disabled={saving}
            >
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Submit review
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
