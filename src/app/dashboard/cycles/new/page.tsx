"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ArrowLeft, Loader2, Plus, X, Target, MessageSquare,
  Users, CalendarIcon, ChevronDown, ChevronRight, Play, Search,
} from "lucide-react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { format } from "date-fns";
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

const CYCLE_TYPES = [
  { value: "annual", label: "Annual Review" },
  { value: "mid_year", label: "Mid-Year Review" },
  { value: "quarterly", label: "Quarterly Review" },
  { value: "probation", label: "Probation Review" },
  { value: "custom", label: "Custom" },
];

// Proportions out of 12 total "units" — phases are always scaled to fit the cycle's actual dates
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

interface User {
  id: string;
  slack_name: string | null;
  slack_email: string | null;
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

// ── Reusable date picker field ─────────────────────────────────────────────────
function DatePickerField({
  label, value, onChange, placeholder = "Pick a date", optional, fromDate,
}: {
  label: string;
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
  placeholder?: string;
  optional?: boolean;
  fromDate?: Date;
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
            className={`w-full justify-start text-left font-normal h-9 text-sm ${!value ? "text-muted-foreground" : ""}`}
          >
            <CalendarIcon className="h-3.5 w-3.5 mr-2 shrink-0 text-muted-foreground" />
            {value ? format(value, "MMM d, yyyy") : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={value} onSelect={onChange} initialFocus fromDate={fromDate} />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({
  icon, title, summary, open, onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between py-4 text-left group"
    >
      <div className="flex items-center gap-2.5">
        <div className="text-muted-foreground">{icon}</div>
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">{summary}</span>
      </div>
      {open
        ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
        : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function NewCyclePage() {
  const router = useRouter();

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
  const [peopleOpen, setPeopleOpen] = useState(true);

  // Questions
  const [questionsOpen, setQuestionsOpen] = useState(false);
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

  // UI
  const [loading, setLoading] = useState<false | "draft" | "launch">(false);
  const [error, setError] = useState<string | null>(null);
  const [showLaunchConfirm, setShowLaunchConfirm] = useState(false);

  // Nami confirmation
  const [showNamiConfirm, setShowNamiConfirm] = useState(false);
  const [namiScheduleMode, setNamiScheduleMode] = useState<"now" | "schedule">("now");
  const [namiScheduleDate, setNamiScheduleDate] = useState("");
  const [pendingCycleId, setPendingCycleId] = useState<string | null>(null);
  const [namiSendCounts, setNamiSendCounts] = useState({ employees: 0, managers: 0, upward: 0 });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Load users + competencies on mount
  useEffect(() => {
    async function load() {
      const [{ data: usersData }, { data: compsData }] = await Promise.all([
        supabase.from("users").select("id, slack_name, slack_email, manager_id").order("slack_name"),
        supabase.from("competencies").select("id, name, category").order("category").order("name"),
      ]);
      const loadedUsers = usersData || [];
      const loadedComps = compsData || [];
      setUsers(loadedUsers);
      setSelectedPeopleIds(loadedUsers.map((u: User) => u.id));
      setCompetencies(loadedComps);
      setSelectedCompIds(new Set(loadedComps.map((c: Competency) => c.id)));
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Validation ──────────────────────────────────────────────────────────────
  function validateForDraft(): boolean {
    if (!name.trim()) { setError("Cycle name is required"); return false; }
    setError(null); return true;
  }

  function validateForLaunch(): boolean {
    if (!name.trim()) { setError("Cycle name is required"); return false; }
    if (!startDate || !endDate) { setError("Start and end dates are required"); return false; }
    if (endDate <= startDate) { setError("End date must be after start date"); return false; }
    if (reviewDeadline && endDate && reviewDeadline > endDate) {
      setError("Review deadline must be on or before the end date"); return false;
    }
    if (selectedPeopleIds.length === 0) { setError("Add at least one person to launch"); return false; }
    setError(null); return true;
  }

  // ── Shared cycle creation ───────────────────────────────────────────────────
  async function createCycleBase(): Promise<{ cycleId: string; workspaceId: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const workspaceId: string = user.user_metadata?.workspace_id;
    if (!workspaceId) throw new Error("No workspace found");

    const { data: cycleData, error: insertError } = await supabase
      .from("performance_cycles")
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
        end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
        review_deadline: reviewDeadline ? format(reviewDeadline, "yyyy-MM-dd") : null,
        type: cycleType,
        workspace_id: workspaceId,
        created_by: user.user_metadata?.app_user_id,
        status: "draft",
      })
      .select("id")
      .single();

    if (insertError || !cycleData) throw new Error(insertError?.message || "Failed to create cycle");
    const cycleId = cycleData.id;

    // Create timeline phases — scaled proportionally to fit within the cycle's actual dates
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
    if (!validateForDraft()) return;
    setLoading("draft");
    try {
      const { cycleId } = await createCycleBase();
      router.push(`/dashboard/cycles/${cycleId}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to create cycle");
      setLoading(false);
    }
  }

  // ── Create & Launch ─────────────────────────────────────────────────────────
  async function handleCreateAndLaunch() {
    if (!validateForLaunch()) return;
    setLoading("launch");
    try {
      const { cycleId, workspaceId } = await createCycleBase();

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

      // Set cycle active
      await supabase.from("performance_cycles")
        .update({ status: "active", updated_at: new Date().toISOString() }).eq("id", cycleId);
      await supabase.from("performance_cycle_employees")
        .update({ status: "in_progress" }).eq("performance_cycle_id", cycleId);

      // Calculate send counts and show Nami confirmation modal
      const employeeCount = standardAssignments.length;
      const managerCount = standardAssignments.filter(a => a.manager_id).length;
      const upwardCount = upwardAssignments.length;
      setNamiSendCounts({ employees: employeeCount, managers: managerCount, upward: upwardCount });
      setPendingCycleId(cycleId);
      setShowNamiConfirm(true);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Failed to launch cycle");
      setLoading(false);
    }
  }

  // ── Nami confirmation ─────────────────────────────────────────────────────
  async function confirmNamiSend() {
    if (!pendingCycleId) return;
    setLoading("launch");
    try {
      const sendAt = namiScheduleMode === "schedule" && namiScheduleDate
        ? new Date(namiScheduleDate).toISOString() : null;

      await supabase.from("performance_cycles").update({
        nami_send_at: sendAt, nami_confirmed: true
      }).eq("id", pendingCycleId);

      // If send now, invoke nami-bot immediately
      if (!sendAt) {
        const { error } = await supabase.functions.invoke("nami-bot", {
          body: { action: "launch_cycle", cycle_id: pendingCycleId },
        });
        if (error) {
          console.error("Nami send error:", error);
          setError(`Cycle launched, but Nami messages failed: ${error.message}`);
          setLoading(false);
          return;
        }
      }

      router.push(`/dashboard/cycles/${pendingCycleId}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to send Nami messages");
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

  // ── Questions summary ───────────────────────────────────────────────────────
  const questionsSummary = [
    selectedCompIds.size > 0 ? `${selectedCompIds.size} competenc${selectedCompIds.size !== 1 ? "ies" : "y"}` : null,
    textQuestions.length > 0 ? `${textQuestions.length} question${textQuestions.length !== 1 ? "s" : ""}` : null,
  ].filter(Boolean).join(" · ") || "None configured";

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto pb-16">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/cycles"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">New Performance Cycle</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Set up and launch a review cycle for your team</p>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm mb-6">
          {error}
        </div>
      )}

      {/* ── Core fields ── */}
      <div className="space-y-4 mb-2">
        {/* Name + Type */}
        <div className="flex gap-3">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="name">Cycle Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q2 2026 Performance Review"
            />
          </div>
          <div className="w-44 space-y-1.5">
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
        <div className="grid grid-cols-3 gap-3">
          <DatePickerField label="Start Date" value={startDate} onChange={setStartDate} placeholder="Start" fromDate={new Date()} />
          <DatePickerField label="End Date" value={endDate} onChange={setEndDate} placeholder="End" />
          <DatePickerField label="Review Deadline" value={reviewDeadline} onChange={setReviewDeadline} placeholder="Optional" optional />
        </div>

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

      {/* ── People ── */}
      <div className="border-t border-border/60 mt-4">
        <SectionHeader
          icon={<Users className="h-4 w-4" />}
          title="People"
          summary={selectedPeopleIds.length > 0 ? `${selectedPeopleIds.length} selected` : "None selected"}
          open={peopleOpen}
          onToggle={() => setPeopleOpen(!peopleOpen)}
        />
        {peopleOpen && (
          <div className="pb-4 space-y-2">
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
            <div className="border border-border/60 rounded-lg overflow-hidden max-h-52 overflow-y-auto">
              {users.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Loading people…</p>
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
                    <span className="text-sm text-foreground">{user.slack_name || "Unknown"}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Review Questions ── */}
      <div className="border-t border-border/60">
        <SectionHeader
          icon={<Target className="h-4 w-4" />}
          title="Review Questions"
          summary={questionsSummary}
          open={questionsOpen}
          onToggle={() => setQuestionsOpen(!questionsOpen)}
        />
        {questionsOpen && (
          <div className="pb-4 space-y-3">

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
                      placeholder="Add a question…"
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
                        + {s.length > 45 ? s.slice(0, 42) + "…" : s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="border-t border-border/60 mt-2 pt-5 flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/cycles">Cancel</Link>
        </Button>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleSaveDraft} disabled={!!loading}>
            {loading === "draft" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save as Draft
          </Button>
          <Button
            onClick={() => {
              if (validateForLaunch()) setShowLaunchConfirm(true);
            }}
            disabled={!!loading}
          >
            {loading === "launch"
              ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              : <Play className="h-4 w-4 mr-2" />}
            Create & Launch
          </Button>
        </div>
      </div>

      <AlertDialog open={showLaunchConfirm} onOpenChange={setShowLaunchConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Launch Performance Cycle?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create the cycle, enroll {selectedPeopleIds.length} employee{selectedPeopleIds.length !== 1 ? "s" : ""}, and send Slack notifications to start their reviews.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowLaunchConfirm(false);
                handleCreateAndLaunch();
              }}
              disabled={!!loading}
            >
              {loading === "launch" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Launch Cycle
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showNamiConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 space-y-4 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900">Nami will message:</h3>
            <ul className="space-y-1 text-sm text-zinc-600">
              <li>&bull; <strong>{namiSendCounts.employees}</strong> employees (self-review)</li>
              <li>&bull; <strong>{namiSendCounts.managers}</strong> managers (manager review)</li>
              <li>&bull; <strong>{namiSendCounts.upward}</strong> direct reports (upward feedback)</li>
            </ul>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="namiSchedule" checked={namiScheduleMode === "now"}
                  onChange={() => setNamiScheduleMode("now")} className="accent-emerald-600" />
                Send now
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="namiSchedule" checked={namiScheduleMode === "schedule"}
                  onChange={() => setNamiScheduleMode("schedule")} className="accent-emerald-600" />
                Schedule
              </label>
            </div>
            {namiScheduleMode === "schedule" && (
              <input type="datetime-local" value={namiScheduleDate}
                onChange={(e) => setNamiScheduleDate(e.target.value)}
                className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={confirmNamiSend} disabled={loading === "launch" || (namiScheduleMode === "schedule" && !namiScheduleDate)}
                className="flex-1 bg-emerald-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {loading === "launch" ? "Sending..." : "Confirm & Send"}
              </button>
              <button onClick={async () => {
                  setShowNamiConfirm(false);
                  // Still send old-style notifications when skipping Nami
                  try {
                    await supabase.functions.invoke("cycle-notifications", {
                      body: { action: "launch", cycle_id: pendingCycleId },
                    });
                  } catch (e) { console.error("Notification error:", e); }
                  router.push(`/dashboard/cycles/${pendingCycleId}`);
                  router.refresh();
                }}
                className="flex-1 border border-zinc-300 rounded-lg py-2.5 text-sm font-medium hover:bg-zinc-50 transition-colors">
                Skip Nami
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
