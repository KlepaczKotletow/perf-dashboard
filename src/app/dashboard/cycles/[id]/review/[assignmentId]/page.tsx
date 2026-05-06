"use client";

// IMPORTANT (anchoring-bias guard): when this form ever gains a context panel
// showing other reviewers' responses (e.g. manager seeing peer/self/upward
// data alongside their own draft), DO NOT display rating *numbers* — only
// comments. Harvard Kennedy School's 2025 natural experiment found managers
// score employees lower (especially women and women of colour, who self-rate
// lowest) when they see self-evaluation scores while drafting. Lattice's
// own bias playbook recommends restricting manager access to peer/self
// scores during the review process. Comments alone preserve evidence value
// without anchoring on a numeric prior.
//   - HKS: https://www.hks.harvard.edu/faculty-research/policy-topics/gender-race-identity/self-ratings-and-bias-performance-reviews
//   - Lattice: https://lattice.com/library/combatting-anchor-bias-in-performance-reviews

import { useState, useEffect, useRef, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { ArrowLeft, Loader2, Send, Star, CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";
import { BehaviorsPanel } from "@/components/behaviors-panel";
import { formatDistanceToNow } from "date-fns";
import { getClientIdentity } from "@/lib/client-auth";

interface CompetencyRating {
  competency_id: string;
  name: string;
  description: string | null;
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
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  type AssignmentState = {
    id: string;
    employee_id: string;
    manager_id: string | null;
    reviewer_id: string | null;
    assignment_type: string | null;
    status: string;
    cycle_id: string;
    overall_rating: number | null;
    cycle?: { id: string; name: string; status: string; review_deadline: string | null } | null;
  };
  type EmployeeState = {
    id: string;
    slack_name: string | null;
    job_title: string | null;
    department: string | null;
    avatar_url: string | null;
    level_id: string | null;
    level?: { id: string; name: string; grade: string | null; job_family?: { name: string } | { name: string }[] | null } | null;
  };
  type CurrentUserState = { id: string; workspace_id: string | null; role: string | null; slack_name: string | null };

  const [assignment, setAssignment] = useState<AssignmentState | null>(null);
  const [employee, setEmployee] = useState<EmployeeState | null>(null);
  const [competencies, setCompetencies] = useState<CompetencyRating[]>([]);
  const [textResponses, setTextResponses] = useState<TextResponse[]>([]);
  const [overallComment, setOverallComment] = useState("");
  const [currentUser, setCurrentUser] = useState<CurrentUserState | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [hasCycleQuestions, setHasCycleQuestions] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [maxRating, setMaxRating] = useState(5);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Get current user via secure DB lookup (never trust user_metadata)
        const identity = await getClientIdentity(supabase);
        if (!identity) {
          setError("Not authenticated");
          return;
        }
        const appUserId = identity.userId;
        setCurrentUser({ id: appUserId, workspace_id: identity.workspaceId, role: identity.role, slack_name: identity.slackName });

        // Fetch workspace rating scale
        const wsId = identity.workspaceId;
        if (wsId) {
          const { data: wsData } = await supabase
            .from("workspaces")
            .select("rating_scale")
            .eq("id", wsId)
            .single();
          if (wsData?.rating_scale?.max) {
            setMaxRating(wsData.rating_scale.max);
          }
        }

        // Load assignment
        const { data: assignmentData, error: assignmentError } = await supabase
          .from("review_assignments")
          .select(`
            *,
            employee:users!review_assignments_employee_id_fkey(
              id, slack_name, slack_email, job_title, department, level_id,
              level:levels!users_level_id_fkey(id, name, grade, job_family:job_families(name))
            ),
            manager:users!review_assignments_manager_id_fkey(id, slack_name),
            cycle:performance_cycles!review_assignments_cycle_id_fkey(id, name, status)
          `)
          .eq("id", assignmentId)
          .single();

        if (assignmentError || !assignmentData) {
          setError("Assignment not found");
          return;
        }

        const empData = (Array.isArray(assignmentData.employee) ? assignmentData.employee[0] : assignmentData.employee) as EmployeeState | undefined;
        setAssignment(assignmentData as unknown as AssignmentState);
        setEmployee(empData ?? null);

        // Verify assignment belongs to current workspace
        if (wsId) {
          const { data: cycleWs } = await supabase
            .from("performance_cycles")
            .select("workspace_id")
            .eq("id", cycleId)
            .single();
          if (cycleWs && cycleWs.workspace_id !== wsId) {
            setError("You don't have access to this review.");
            setLoading(false);
            return;
          }
        }

        // Block submission if cycle is no longer active
        const cycleStatus = (Array.isArray(assignmentData.cycle) ? assignmentData.cycle[0]?.status : (assignmentData as { cycle?: { status?: string } }).cycle?.status);
        if (cycleStatus && cycleStatus !== "active") {
          setError(`This review cycle is ${cycleStatus} and no longer accepting submissions.`);
          setLoading(false);
          return;
        }

        // Determine what reviewer role the current user would have
        let currentReviewerRole = "peer";
        if (assignmentData.assignment_type === "upward" && appUserId === assignmentData.reviewer_id) {
          currentReviewerRole = "upward";
        } else if (appUserId === assignmentData.employee_id) {
          currentReviewerRole = "self";
        } else if (appUserId === assignmentData.manager_id) {
          currentReviewerRole = "manager";
        }

        // Phase lock: the review phase matching the reviewer role must be active.
        // Mirrors Lattice / Leapsome — submissions hard-block once a phase closes,
        // but the autosave draft is preserved so HR can reopen without data loss.
        const requiredPhaseType =
          currentReviewerRole === "self" ? "self_assessment"
          : currentReviewerRole === "peer" ? "peer_review"
          : "manager_review"; // manager + upward
        const { data: activePhase } = await supabase
          .from("cycle_phases")
          .select("phase_type, name, end_date")
          .eq("cycle_id", assignmentData.cycle_id)
          .eq("phase_type", requiredPhaseType)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();
        if (!activePhase) {
          setError(
            `The ${requiredPhaseType.replace("_", " ")} phase is not active right now, so this review can't be submitted. ` +
            `Your draft is saved — contact your admin to reopen the phase or wait for the next one.`,
          );
          setLoading(false);
          return;
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
            competency:competencies(id, name, category, description)
          `)
          .eq("cycle_id", cycleId)
          .order("sort_order");

        if (cycleQs && cycleQs.length > 0) {
          setHasCycleQuestions(true);

          // Competency questions from cycle config
          const compRatings: CompetencyRating[] = [];
          const txtResponses: TextResponse[] = [];

          // If employee has a level, fetch expected_levels and behavioral_indicators for enrichment
          const levelId = empData?.level_id;
          const expectedMap: Record<string, number> = {};
          const behaviorsMap: Record<string, string[]> = {};
          if (levelId) {
            const { data: levelComps } = await supabase
              .from("level_competencies")
              .select("competency_id, expected_level, behavioral_indicators")
              .eq("level_id", levelId)
              .eq("workspace_id", wsId);
            if (levelComps) {
              for (const lc of levelComps) {
                expectedMap[lc.competency_id] = lc.expected_level;
                behaviorsMap[lc.competency_id] = Array.isArray(lc.behavioral_indicators)
                  ? lc.behavioral_indicators
                  : [];
              }
            }
          }

          type CycleQ = { id: string; question_type: string; prompt: string | null; required: boolean | null; competency: { id: string; name: string; category: string | null; description: string | null } | { id: string; name: string; category: string | null; description: string | null }[] | null };
          for (const q of (cycleQs as CycleQ[])) {
            if (q.question_type === "competency" && q.competency) {
              const comp = Array.isArray(q.competency) ? q.competency[0] : q.competency;
              if (!comp) continue;
              compRatings.push({
                competency_id: comp.id,
                name: comp.name,
                description: comp.description || null,
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
                required: q.required ?? false,
                response: "",
              });
            }
          }

          // Restore saved draft (merge ratings/comments from localStorage).
          // Key is scoped to (assignment, user) so drafts never leak between
          // users on a shared device — matches Lattice / Leapsome behaviour.
          try {
            const saved = localStorage.getItem(`review-draft-${assignmentId}-${appUserId}`);
            if (saved) {
              const draft = JSON.parse(saved);
              type DraftComp = { competency_id: string; rating?: number | null; comment?: string };
              type DraftText = { questionId: string; response?: string };
              if (draft.competencies) {
                for (const comp of compRatings) {
                  const savedComp = (draft.competencies as DraftComp[]).find((d) => d.competency_id === comp.competency_id);
                  if (savedComp) {
                    comp.rating = savedComp.rating ?? comp.rating;
                    comp.comment = savedComp.comment ?? comp.comment;
                  }
                }
              }
              if (draft.textResponses) {
                for (const tq of txtResponses) {
                  const savedTq = (draft.textResponses as DraftText[]).find((d) => d.questionId === tq.questionId);
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
          const levelId = empData?.level_id;
          let competencyData: CompetencyRating[] = [];

          type LevelCompFallback = {
            expected_level: number;
            behavioral_indicators: string[] | null;
            competency: { id: string; name: string; category: string | null; description: string | null } | { id: string; name: string; category: string | null; description: string | null }[] | null;
          };

          if (levelId) {
            const { data: levelComps } = await supabase
              .from("level_competencies")
              .select(`
                expected_level, behavioral_indicators,
                competency:competencies!level_competencies_competency_id_fkey(id, name, category, description)
              `)
              .eq("level_id", levelId)
              .eq("workspace_id", wsId);

            if (levelComps && levelComps.length > 0) {
              competencyData = (levelComps as unknown as LevelCompFallback[]).map((lc) => {
                const comp = Array.isArray(lc.competency) ? lc.competency[0] : lc.competency;
                return {
                  competency_id: comp?.id ?? "",
                  name: comp?.name ?? "",
                  description: comp?.description || null,
                  category: comp?.category ?? null,
                  expected_level: lc.expected_level,
                  behaviors: Array.isArray(lc.behavioral_indicators) ? lc.behavioral_indicators : [],
                  rating: null,
                  comment: "",
                };
              });
            }
          }

          if (competencyData.length === 0 && wsId) {
            const { data: allComps } = await supabase
              .from("competencies")
              .select("id, name, category, description")
              .eq("workspace_id", wsId)
              .order("category, name");

            type CompetencyOnly = { id: string; name: string; category: string | null; description: string | null };
            competencyData = ((allComps || []) as CompetencyOnly[]).map((c) => ({
              competency_id: c.id,
              name: c.name,
              description: c.description || null,
              category: c.category,
              expected_level: null,
              behaviors: [],
              rating: null,
              comment: "",
            }));
          }

          // Restore saved draft for fallback path (also user-scoped).
          try {
            const saved = localStorage.getItem(`review-draft-${assignmentId}-${appUserId}`);
            if (saved) {
              const draft = JSON.parse(saved);
              type DraftComp = { competency_id: string; rating?: number | null; comment?: string };
              if (draft.competencies) {
                for (const comp of competencyData) {
                  const savedComp = (draft.competencies as DraftComp[]).find((d) => d.competency_id === comp.competency_id);
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
      } catch {
        setError("Failed to load review data");
      } finally {
        setLoading(false);
      }
    }
    load();
    // supabase is intentionally omitted — it's recreated on every render and
    // including it would re-run the loader on every render. The data only
    // depends on the URL params.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, cycleId]);

  // Autosave to localStorage whenever form data changes
  useEffect(() => {
    if (loading || alreadySubmitted || competencies.length === 0) return;

    setAutosaveStatus("saving");
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);

    autosaveTimer.current = setTimeout(() => {
      // Skip autosave if we don't yet know who the user is — writing a
      // draft without a user scope risks leaking it to the next user on
      // a shared device.
      if (!currentUser?.id) return;
      try {
        const draft = { competencies, textResponses, overallComment };
        localStorage.setItem(`review-draft-${assignmentId}-${currentUser.id}`, JSON.stringify(draft));
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

  // Warn before unload if the user has unsubmitted content. The draft is in
  // localStorage but not persisted to the DB until they click Submit — users
  // historically assumed "Saved 2s ago" meant submitted and lost work.
  useEffect(() => {
    if (alreadySubmitted || submitting) return;
    const hasContent =
      competencies.some((c) => c.rating !== null || (c.comment && c.comment.trim())) ||
      textResponses.some((t) => t.response.trim()) ||
      overallComment.trim().length > 0;
    if (!hasContent) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore the returned string and show their own copy,
      // but returnValue must be set for the dialog to appear at all.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [competencies, textResponses, overallComment, alreadySubmitted, submitting]);

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
      type ResponseInsert = {
        assignment_id: string;
        reviewer_id: string;
        reviewer_role: string;
        competency_id: string | null;
        rating: number | null;
        comment: string | null;
      };
      const responses: ResponseInsert[] = [];

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
        const code = (insertError as { code?: string }).code;
        if (code === "42501") {
          setError(
            "You are not authorized to submit this review in this role. " +
              "If you believe this is wrong, refresh the page and try again.",
          );
          setSubmitting(false);
          return;
        }
        if (code === "23505") {
          // Unique constraint on (assignment_id, reviewer_id, reviewer_role, competency_id)
          // — the review was already submitted. Treat as success: clear draft and redirect.
          try { localStorage.removeItem(`review-draft-${assignmentId}-${currentUser?.id ?? ""}`); } catch { /* ignore */ }
          const fromCycle = searchParams.get("from") === "cycle";
          const fromCycleId = searchParams.get("cycleId");
          if (fromCycle && fromCycleId) {
            router.push(`/dashboard/cycles/${fromCycleId}`);
          } else {
            router.push(`/dashboard/performance`);
          }
          router.refresh();
          return;
        }
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

        // Fire-and-forget: notify manager that self-review is done
        supabase.functions.invoke("cycle-notifications", {
          body: { action: "self_submitted", assignment_id: assignmentId },
        }).catch(() => {}); // intentionally ignored — non-blocking
      }

      // Clear the autosave draft on successful submission
      try { localStorage.removeItem(`review-draft-${assignmentId}-${currentUser?.id ?? ""}`); } catch { /* ignore */ }

      const fromCycle = searchParams.get("from") === "cycle";
      const fromCycleId = searchParams.get("cycleId");
      if (fromCycle && fromCycleId) {
        router.push(`/dashboard/cycles/${fromCycleId}`);
      } else {
        router.push(`/dashboard/performance`);
      }
      router.refresh();
    } catch {
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
      <div className="max-w-lg mx-auto py-16 text-center space-y-4">
        <div className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-400/10 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">Already submitted</h1>
        <p className="text-sm text-muted-foreground">
          You&apos;ve already submitted your review for this assignment.
        </p>
        <Button asChild className="mt-2">
          <Link href="/dashboard/performance">Go to Performance</Link>
        </Button>
      </div>
    );
  }

  const categories = [...new Set(competencies.map((c) => c.category || "General"))];
  const ratedCount = competencies.filter((c) => c.rating !== null).length;
  const reviewerRole = getReviewerRole();
  const roleLabel =
    reviewerRole === "self" ? "Self-review" :
    reviewerRole === "manager" ? "Manager review" :
    reviewerRole === "upward" ? "Upward feedback" : "Peer review";

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-10">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 pt-1">
        <Button variant="ghost" size="icon" className="shrink-0 mt-0.5" asChild>
          <Link href="/dashboard/performance">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{roleLabel}</h1>
          {employee && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {employee.slack_name}
              {(employee.job_title || employee.department) && (
                <span className="text-muted-foreground/60">
                  {" · "}
                  {[employee.job_title, employee.department].filter(Boolean).join(", ")}
                </span>
              )}
            </p>
          )}
        </div>
        {/* Progress pill — only when there are competency ratings */}
        {competencies.length > 0 && (
          <div className="shrink-0 text-xs font-medium text-muted-foreground bg-muted rounded-full px-3 py-1.5">
            {ratedCount}/{competencies.length} rated
          </div>
        )}
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20">
          {error}
        </div>
      )}

      {/* ── Rating scale reference — tiny, inline ────────────────────── */}
      {competencies.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground/70 px-1">
          {["Below", "Developing", "Meets", "Exceeds", "Outstanding"].map((label, i) => (
            <span key={i}><span className="font-semibold text-foreground/50">{i + 1}</span> — {label}</span>
          ))}
        </div>
      )}

      {/* ── Competencies ─────────────────────────────────────────────── */}
      {competencies.length > 0 && categories.map((category) => (
        <Card key={category} className="border-border/60">
          {/* Category label only when there are multiple categories */}
          {categories.length > 1 && (
            <div className="px-5 pt-4 pb-0">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {category}
              </p>
            </div>
          )}
          <CardContent className={`space-y-7 ${categories.length > 1 ? "pt-3 pb-5" : "pt-5 pb-5"}`}>
            {competencies
              .filter((c) => (c.category || "General") === category)
              .map((comp, localIdx) => {
                const compIdx = competencies.indexOf(comp);
                return (
                  <div key={comp.competency_id} className={`space-y-3 ${localIdx > 0 ? "pt-7 border-t border-border/40" : ""}`}>
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-[15px] font-medium text-foreground leading-snug">
                          {comp.name}
                        </Label>
                        {comp.expected_level && (
                          <Badge variant="secondary" className="text-[10px] shrink-0">
                            Target: {comp.expected_level}/{maxRating}
                          </Badge>
                        )}
                      </div>
                      {comp.description && (
                        <p className="text-sm text-muted-foreground mt-1">{comp.description}</p>
                      )}
                    </div>
                    <BehaviorsPanel
                      behaviors={comp.behaviors}
                      expectedLevel={comp.expected_level}
                    />
                    {/* Stars — larger tap targets for mobile */}
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: maxRating }, (_, i) => i + 1).map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(compIdx, star)}
                          className="p-1 focus:outline-none transition-colors rounded"
                          aria-label={`Rate ${star} out of ${maxRating}`}
                        >
                          <Star
                            className={`h-8 w-8 ${
                              comp.rating && star <= comp.rating
                                ? "fill-amber-400 text-amber-400"
                                : "text-border hover:text-amber-300"
                            }`}
                          />
                        </button>
                      ))}
                      {comp.rating && (
                        <span className="ml-2 text-sm font-medium text-muted-foreground">
                          {["Below expectations", "Developing", "Meets expectations", "Exceeds expectations", "Outstanding"][comp.rating - 1] || ""}
                        </span>
                      )}
                    </div>
                    <Textarea
                      placeholder={`Comment on ${comp.name} (optional)…`}
                      value={comp.comment}
                      onChange={(e) => setComment(compIdx, e.target.value)}
                      className="min-h-[72px] text-sm resize-none"
                      maxLength={5000}
                    />
                  </div>
                );
              })}
          </CardContent>
        </Card>
      ))}

      {/* ── Text Questions ───────────────────────────────────────────── */}
      {textResponses.length > 0 && (
        <Card className="border-border/60">
          <CardContent className="pt-5 pb-5 space-y-6">
            {textResponses.map((tq, idx) => (
              <div key={tq.questionId} className={`space-y-2 ${idx > 0 ? "pt-6 border-t border-border/40" : ""}`}>
                <Label className="text-[15px] font-medium leading-snug">
                  {tq.prompt}
                  {tq.required && <span className="text-destructive ml-0.5">*</span>}
                </Label>
                <Textarea
                  placeholder="Your response…"
                  value={tq.response}
                  onChange={(e) => setTextResponse(idx, e.target.value)}
                  className="min-h-[100px] text-sm resize-none"
                  maxLength={5000}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Overall comment (fallback) ───────────────────────────────── */}
      {!hasCycleQuestions && (
        <Card className="border-border/60">
          <CardContent className="pt-5 pb-5 space-y-2">
            <Label className="text-[15px] font-medium">Overall comments</Label>
            <p className="text-xs text-muted-foreground">Strengths, areas for improvement, anything else you want to share.</p>
            <Textarea
              placeholder="Write your assessment…"
              value={overallComment}
              onChange={(e) => setOverallComment(e.target.value)}
              className="min-h-[120px] text-sm resize-none"
              maxLength={5000}
            />
          </CardContent>
        </Card>
      )}

      {/* ── No questions configured ──────────────────────────────────── */}
      {competencies.length === 0 && textResponses.length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No review questions configured for this cycle. Ask an admin to set up competencies or questions.
        </div>
      )}

      {/* ── Submit row ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {autosaveStatus === "saving" && (
            <><Loader2 className="h-3 w-3 animate-spin" /><span>Saving draft…</span></>
          )}
          {autosaveStatus === "saved" && lastSaved && (
            <><CheckCircle2 className="h-3 w-3 text-emerald-500" /><span>Draft saved {formatDistanceToNow(lastSaved, { addSuffix: true })} · click Submit to finalise</span></>
          )}
          {autosaveStatus === "idle" && !lastSaved && (
            <><Clock className="h-3 w-3" /><span>Draft autosaves as you type — Submit when done</span></>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/performance">Cancel</Link>
          </Button>
          <Button
            size="sm"
            onClick={() => {
              // Run the cheap validations before opening the confirm so we
              // don't show a "Submit for real?" dialog that will immediately
              // reject itself.
              for (const tq of textResponses) {
                if (tq.required && !tq.response.trim()) {
                  setError(`Please answer: "${tq.prompt}"`);
                  return;
                }
              }
              setError(null);
              setConfirmOpen(true);
            }}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
            Submit
          </Button>
        </div>
      </div>

      {/* Final confirmation dialog — review submission is irreversible.
          Summarises the filled ratings + any required-text check so the
          reviewer can eyeball before committing. Matches Lattice's
          "one more look" confirmation pattern. */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit this review?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Once submitted, you can&apos;t edit or re-submit — so this is the moment to double-check.
                </p>
                <p>
                  You&apos;ve rated{" "}
                  <span className="font-medium text-foreground">
                    {competencies.filter((c) => c.rating !== null).length} of {competencies.length}
                  </span>{" "}
                  competencies
                  {textResponses.length > 0 && (
                    <>
                      {" "}and answered{" "}
                      <span className="font-medium text-foreground">
                        {textResponses.filter((t) => t.response.trim()).length} of {textResponses.length}
                      </span>{" "}
                      questions
                    </>
                  )}
                  .
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setConfirmOpen(false);
                await handleSubmit();
              }}
              disabled={submitting}
            >
              {submitting ? "Submitting…" : "Submit review"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
