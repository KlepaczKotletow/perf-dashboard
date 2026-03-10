"use client";

import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Send, Star, MessageSquare, Target, CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";
import { BehaviorsPanel } from "@/components/behaviors-panel";
import { formatDistanceToNow } from "date-fns";

interface CompetencyRating {
  competency_id: string;
  name: string;
  category: string | null;
  expected_level: number | null;
  behaviors: string[];
  rating: number | null;
  comment: string;
}

interface TextResponse {
  questionId: string;
  prompt: string;
  required: boolean;
  response: string;
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
  const [textResponses, setTextResponses] = useState<TextResponse[]>([]);
  const [overallComment, setOverallComment] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [hasCycleQuestions, setHasCycleQuestions] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

        // Determine what reviewer role the current user would have
        let currentReviewerRole = "peer";
        if (assignmentData.assignment_type === "upward" && appUserId === assignmentData.reviewer_id) {
          currentReviewerRole = "upward";
        } else if (appUserId === assignmentData.employee_id) {
          currentReviewerRole = "self";
        } else if (appUserId === assignmentData.manager_id) {
          currentReviewerRole = "manager";
        }

        // Check if already submitted FOR THIS SPECIFIC ROLE
        // (A user can be both employee and manager on the same assignment,
        //  so we must check per-role, not just per-reviewer)
        const { data: existingResponses } = await supabase
          .from("review_responses")
          .select("id")
          .eq("assignment_id", assignmentId)
          .eq("reviewer_id", appUserId)
          .eq("reviewer_role", currentReviewerRole)
          .limit(1);

        if (existingResponses && existingResponses.length > 0) {
          setAlreadySubmitted(true);
          return; // No need to load questions
        }

        // ==========================================
        // Load questions from cycle_questions FIRST
        // ==========================================
        const { data: cycleQs } = await supabase
          .from("cycle_questions")
          .select(`
            id, question_type, competency_id, prompt, sort_order, required,
            competency:competencies(id, name, category)
          `)
          .eq("cycle_id", cycleId)
          .order("sort_order");

