"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Send, Star } from "lucide-react";
import Link from "next/link";

interface CompetencyRating {
  competency_id: string;
  name: string;
  category: string | null;
  expected_level: number | null;
  rating: number | null;
  comment: string;
}

export default function ReviewFormPage({
  params,
}: {
  params: Promise<{ id: string; assignmentId: string }>;
}) {
  const { id: cycleId, assignmentId } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<any>(null);
  const [employee, setEmployee] = useState<any>(null);
  const [competencies, setCompetencies] = useState<CompetencyRating[]>([]);
  const [overallComment, setOverallComment] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Get current user
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          setError("Not authenticated");
          return;
        }
        const appUserId = authUser.user_metadata?.app_user_id;
        setCurrentUser({ id: appUserId, ...authUser.user_metadata });

        // Load assignment
        const { data: assignmentData, error: assignmentError } = await supabase
          .from("review_assignments")
          .select(`
            *,
            employee:users!review_assignments_employee_id_fkey(
              id, slack_name, slack_email, job_title, department, level_id,
              level:levels!users_level_id_fkey(id, name, grade, job_family:job_families(name))
            ),
            manager:users!review_assignments_manager_id_fkey(id, slack_name)
          `)
          .eq("id", assignmentId)
          .single();

        if (assignmentError || !assignmentData) {
          setError("Assignment not found");
          return;
        }

        setAssignment(assignmentData);
        setEmployee(assignmentData.employee);

        // Check if already submitted
        const { data: existingResponses } = await supabase
          .from("review_responses")
          .select("id")
          .eq("assignment_id", assignmentId)
          .eq("reviewer_id", appUserId)
          .limit(1);

        if (existingResponses && existingResponses.length > 0) {
          setAlreadySubmitted(true);
        }

        // Load competencies for this employee's level
        const levelId = assignmentData.employee?.level_id;
        let competencyData: CompetencyRating[] = [];

        if (levelId) {
          // Get level_competencies with expected levels
          const { data: levelComps } = await supabase
            .from("level_competencies")
            .select(`
              expected_level,
              competency:competencies!level_competencies_competency_id_fkey(id, name, category)
            `)
            .eq("level_id", levelId);

          if (levelComps && levelComps.length > 0) {
            competencyData = levelComps.map((lc: any) => ({
              competency_id: lc.competency.id,
              name: lc.competency.name,
              category: lc.competency.category,
              expected_level: lc.expected_level,
              rating: null,
              comment: "",
            }));
          }
        }

        // If no level-specific competencies, fall back to all workspace competencies
        if (competencyData.length === 0) {
          const { data: allComps } = await supabase
            .from("competencies")
            .select("id, name, category")
            .order("category, name");

          competencyData = (allComps || []).map((c: any) => ({
            competency_id: c.id,
            name: c.name,
            category: c.category,
            expected_level: null,
            rating: null,
            comment: "",
          }));
        }

        setCompetencies(competencyData);
      } catch (err) {
        setError("Failed to load review data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [assignmentId]);

  function setRating(compIdx: number, rating: number) {
    setCompetencies((prev) => {
      const updated = [...prev];
      updated[compIdx] = { ...updated[compIdx], rating };
      return updated;
    });
  }

  function setComment(compIdx: number, comment: string) {
    setCompetencies((prev) => {
      const updated = [...prev];
      updated[compIdx] = { ...updated[compIdx], comment };
      return updated;
    });
  }

  // Determine reviewer role
  function getReviewerRole(): string {
    if (!currentUser || !assignment) return "peer";
    if (currentUser.id === assignment.employee_id) return "self";
    if (currentUser.id === assignment.manager_id) return "manager";
    return "peer";
  }

  async function handleSubmit() {
    if (!currentUser?.id || !assignment) return;
    setSubmitting(true);
    setError(null);

    try {
      const reviewerRole = getReviewerRole();

      // Insert review_responses for each competency
      const responses = competencies
        .filter((c) => c.rating !== null)
        .map((c) => ({
          assignment_id: assignmentId,
          reviewer_id: currentUser.id,
          reviewer_role: reviewerRole,
          competency_id: c.competency_id,
          rating: c.rating,
          comment: c.comment || null,
        }));

      // Add overall comment as a response without competency
      if (overallComment.trim()) {
        responses.push({
          assignment_id: assignmentId,
          reviewer_id: currentUser.id,
          reviewer_role: reviewerRole,
          competency_id: null as any,
          rating: null as any,
          comment: overallComment,
        });
      }

      if (responses.length === 0) {
        setError("Please rate at least one competency");
        setSubmitting(false);
        return;
      }

      const { error: insertError } = await supabase
        .from("review_responses")
        .insert(responses);

      if (insertError) {
        setError(insertError.message);
        setSubmitting(false);
        return;
      }

      // Update assignment status if this is the manager review
      if (reviewerRole === "manager") {
        const ratedComps = competencies.filter((c) => c.rating !== null);
        const avgRating = ratedComps.length > 0
          ? ratedComps.reduce((sum, c) => sum + (c.rating || 0), 0) / ratedComps.length
          : null;

        await supabase
          .from("review_assignments")
          .update({
            status: "completed",
            overall_rating: avgRating ? parseFloat(avgRating.toFixed(2)) : null,
          })
          .eq("id", assignmentId);
      } else {
        // Mark in_progress if still pending
        await supabase
          .from("review_assignments")
          .update({ status: "in_progress" })
          .eq("id", assignmentId)
          .eq("status", "pending");
      }

      router.push(`/dashboard/cycles/${cycleId}`);
      router.refresh();
    } catch (err) {
      setError("Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (alreadySubmitted) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/cycles/${cycleId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Review Already Submitted</h1>
        </div>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">
              You have already submitted a review for this assignment.
            </p>
            <Button className="mt-4" asChild>
              <Link href={`/dashboard/cycles/${cycleId}`}>Back to Cycle</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Gather categories
  const categories = [...new Set(competencies.map((c) => c.category || "General"))];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/cycles/${cycleId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Submit Review</h1>
          <p className="text-muted-foreground">
            Reviewing as <Badge variant="outline">{getReviewerRole()}</Badge>
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20">
          {error}
        </div>
      )}

      {/* Employee Info Card */}
      {employee && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{employee.slack_name}</CardTitle>
            <CardDescription>
              {employee.job_title || "No title"}{" "}
              {employee.department && `· ${employee.department}`}{" "}
              {employee.level && (
                <>
                  ·{" "}
                  {employee.level.job_family?.name && `${employee.level.job_family.name} — `}
                  {employee.level.name}
                  {employee.level.grade && ` (${employee.level.grade})`}
                </>
              )}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Rating Scale Legend */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-center gap-6 text-sm">
            <span className="text-muted-foreground font-medium">Rating Scale:</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className="flex items-center gap-1">
                <span className="font-bold">{n}</span>
                <span className="text-muted-foreground">
                  {["Below", "Developing", "Meets", "Exceeds", "Outstanding"][n - 1]}
                </span>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Competency Ratings by Category */}
      {categories.map((category) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="text-lg">{category}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {competencies
              .filter((c) => (c.category || "General") === category)
              .map((comp) => {
                const compIdx = competencies.indexOf(comp);
                return (
                  <div key={comp.competency_id} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">{comp.name}</Label>
                      {comp.expected_level && (
                        <Badge variant="secondary" className="text-xs">
                          Expected: {comp.expected_level}/5
                        </Badge>
                      )}
                    </div>
                    {/* Star Rating */}
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(compIdx, star)}
                          className="focus:outline-none transition-colors"
                        >
                          <Star
                            className={`h-7 w-7 ${
                              comp.rating && star <= comp.rating
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted-foreground/30 hover:text-yellow-300"
                            }`}
                          />
                        </button>
                      ))}
                      {comp.rating && (
                        <span className="ml-2 text-sm text-muted-foreground">
                          {comp.rating}/5
                        </span>
                      )}
                    </div>
                    {/* Comment */}
                    <Textarea
                      placeholder={`Optional comment for ${comp.name}...`}
                      value={comp.comment}
                      onChange={(e) => setComment(compIdx, e.target.value)}
                      className="min-h-[60px]"
                    />
                  </div>
                );
              })}
          </CardContent>
        </Card>
      ))}

      {competencies.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No competencies defined for this employee&apos;s level. Please set up the competency matrix first.
          </CardContent>
        </Card>
      )}

      {/* Overall Comment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Overall Comments</CardTitle>
          <CardDescription>Provide any additional feedback or observations</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Share your overall assessment, strengths, areas for improvement..."
            value={overallComment}
            onChange={(e) => setOverallComment(e.target.value)}
            className="min-h-[120px]"
          />
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-3 pb-8">
        <Button variant="outline" asChild>
          <Link href={`/dashboard/cycles/${cycleId}`}>Cancel</Link>
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Submit Review
        </Button>
      </div>
    </div>
  );
}
