"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft, ArrowRight, AlertTriangle, Loader2, Plus, X, Target, MessageSquare,
  Users, CalendarIcon, ChevronDown, ChevronRight, Play, Search, Check, Bot, Sparkles,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { format } from "date-fns";

const CYCLE_TYPES = [
  { value: "annual", label: "Annual Review" },
  { value: "mid_year", label: "Mid-Year Review" },
  { value: "quarterly", label: "Quarterly Review" },
  { value: "probation", label: "Probation Review" },
  { value: "custom", label: "Custom" },
];

const DEFAULT_PHASES = [
  { phase_type: "goal_setting",    name: "Goal Setting",          proportion: 2 / 12 },
  { phase_type: "self_assessment", name: "Self Assessment",        proportion: 2 / 12 },
  { phase_type: "peer_review",     name: "Peer Review",            proportion: 3 / 12 },
  { phase_type: "manager_review",  name: "Manager Review",         proportion: 2 / 12 },
  { phase_type: "calibration",     name: "Calibration",            proportion: 1 / 12 },
  { phase_type: "communication",   name: "Results Communication",  proportion: 2 / 12 },
];

const SUGGESTED_QUESTIONS = [
  "What were this person's key achievements this period?",
  "What areas should they focus on improving?",
  "How did they demonstrate company values?",
  "Any additional comments or recommendations?",
];

const STEP_LABELS = ["Basics & Dates", "People", "Questions", "Nami Bot", "Review & Launch"];

interface User {
  id: string;
  slack_name: string | null;
  slack_email: string | null;
  slack_user_id: string | null;
  manager_id: string | null;
}
interface Competency {
  id: string;
  name: string;
  category: string | null;
}
interface TextQuestion {
  prompt: string;
  required: boolean;
}
interface Template {
  id: string;
  name: string;
  description: string | null;
  questions: { type: string; prompt: string; required?: boolean }[];
  is_system: boolean;
}
interface CycleProfile {
  id: string;
  name: string;
  description: string | null;
  content: {
    cycle_type?: string;
    suggested_description?: string;
    suggested_competency_categories?: string[];
    review_template_name?: string;
    phase_weights?: number[];
  };
  is_system: boolean;
}

// ── Reusable date picker field ─────────────────────────────────────────────────
function DatePickerField({
  label, value, onChange, placeholder = "Pick a date", optional, fromDate, error: fieldError,
}: {
  label: string;
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
  placeholder?: string;
  optional?: boolean;
  fromDate?: Date;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}
        {optional && <span className="text-muted-foreground/60 ml-1">(optional)</span>}
      </Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={`w-full justify-start text-left font-normal h-9 text-sm ${!value ? "text-muted-foreground" : ""} ${fieldError ? "border-destructive" : ""}`}
          >
            <CalendarIcon className="h-3.5 w-3.5 mr-2 shrink-0 text-muted-foreground" />
            {value ? format(value, "MMM d, yyyy") : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={value} onSelect={onChange} initialFocus fromDate={fromDate} />
        </PopoverContent>
      </Popover>
      {fieldError && <p className="text-xs text-destructive">{fieldError}</p>}
    </div>
  );
}