        if (cycleQs && cycleQs.length > 0) {
          setHasCycleQuestions(true);

          // Competency questions from cycle config
          const compRatings: CompetencyRating[] = [];
          const txtResponses: TextResponse[] = [];

          // If employee has a level, fetch expected_levels and behavioral_indicators for enrichment
          const levelId = assignmentData.employee?.level_id;
          let expectedMap: Record<string, number> = {};
          let behaviorsMap: Record<string, string[]> = {};
          if (levelId) {
            const { data: levelComps } = await supabase
              .from("level_competencies")
              .select("competency_id, expected_level, behavioral_indicators")
              .eq("level_id", levelId);
            if (levelComps) {
              for (const lc of levelComps) {
                expectedMap[lc.competency_id] = lc.expected_level;
                behaviorsMap[lc.competency_id] = Array.isArray(lc.behavioral_indicators)
                  ? lc.behavioral_indicators
                  : [];
              }
            }
          }

          for (const q of cycleQs) {
            if (q.question_type === "competency" && q.competency) {
              const comp = q.competency as any;
              compRatings.push({
                competency_id: comp.id,
                name: comp.name,
                category: comp.category,
                expected_level: expectedMap[comp.id] ?? null,
                behaviors: behaviorsMap[comp.id] ?? [],
                rating: null,
                comment: "",
              });
            } else if (q.question_type === "text") {
              txtResponses.push({
                questionId: q.id,
                prompt: q.prompt || "Additional comments",
                required: q.required,
                response: "",
              });
            }
          }

          // Restore saved draft (merge ratings/comments from localStorage)
          try {
            const saved = localStorage.getItem(`review-draft-${assignmentId}`);
            if (saved) {
              const draft = JSON.parse(saved);
              if (draft.competencies) {
                for (const comp of compRatings) {
                  const savedComp = draft.competencies.find((d: any) => d.competency_id === comp.competency_id);
                  if (savedComp) {
                    comp.rating = savedComp.rating ?? comp.rating;
                    comp.comment = savedComp.comment ?? comp.comment;
                  }
                }
              }
              if (draft.textResponses) {
                for (const tq of txtResponses) {
                  const savedTq = draft.textResponses.find((d: any) => d.questionId === tq.questionId);
                  if (savedTq) tq.response = savedTq.response ?? tq.response;
                }
              }
              if (draft.overallComment) setOverallComment(draft.overallComment);
              setLastSaved(new Date());
              setAutosaveStatus("saved");
            }
          } catch { /* ignore */ }

          setCompetencies(compRatings);
          setTextResponses(txtResponses);
        } else {
          // ==========================================
          // FALLBACK: Legacy behavior (no cycle_questions configured)
          // Load from level_competencies or all competencies
          // ==========================================
          setHasCycleQuestions(false);
          const levelId = assignmentData.employee?.level_id;
          let competencyData: CompetencyRating[] = [];

          if (levelId) {
            const { data: levelComps } = await supabase
              .from("level_competencies")
              .select(`
                expected_level, behavioral_indicators,
                competency:competencies!level_competencies_competency_id_fkey(id, name, category)
              `)
              .eq("level_id", levelId);

            if (levelComps && levelComps.length > 0) {
              competencyData = levelComps.map((lc: any) => ({
                competency_id: lc.competency.id,
                name: lc.competency.name,
                category: lc.competency.category,
                expected_level: lc.expected_level,
                behaviors: Array.isArray(lc.behavioral_indicators) ? lc.behavioral_indicators : [],
                rating: null,
                comment: "",
              }));
            }
          }

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
              behaviors: [],
              rating: null,
              comment: "",
            }));
          }

          // Restore saved draft for fallback path
          try {
            const saved = localStorage.getItem(`review-draft-${assignmentId}`);
            if (saved) {
              const draft = JSON.parse(saved);
              if (draft.competencies) {
                for (const comp of competencyData) {
                  const savedComp = draft.competencies.find((d: any) => d.competency_id === comp.competency_id);
                  if (savedComp) {
                    comp.rating = savedComp.rating ?? comp.rating;
                    comp.comment = savedComp.comment ?? comp.comment;
                  }
                }
              }
              if (draft.overallComment) setOverallComment(draft.overallComment);
              setLastSaved(new Date());
              setAutosaveStatus("saved");
            }
          } catch { /* ignore */ }

          setCompetencies(competencyData);
        }
      } catch (err) {
        setError("Failed to load review data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [assignmentId, cycleId]);

  // Autosave to localStorage whenever form data changes
  useEffect(() => {
    if (loading || alreadySubmitted || competencies.length === 0) return;

    setAutosaveStatus("saving");
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);

    autosaveTimer.current = setTimeout(() => {
      try {
        const draft = { competencies, textResponses, overallComment };
        localStorage.setItem(`review-draft-${assignmentId}`, JSON.stringify(draft));
        setLastSaved(new Date());
        setAutosaveStatus("saved");
      } catch {
        setAutosaveStatus("idle");
      }
    }, 800);

    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [competencies, textResponses, overallComment]); // eslint-disable-line react-hooks/exhaustive-deps

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

  function setTextResponse(idx: number, response: string) {
    setTextResponses((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], response };
      return updated;
    });
  }

  // Determine reviewer role
  function getReviewerRole(): string {
    if (!currentUser || !assignment) return "peer";
    if (assignment.assignment_type === "upward" && currentUser.id === assignment.reviewer_id) return "upward";
    if (currentUser.id === assignment.employee_id) return "self";
    if (currentUser.id === assignment.manager_id) return "manager";
    return "peer";
  }

  async function handleSubmit() {
    if (!currentUser?.id || !assignment) return;

    // Validate required text questions
    for (const tq of textResponses) {
      if (tq.required && !tq.response.trim()) {
        setError(`Please answer: "${tq.prompt}"`);
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const reviewerRole = getReviewerRole();
      const responses: any[] = [];

      // Competency responses
      for (const c of competencies) {
        if (c.rating !== null) {
          responses.push({
            assignment_id: assignmentId,
            reviewer_id: currentUser.id,
            reviewer_role: reviewerRole,
            competency_id: c.competency_id,
            rating: c.rating,
            comment: c.comment || null,
          });
        }
      }

      // Text question responses (stored with competency_id = null)
      for (const tq of textResponses) {
        if (tq.response.trim()) {
          responses.push({
            assignment_id: assignmentId,
            reviewer_id: currentUser.id,
            reviewer_role: reviewerRole,
            competency_id: null,
            rating: null,
            comment: `[${tq.prompt}] ${tq.response}`,
          });
        }
      }

      // Overall comment (non-cycle-questions fallback field)
      if (overallComment.trim() && !hasCycleQuestions) {
        responses.push({
          assignment_id: assignmentId,
          reviewer_id: currentUser.id,
          reviewer_role: reviewerRole,
          competency_id: null,
          rating: null,
          comment: overallComment,
        });
      }

      if (responses.length === 0) {
        setError("Please rate at least one competency or answer at least one question");
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

      // Update assignment status
      if (reviewerRole === "manager" || reviewerRole === "upward") {
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
        await supabase
          .from("review_assignments")
          .update({ status: "in_progress" })
          .eq("id", assignmentId)
          .eq("status", "pending");
      }

      // Clear the autosave draft on successful submission
      try { localStorage.removeItem(`review-draft-${assignmentId}`); } catch { /* ignore */ }

      router.push(`/dashboard/cycles/${cycleId}`);
      router.refresh();
    } catch (err) {
      setError("Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  }

  // ====================================
  // RENDER
  // ====================================

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
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {getReviewerRole() === "upward" ? "Submit Upward Feedback" : "Submit Review"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Reviewing as <Badge variant="outline" className="ml-1">{getReviewerRole()}</Badge>
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
        <Card className="border-border/60">
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
      {competencies.length > 0 && (
        <Card className="border-border/60">
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
      )}

      {/* Competency Ratings by Category */}
      {competencies.length > 0 && (
        <>
          {categories.map((category) => (
            <Card key={category} className="border-border/60">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  {category}
                </CardTitle>
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
                        <BehaviorsPanel
                          behaviors={comp.behaviors}
                          expectedLevel={comp.expected_level}
                        />
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
        </>
      )}

      {/* Text Questions (from cycle_questions) */}
      {textResponses.length > 0 && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Open-Ended Questions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {textResponses.map((tq, idx) => (
              <div key={tq.questionId} className="space-y-2">
                <Label className="text-sm font-medium">
                  {tq.prompt}
                  {tq.required && <span className="text-destructive ml-0.5">*</span>}
                </Label>
                <Textarea
                  placeholder="Your response..."
                  value={tq.response}
                  onChange={(e) => setTextResponse(idx, e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* No questions configured at all */}
      {competencies.length === 0 && textResponses.length === 0 && (
        <Card className="border-border/60">
          <CardContent className="pt-6 text-center text-muted-foreground">
            No review questions configured for this cycle. Please ask an admin to set up competencies or review questions.
          </CardContent>
        </Card>
      )}

      {/* Overall Comment (fallback for cycles without cycle_questions) */}
      {!hasCycleQuestions && (
        <Card className="border-border/60">
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
      )}

      {/* Submit */}
      <div className="flex items-center justify-between pb-8">
        {/* Autosave indicator */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {autosaveStatus === "saving" && (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Saving draft…</span>
            </>
          )}
          {autosaveStatus === "saved" && lastSaved && (
            <>
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              <span>Draft saved {formatDistanceToNow(lastSaved, { addSuffix: true })}</span>
            </>
          )}
          {autosaveStatus === "idle" && !lastSaved && (
            <>
              <Clock className="h-3 w-3" />
              <span>Changes autosave as you go</span>
            </>
          )}
        </div>

        <div className="flex gap-3">
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
    </div>
  );
}