// ── Step indicator bar ────────────────────────────────────────────────────────
function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-between mb-10">
      {STEP_LABELS.map((label, idx) => {
        const stepNum = idx + 1;
        const isCompleted = stepNum < currentStep;
        const isCurrent = stepNum === currentStep;
        return (
          <div key={label} className="flex items-center flex-1 last:flex-initial">
            <div className="flex flex-col items-center">
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors ${
                  isCompleted
                    ? "bg-primary border-primary text-primary-foreground"
                    : isCurrent
                    ? "border-primary text-primary bg-primary/10"
                    : "border-border text-muted-foreground bg-background"
                }`}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : stepNum}
              </div>
              <span className={`text-xs mt-2 whitespace-nowrap ${isCurrent ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                {label}
              </span>
            </div>
            {idx < STEP_LABELS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-3 mt-[-14px] ${isCompleted ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Phase timeline preview ───────────────────────────────────────────────────
function PhaseTimelinePreview({ startDate, endDate }: { startDate?: Date; endDate?: Date }) {
  if (!startDate || !endDate || endDate <= startDate) return null;
  const colors = [
    "bg-blue-400", "bg-indigo-400", "bg-purple-400",
    "bg-pink-400", "bg-amber-400", "bg-emerald-400",
  ];
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Phase Timeline Preview</Label>
      <div className="flex h-10 rounded-lg overflow-hidden border border-border/60">
        {DEFAULT_PHASES.map((phase, idx) => (
          <div
            key={phase.phase_type}
            className={`${colors[idx]} flex items-center justify-center`}
            style={{ width: `${phase.proportion * 100}%` }}
            title={phase.name}
          >
            <span className="text-[11px] text-white font-semibold truncate px-1">
              {phase.name.split(" ")[0]}
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{format(startDate, "MMM d")}</span>
        <span>{format(endDate, "MMM d, yyyy")}</span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function NewCyclePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [stepError, setStepError] = useState<string | null>(null);

  // Core fields
  const [name, setName] = useState("");
  const [cycleType, setCycleType] = useState("annual");
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 3); return d;
  });
  const [reviewDeadline, setReviewDeadline] = useState<Date | undefined>();
  const [description, setDescription] = useState("");
  const [showDescription, setShowDescription] = useState(false);

  // People
  const [users, setUsers] = useState<User[]>([]);
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<string[]>([]);
  const [peopleSearch, setPeopleSearch] = useState("");

  // Questions
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [selectedCompIds, setSelectedCompIds] = useState<Set<string>>(new Set());
  const [compOpen, setCompOpen] = useState(true);
  const [textQuestions, setTextQuestions] = useState<TextQuestion[]>([
    { prompt: "What were this person's key achievements this period?", required: true },
    { prompt: "What areas should they focus on improving?", required: true },
    { prompt: "Any additional comments or recommendations?", required: false },
  ]);
  const [newPrompt, setNewPrompt] = useState("");
  const [tqOpen, setTqOpen] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateApplied, setTemplateApplied] = useState<string | null>(null);
  const [cycleProfiles, setCycleProfiles] = useState<CycleProfile[]>([]);
  const [appliedProfileId, setAppliedProfileId] = useState<string | null>(null);

  // Nami config (Step 4)
  const [namiScheduleMode, setNamiScheduleMode] = useState<"now" | "schedule">("now");
  const [namiScheduleDate, setNamiScheduleDate] = useState("");
  const [skipNami, setSkipNami] = useState(false);

  // Draft auto-save
  const [pendingCycleId, setPendingCycleId] = useState<string | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);

  // UI
  const [loading, setLoading] = useState<false | "draft" | "launch">(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Load users + competencies on mount, and restore draft if ?draft=<id> is present
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      const wsId = user?.user_metadata?.workspace_id;
      if (!wsId) return;

      const [{ data: usersData }, { data: compsData }, { data: tplData }, { data: profileData }] = await Promise.all([
        supabase.from("users").select("id, slack_name, slack_email, slack_user_id, manager_id").eq("workspace_id", wsId).order("slack_name"),
        supabase.from("competencies").select("id, name, category").eq("workspace_id", wsId).order("category").order("name"),
        supabase.from("templates").select("id, name, description, questions, is_system").eq("workspace_id", wsId).order("is_system", { ascending: false }).order("name"),
        supabase.from("templates").select("id, name, description, content, is_system").eq("workspace_id", wsId).eq("template_type", "cycle_profile"),
      ]);
      const loadedUsers = usersData || [];
      const loadedComps = compsData || [];
      setUsers(loadedUsers);
      setCompetencies(loadedComps);
      setTemplates((tplData || []) as Template[]);
      const loadedProfiles = (profileData || []) as CycleProfile[];
      setCycleProfiles(loadedProfiles);

      // ── Restore draft if ?draft=<id> ──
      const draftId = searchParams.get("draft");
      if (draftId) {
        const { data: draft } = await supabase
          .from("performance_cycles")
          .select("*")
          .eq("id", draftId)
          .eq("status", "draft")
          .single();

        if (draft) {
          setPendingCycleId(draft.id);
          setName(draft.name || "");
          setCycleType(draft.type || "annual");
          setDescription(draft.description || "");
          if (draft.description) setShowDescription(true);
          if (draft.start_date) setStartDate(new Date(draft.start_date));
          if (draft.end_date) setEndDate(new Date(draft.end_date));
          if (draft.review_deadline) setReviewDeadline(new Date(draft.review_deadline));

          // Restore wizard-specific state from wizard_metadata
          const meta = draft.wizard_metadata as Record<string, any> | null;
          if (meta) {
            if (meta.step && meta.step >= 1 && meta.step <= 5) setStep(meta.step as 1 | 2 | 3 | 4 | 5);
            if (meta.cycleType) setCycleType(meta.cycleType);
            if (Array.isArray(meta.selectedPeopleIds)) {
              setSelectedPeopleIds(meta.selectedPeopleIds);
            } else {
              setSelectedPeopleIds(loadedUsers.map((u: User) => u.id));
            }
            if (Array.isArray(meta.selectedCompIds)) {
              setSelectedCompIds(new Set(meta.selectedCompIds));
            } else {
              setSelectedCompIds(new Set(loadedComps.map((c: Competency) => c.id)));
            }
            if (Array.isArray(meta.textQuestions)) setTextQuestions(meta.textQuestions);
            if (meta.namiScheduleMode) setNamiScheduleMode(meta.namiScheduleMode);
            if (meta.namiScheduleDate !== undefined) setNamiScheduleDate(meta.namiScheduleDate);
            if (meta.skipNami !== undefined) setSkipNami(meta.skipNami);
          } else {
            // No wizard_metadata — use defaults for people/comps
            setSelectedPeopleIds(loadedUsers.map((u: User) => u.id));
            setSelectedCompIds(new Set(loadedComps.map((c: Competency) => c.id)));
          }
          return; // skip default selection below
        }
      }

      // Default selection when not restoring a draft
      setSelectedPeopleIds(loadedUsers.map((u: User) => u.id));
      setSelectedCompIds(new Set(loadedComps.map((c: Competency) => c.id)));

      // ── Auto-apply cycle profile if ?profile=<id> ──
      const profileId = searchParams.get("profile");
      if (profileId && loadedProfiles.length > 0) {
        const profile = loadedProfiles.find((p) => p.id === profileId);
        if (profile) {
          applyCycleProfileFromContent(profile);
        }
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-save draft on step transitions ─────────────────────────────────────
  async function autoSaveDraft() {
    if (!name.trim()) return; // need at least a name
    setAutoSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const workspaceId: string = user.user_metadata?.workspace_id;
      if (!workspaceId) return;

      const wizardMetadata = {
        step,
        cycleType,
        description,
        selectedPeopleIds,
        selectedCompIds: [...selectedCompIds],
        textQuestions,
        namiScheduleMode,
        namiScheduleDate,
        skipNami,
      };

      const coreFields = {
        name: name.trim(),
        description: description.trim() || null,
        type: cycleType,
        start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
        end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
        review_deadline: reviewDeadline ? format(reviewDeadline, "yyyy-MM-dd") : null,
        wizard_metadata: wizardMetadata,
      };

      if (pendingCycleId) {
        // Update existing draft
        await supabase
          .from("performance_cycles")
          .update(coreFields)
          .eq("id", pendingCycleId);
      } else {
        // Create new draft
        const { data: newDraft, error: insertErr } = await supabase
          .from("performance_cycles")
          .insert({
            ...coreFields,
            status: "draft",
            workspace_id: workspaceId,
            created_by: user.user_metadata?.app_user_id,
          })
          .select("id")
          .single();

        if (!insertErr && newDraft) {
          setPendingCycleId(newDraft.id);
          // Update URL to include draft id so browser refresh restores state
          window.history.replaceState(null, "", `/dashboard/cycles/new?draft=${newDraft.id}`);
        }
      }
    } catch (err) {
      console.error("Auto-save draft failed:", err);
    } finally {
      setAutoSaving(false);
    }
  }

  // ── Computed values ──────────────────────────────────────────────────────────
  const selectedPeopleSet = new Set(selectedPeopleIds);
  const usersWithoutSlack = users.filter(u => selectedPeopleSet.has(u.id) && !u.slack_user_id);
  const selectedUsers = users.filter(u => selectedPeopleSet.has(u.id));
  const selfReviewCount = selectedUsers.length;
  const managersWithEmployees = selectedUsers.filter(u => u.manager_id);
  const uniqueManagers = new Set(managersWithEmployees.map(u => u.manager_id));
  const managerReviewCount = uniqueManagers.size;
  const upwardReviewCount = managersWithEmployees.filter(u => u.manager_id && selectedPeopleSet.has(u.manager_id)).length;

  // ── Step validation ─────────────────────────────────────────────────────────
  function handleNextStep(): boolean {
    setStepError(null);

    if (step === 1) {
      if (!name.trim()) { setStepError("Cycle name is required"); return false; }
      if (!startDate) { setStepError("Start date is required"); return false; }
      if (!endDate) { setStepError("End date is required"); return false; }
      if (endDate <= startDate) { setStepError("End date must be after start date"); return false; }
      const today = new Date(new Date().toDateString());
      if (startDate < today) { setStepError("Start date must be today or in the future"); return false; }
      if (reviewDeadline) {
        if (reviewDeadline < startDate) { setStepError("Review deadline must be on or after start date"); return false; }
        if (reviewDeadline > endDate) { setStepError("Review deadline must be on or before end date"); return false; }
      }
    }

    if (step === 2) {
      if (selectedPeopleIds.length === 0) { setStepError("Select at least one employee to proceed"); return false; }
    }

    if (step === 3) {
      if (selectedCompIds.size === 0 && textQuestions.length === 0) {
        setStepError("Add at least one competency or text question to proceed");
        return false;
      }
    }

    if (step === 4) {
      if (!skipNami && namiScheduleMode === "schedule") {
        if (!namiScheduleDate) { setStepError("Select a date/time for the scheduled send"); return false; }
        if (new Date(namiScheduleDate) <= new Date()) { setStepError("Scheduled date must be in the future"); return false; }
      }
    }

    return true;
  }

  async function goNext() {
    if (handleNextStep() && step < 5) {
      await autoSaveDraft();
      setStep((step + 1) as 1 | 2 | 3 | 4 | 5);
    }
  }

  function goBack() {
    setStepError(null);
    if (step > 1) setStep((step - 1) as 1 | 2 | 3 | 4 | 5);
  }

  // ── Shared cycle creation ───────────────────────────────────────────────────
  async function createCycleBase(status: "draft" | "active"): Promise<{ cycleId: string; workspaceId: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const workspaceId: string = user.user_metadata?.workspace_id;
    if (!workspaceId) throw new Error("No workspace found");

    const sendAt = !skipNami && namiScheduleMode === "schedule" && namiScheduleDate
      ? new Date(namiScheduleDate).toISOString() : null;

    const cycleFields = {
      name: name.trim(),
      description: description.trim() || null,
      start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
      end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
      review_deadline: reviewDeadline ? format(reviewDeadline, "yyyy-MM-dd") : null,
      type: cycleType,
      status,
      ...(status === "active" && !skipNami ? { nami_confirmed: true, nami_send_at: sendAt } : {}),
    };

    let cycleId: string;

    if (pendingCycleId) {
      // Update existing draft
      const { error: updateError } = await supabase
        .from("performance_cycles")
        .update({ ...cycleFields, wizard_metadata: null })
        .eq("id", pendingCycleId);
      if (updateError) throw new Error(updateError.message || "Failed to update cycle");
      cycleId = pendingCycleId;
    } else {
      // Create new
      const { data: cycleData, error: insertError } = await supabase
        .from("performance_cycles")
        .insert({
          ...cycleFields,
          workspace_id: workspaceId,
          created_by: user.user_metadata?.app_user_id,
        })
        .select("id")
        .single();

      if (insertError || !cycleData) throw new Error(insertError?.message || "Failed to create cycle");
      cycleId = cycleData.id;
    }

    // Create timeline phases
    if (startDate && endDate) {
      const cycleDurationMs = endDate.getTime() - startDate.getTime();
      let cumulativeProportion = 0;
      const phases = DEFAULT_PHASES.map((phase, idx) => {
        const phaseStart = new Date(startDate.getTime() + cumulativeProportion * cycleDurationMs);
        cumulativeProportion += phase.proportion;
        const phaseEnd = new Date(startDate.getTime() + cumulativeProportion * cycleDurationMs);
        return {
          cycle_id: cycleId, phase_type: phase.phase_type, name: phase.name,
          start_date: phaseStart.toISOString(), end_date: phaseEnd.toISOString(),
          status: "pending", sort_order: idx,
        };
      });
      await supabase.from("cycle_phases").insert(phases);
    }

    // Create review questions
    const questions: any[] = [];
    let sortOrder = 0;
    for (const compId of selectedCompIds) {
      questions.push({ cycle_id: cycleId, question_type: "competency", competency_id: compId, sort_order: sortOrder++, required: true });
    }
    for (const tq of textQuestions) {
      questions.push({ cycle_id: cycleId, question_type: "text", prompt: tq.prompt, sort_order: sortOrder++, required: tq.required });
    }
    if (questions.length > 0) await supabase.from("cycle_questions").insert(questions);

    return { cycleId, workspaceId };
  }

  // ── Save as Draft ───────────────────────────────────────────────────────────
  async function handleSaveDraft() {
    if (!name.trim()) { setError("Cycle name is required to save a draft"); return; }
    setLoading("draft");
    setError(null);
    try {
      // If we already have a pending draft from auto-save, do a final save and navigate
      if (pendingCycleId) {
        await autoSaveDraft();
        router.push(`/dashboard/cycles/${pendingCycleId}`);
        router.refresh();
        return;
      }
      const { cycleId } = await createCycleBase("draft");
      router.push(`/dashboard/cycles/${cycleId}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to create cycle");
      setLoading(false);
    }
  }

  // ── Launch Cycle ───────────────────────────────────────────────────────────
  async function handleCreateAndLaunch() {
    // Final validation
    if (!name.trim() || !startDate || !endDate || selectedPeopleIds.length === 0) {
      setError("Please complete all required fields before launching");
      return;
    }
    setLoading("launch");
    setError(null);
    try {
      const { cycleId, workspaceId } = await createCycleBase("active");

      // Enroll employees
      await supabase.from("performance_cycle_employees").insert(
        selectedPeopleIds.map((id) => ({ performance_cycle_id: cycleId, employee_id: id, status: "pending", workspace_id: workspaceId }))
      );

      // Build assignments
      const enrolledIds = new Set(selectedPeopleIds);
      const enrolledUsers = users.filter((u) => selectedPeopleIds.includes(u.id));

      // Standard (self + manager review per employee)
      const standardAssignments = enrolledUsers.map((u) => ({
        cycle_id: cycleId, employee_id: u.id, manager_id: u.manager_id || null,
        assignment_type: "standard", status: "pending", workspace_id: workspaceId,
      }));
      if (standardAssignments.length > 0) {
        const { error: e } = await supabase.from("review_assignments").insert(standardAssignments);
        if (e) throw e;
      }

      // Upward (direct reports review their manager, only when manager is also enrolled)
      const upwardAssignments = enrolledUsers
        .filter((u) => u.manager_id && enrolledIds.has(u.manager_id))
        .map((u) => ({
          cycle_id: cycleId, employee_id: u.manager_id, reviewer_id: u.id,
          manager_id: null, assignment_type: "upward", status: "pending", workspace_id: workspaceId,
        }));
      if (upwardAssignments.length > 0) {
        const { error: e } = await supabase.from("review_assignments").insert(upwardAssignments);
        if (e) throw e;
      }

      // Activate first phase
      const { data: phases } = await supabase
        .from("cycle_phases").select("id").eq("cycle_id", cycleId).order("sort_order").limit(1);
      if (phases?.[0]) {
        await supabase.from("cycle_phases").update({ status: "active" }).eq("id", phases[0].id);
      }

      // Set cycle active (already set in insert, but also update employees)
      await supabase.from("performance_cycle_employees")
        .update({ status: "in_progress" }).eq("performance_cycle_id", cycleId);

      // Invoke nami-bot if sending now and not skipped
      if (!skipNami && namiScheduleMode === "now") {
        const { error: namiErr } = await supabase.functions.invoke("nami-bot", {
          body: { action: "launch_cycle", cycle_id: cycleId },
        });
        if (namiErr) {
          console.error("Nami send error:", namiErr);
          setError(`Cycle launched, but Nami messages failed: ${namiErr.message}`);
          setLoading(false);
          return;
        }
      }

      router.push(`/dashboard/cycles/${cycleId}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to launch cycle");
      setLoading(false);
    }
  }

  // ── People helpers ──────────────────────────────────────────────────────────
  const filteredUsers = users.filter((u) => {
    if (!peopleSearch) return true;
    const q = peopleSearch.toLowerCase();
    return u.slack_name?.toLowerCase().includes(q) || u.slack_email?.toLowerCase().includes(q);
  });

  function togglePerson(id: string) {
    setSelectedPeopleIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  // ── Competency helpers ──────────────────────────────────────────────────────
  const categories = [...new Set(competencies.map((c) => c.category || "Uncategorized"))].sort();

  function toggleCompetency(id: string) {
    setSelectedCompIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Cycle profile helpers ───────────────────────────────────────────────────
  function applyCycleProfileFromContent(profile: CycleProfile) {
    const content = profile.content;
    if (content.cycle_type) setCycleType(content.cycle_type);
    if (content.suggested_description) {
      setDescription(content.suggested_description);
      setShowDescription(true);
    }
    setAppliedProfileId(profile.id);
  }

  // ── Template picker ────────────────────────────────────────────────────────
  function applyTemplate(tpl: Template) {
    const mapped: TextQuestion[] = (tpl.questions || []).map((q) => ({
      prompt: q.prompt,
      required: q.required !== false,
    }));
    setTextQuestions(mapped);
    setTemplateApplied(tpl.name);
    setTimeout(() => setTemplateApplied(null), 2500);
  }

  // ── Questions summary ───────────────────────────────────────────────────────
  const questionsSummary = [
    selectedCompIds.size > 0 ? `${selectedCompIds.size} competenc${selectedCompIds.size !== 1 ? "ies" : "y"}` : null,
    textQuestions.length > 0 ? `${textQuestions.length} question${textQuestions.length !== 1 ? "s" : ""}` : null,
  ].filter(Boolean).join(" + ") || "None configured";

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/cycles"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New Performance Cycle</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Step {step} of 5
            {autoSaving && <span className="ml-2 text-muted-foreground/60">Saving...</span>}
            {pendingCycleId && !autoSaving && <span className="ml-2 text-muted-foreground/60">Draft saved</span>}
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <StepIndicator currentStep={step} />

      {/* Global error */}
      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm mb-6">
          {error}
        </div>
      )}

      {/* Step error */}
      {stepError && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm mb-4 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {stepError}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          STEP 1 — Basics & Dates
          ════════════════════════════════════════════════════════════════════════ */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Cycle profile picker */}
          {cycleProfiles.length > 0 && (
            <div className="border border-border/60 rounded-lg p-4 bg-muted/20 space-y-2.5">
              <div>
                <p className="text-xs font-medium text-foreground">Start from a profile</p>
                <p className="text-[11px] text-muted-foreground">Pre-fill cycle type and description from a saved profile.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {cycleProfiles.map((profile) => {
                  const isApplied = appliedProfileId === profile.id;
                  return (
                    <Button
                      key={profile.id}
                      variant={isApplied ? "default" : "outline"}
                      size="sm"
                      className="h-auto py-1.5 px-3 text-xs gap-1.5"
                      onClick={() => applyCycleProfileFromContent(profile)}
                    >
                      {profile.is_system && <Sparkles className="h-3 w-3 text-amber-500" />}
                      {!profile.is_system && <FileText className="h-3 w-3 text-muted-foreground" />}
                      <span className="flex flex-col items-start">
                        <span className="font-medium">{profile.name}</span>
                        {profile.content.cycle_type && (
                          <span className={`text-[10px] ${isApplied ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            {CYCLE_TYPES.find(t => t.value === profile.content.cycle_type)?.label || profile.content.cycle_type}
                          </span>
                        )}
                      </span>
                      {isApplied && <Check className="h-3 w-3 ml-1" />}
                    </Button>
                  );
                })}
              </div>
              {appliedProfileId && (
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Profile applied &mdash; type and description pre-filled
                </p>
              )}
            </div>
          )}

          {/* Name + Type */}
          <div className="flex gap-4">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="name">Cycle Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Q2 2026 Performance Review"
              />
            </div>
            <div className="w-52 space-y-1.5">
              <Label>Type</Label>
              <Select value={cycleType} onValueChange={setCycleType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CYCLE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-3 gap-4">
            <DatePickerField label="Start Date *" value={startDate} onChange={setStartDate} placeholder="Start" fromDate={new Date()} />
            <DatePickerField label="End Date *" value={endDate} onChange={setEndDate} placeholder="End" fromDate={startDate} />
            <DatePickerField label="Review Deadline" value={reviewDeadline} onChange={setReviewDeadline} placeholder="Optional" optional fromDate={startDate} />
          </div>

          {/* Phase timeline preview */}
          <PhaseTimelinePreview startDate={startDate} endDate={endDate} />

          {/* Description toggle */}
          {!showDescription ? (
            <button
              type="button"
              onClick={() => setShowDescription(true)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              + Add description
            </button>
          ) : (
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Goals and focus areas for this review cycle..."
                rows={2}
              />
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          STEP 2 — People
          ════════════════════════════════════════════════════════════════════════ */}
      {step === 2 && (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">Select which employees will participate in this review cycle.</p>

          {/* Slack warning banner */}
          {usersWithoutSlack.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  {usersWithoutSlack.length} selected employee{usersWithoutSlack.length !== 1 ? "s" : ""} without Slack connected
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Nami won&apos;t be able to send them review prompts via Slack. They can still complete reviews manually.
                </p>
              </div>
            </div>
          )}

          {/* People search + select all */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={peopleSearch}
                onChange={(e) => setPeopleSearch(e.target.value)}
                placeholder="Search people..."
                className="pl-8 h-8 text-sm"
              />
            </div>
            <Button
              variant="outline" size="sm" className="h-8 text-xs shrink-0"
              onClick={() => {
                const allFiltered = filteredUsers.map((u) => u.id);
                const allSelected = allFiltered.every((id) => selectedPeopleIds.includes(id));
                if (allSelected) {
                  setSelectedPeopleIds((prev) => prev.filter((id) => !allFiltered.includes(id)));
                } else {
                  setSelectedPeopleIds((prev) => [...new Set([...prev, ...allFiltered])]);
                }
              }}
            >
              {filteredUsers.every((u) => selectedPeopleIds.includes(u.id)) && filteredUsers.length > 0
                ? "Deselect All" : "Select All"}
            </Button>
          </div>

          {/* People list */}
          <div className="border border-border/60 rounded-lg overflow-hidden max-h-52 overflow-y-auto">
            {users.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Loading people...</p>
            ) : filteredUsers.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No people found</p>
            ) : (
              filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40 cursor-pointer border-b border-border/30 last:border-0"
                  onClick={() => togglePerson(user.id)}
                >
                  <Checkbox
                    checked={selectedPeopleIds.includes(user.id)}
                    onCheckedChange={() => togglePerson(user.id)}
                  />
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-medium text-primary">
                      {user.slack_name?.[0]?.toUpperCase() || "?"}
                    </span>
                  </div>
                  <span className="text-sm text-foreground flex-1">{user.slack_name || "Unknown"}</span>
                  {!user.slack_user_id && (
                    <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">No Slack</span>
                  )}
                </div>
              ))
            )}
          </div>

          <p className="text-xs text-muted-foreground">{selectedPeopleIds.length} of {users.length} employees selected</p>

          {/* Manager assignments preview */}
          {selectedUsers.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs">Manager Assignments Preview</Label>
              <div className="border border-border/60 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border/60">
                      <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Employee</th>
                      <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Manager</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedUsers.slice(0, 10).map((u) => {
                      const manager = users.find(m => m.id === u.manager_id);
                      return (
                        <tr key={u.id} className="border-b border-border/30 last:border-0">
                          <td className="px-3 py-1.5">{u.slack_name || "Unknown"}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">
                            {manager ? manager.slack_name : <span className="italic">Unassigned</span>}
                          </td>
                        </tr>
                      );
                    })}
                    {selectedUsers.length > 10 && (
                      <tr>
                        <td colSpan={2} className="px-3 py-1.5 text-muted-foreground text-center">
                          ...and {selectedUsers.length - 10} more
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          STEP 3 — Questions
          ════════════════════════════════════════════════════════════════════════ */}
      {step === 3 && (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Configure the review questions. Select competencies for rating-based assessments and add open-ended text questions for qualitative feedback.
          </p>

          {/* Template picker */}
          {templates.length > 0 && (
            <div className="border border-border/60 rounded-lg p-4 bg-muted/20 space-y-2.5">
              <div>
                <p className="text-xs font-medium text-foreground">Start from a template</p>
                <p className="text-[11px] text-muted-foreground">Pre-fill questions from an existing template, then customize as needed.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {templates.map((tpl) => (
                  <Button
                    key={tpl.id}
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => applyTemplate(tpl)}
                  >
                    {tpl.is_system && <Sparkles className="h-3 w-3 text-amber-500" />}
                    {tpl.name}
                    <span className="text-muted-foreground">({Array.isArray(tpl.questions) ? tpl.questions.length : 0})</span>
                  </Button>
                ))}
              </div>
              {templateApplied && (
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Applied &ldquo;{templateApplied}&rdquo; &mdash; {textQuestions.length} question{textQuestions.length !== 1 ? "s" : ""} loaded
                </p>
              )}
            </div>
          )}

          {/* Competencies */}
          <div className="border border-border/60 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setCompOpen(!compOpen)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/30 text-left"
            >
              <div className="flex items-center gap-2">
                <Target className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">Competency Ratings</span>
                <span className="text-xs text-muted-foreground">{selectedCompIds.size} selected</span>
              </div>
              {compOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
            {compOpen && (
              <div className="p-3">
                {competencies.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    No competencies defined. <Link href="/dashboard/competencies/new" className="underline">Create some first.</Link>
                  </p>
                ) : (
                  <>
                    <div className="flex justify-end mb-2">
                      <Button
                        variant="ghost" size="sm" className="text-xs h-6"
                        onClick={() => selectedCompIds.size === competencies.length
                          ? setSelectedCompIds(new Set())
                          : setSelectedCompIds(new Set(competencies.map((c) => c.id)))}
                      >
                        {selectedCompIds.size === competencies.length ? "Deselect All" : "Select All"}
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {categories.map((cat) => (
                        <div key={cat}>
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">{cat}</p>
                          <div className="space-y-0.5">
                            {competencies.filter((c) => (c.category || "Uncategorized") === cat).map((comp) => (
                              <label
                                key={comp.id}
                                className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/40 cursor-pointer"
                              >
                                <Checkbox checked={selectedCompIds.has(comp.id)} onCheckedChange={() => toggleCompetency(comp.id)} />
                                <span className="text-sm text-foreground">{comp.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Text questions */}
          <div className="border border-border/60 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setTqOpen(!tqOpen)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/30 text-left"
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">Open-ended Questions</span>
                <span className="text-xs text-muted-foreground">{textQuestions.length} question{textQuestions.length !== 1 ? "s" : ""}</span>
              </div>
              {tqOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
            {tqOpen && (
              <div className="p-3 space-y-2.5">
                {textQuestions.map((q, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-md border border-border/60 bg-muted/20">
                    <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-xs text-foreground flex-1">{q.prompt}</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => setTextQuestions((p) => p.filter((_, i) => i !== idx))}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    value={newPrompt}
                    onChange={(e) => setNewPrompt(e.target.value)}
                    placeholder="Add a question..."
                    className="flex-1 h-8 text-sm"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), newPrompt.trim() && (setTextQuestions((p) => [...p, { prompt: newPrompt.trim(), required: true }]), setNewPrompt("")))}
                  />
                  <Button
                    variant="outline" size="sm" className="h-8 shrink-0"
                    onClick={() => { if (newPrompt.trim()) { setTextQuestions((p) => [...p, { prompt: newPrompt.trim(), required: true }]); setNewPrompt(""); } }}
                    disabled={!newPrompt.trim()}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {SUGGESTED_QUESTIONS.filter((s) => !textQuestions.some((q) => q.prompt === s)).map((s) => (
                    <button
                      key={s} type="button"
                      className="text-[11px] px-2 py-1 rounded-full border border-border/60 text-muted-foreground hover:border-primary/60 hover:text-primary transition-colors"
                      onClick={() => setTextQuestions((p) => [...p, { prompt: s, required: true }])}
                    >
                      + {s.length > 45 ? s.slice(0, 42) + "..." : s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Total: {questionsSummary}
          </p>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          STEP 4 — Nami Bot
          ════════════════════════════════════════════════════════════════════════ */}
      {step === 4 && (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Nami is your AI assistant that sends review prompts to employees via Slack DMs.
            Configure how and when Nami should reach out.
          </p>

          {/* Send count cards */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-border/60">
              <CardContent className="pt-4 pb-3 px-4 text-center">
                <p className="text-2xl font-semibold text-foreground">{selfReviewCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Self-review DMs</p>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="pt-4 pb-3 px-4 text-center">
                <p className="text-2xl font-semibold text-foreground">{managerReviewCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Manager review DMs</p>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="pt-4 pb-3 px-4 text-center">
                <p className="text-2xl font-semibold text-foreground">{upwardReviewCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Upward feedback DMs</p>
              </CardContent>
            </Card>
          </div>

          {/* Missing Slack warning */}
          {usersWithoutSlack.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  {usersWithoutSlack.length} employee{usersWithoutSlack.length !== 1 ? "s" : ""} missing Slack
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {usersWithoutSlack.slice(0, 3).map(u => u.slack_name || "Unknown").join(", ")}
                  {usersWithoutSlack.length > 3 ? ` and ${usersWithoutSlack.length - 3} more` : ""}
                  {" "}&mdash; they won&apos;t receive Slack DMs from Nami.
                </p>
              </div>
            </div>
          )}

          {/* Skip Nami toggle */}
          <label className="flex items-center gap-3 p-3 rounded-lg border border-border/60 cursor-pointer hover:bg-muted/30 transition-colors">
            <Checkbox checked={skipNami} onCheckedChange={(checked) => setSkipNami(!!checked)} />
            <div>
              <p className="text-sm font-medium text-foreground">Skip Nami</p>
              <p className="text-xs text-muted-foreground">Launch the cycle without sending Slack DMs. Employees can still complete reviews manually.</p>
            </div>
          </label>

          {/* Send mode */}
          {!skipNami && (
            <div className="space-y-3 p-4 rounded-lg border border-border/60 bg-muted/10">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Send mode</span>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio" name="namiSchedule"
                    checked={namiScheduleMode === "now"}
                    onChange={() => setNamiScheduleMode("now")}
                    className="accent-primary"
                  />
                  Send immediately on launch
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio" name="namiSchedule"
                    checked={namiScheduleMode === "schedule"}
                    onChange={() => setNamiScheduleMode("schedule")}
                    className="accent-primary"
                  />
                  Schedule for later
                </label>
              </div>
              {namiScheduleMode === "schedule" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Send date & time</Label>
                  <input
                    type="datetime-local"
                    value={namiScheduleDate}
                    onChange={(e) => setNamiScheduleDate(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                  {namiScheduleDate && new Date(namiScheduleDate) <= new Date() && (
                    <p className="text-xs text-destructive">Scheduled date must be in the future</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          STEP 5 — Review & Launch
          ════════════════════════════════════════════════════════════════════════ */}
      {step === 5 && (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">Review your cycle configuration before launching.</p>

          {/* Basics card */}
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Basics & Dates</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setStepError(null); setStep(1); }}>Edit</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{name || "Untitled"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span>{CYCLE_TYPES.find(t => t.value === cycleType)?.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Period</span>
                <span>
                  {startDate ? format(startDate, "MMM d, yyyy") : "Not set"} &mdash; {endDate ? format(endDate, "MMM d, yyyy") : "Not set"}
                </span>
              </div>
              {reviewDeadline && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Review Deadline</span>
                  <span>{format(reviewDeadline, "MMM d, yyyy")}</span>
                </div>
              )}
              {description && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Description</span>
                  <span className="text-right max-w-[250px] truncate">{description}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* People card */}
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">People</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setStepError(null); setStep(2); }}>Edit</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Employees</span>
                <span>{selectedPeopleIds.length} selected</span>
              </div>
              {usersWithoutSlack.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-amber-600">Missing Slack</span>
                  <span className="text-amber-600">{usersWithoutSlack.length}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Questions card */}
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Questions</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setStepError(null); setStep(3); }}>Edit</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Competencies</span>
                <span>{selectedCompIds.size}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Text Questions</span>
                <span>{textQuestions.length}</span>
              </div>
            </CardContent>
          </Card>

          {/* Nami card */}
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Nami Bot</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setStepError(null); setStep(4); }}>Edit</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              {skipNami ? (
                <p className="text-muted-foreground">Nami will be skipped — no Slack DMs will be sent</p>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Send mode</span>
                    <span>{namiScheduleMode === "now" ? "Immediately on launch" : `Scheduled: ${namiScheduleDate ? format(new Date(namiScheduleDate), "MMM d, yyyy h:mm a") : "Not set"}`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total DMs</span>
                    <span>{selfReviewCount + managerReviewCount + upwardReviewCount}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Navigation ── */}
      <div className="border-t border-border/60 mt-6 pt-5 flex items-center justify-between">
        <div>
          {step === 1 ? (
            <Button variant="ghost" asChild>
              <Link href="/dashboard/cycles">Cancel</Link>
            </Button>
          ) : (
            <Button variant="outline" onClick={goBack}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />Back
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleSaveDraft} disabled={!!loading}>
            {loading === "draft" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save as Draft
          </Button>
          {step < 5 ? (
            <Button onClick={goNext}>
              Next <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          ) : (
            <Button onClick={handleCreateAndLaunch} disabled={!!loading}>
              {loading === "launch"
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <Play className="h-4 w-4 mr-2" />}
              Launch Cycle
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
