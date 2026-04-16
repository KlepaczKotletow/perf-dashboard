"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { getClientIdentity } from "@/lib/client-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Loader2, Plus, X, Users, BarChart2, TrendingUp, Info, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";

type SurveyType = "360" | "pulse" | "enps";
type PeerMode = "subject_nominates" | "manager_nominates" | "admin_assigns";

interface Question {
  id: string;
  type: "rating_7" | "text" | "single_select";
  label: string;
  required: boolean;
  options?: string[];
}

interface TeamMember {
  id: string;
  slack_name: string;
  job_title: string | null;
  manager_id: string | null;
  department: string | null;
}

const SURVEY_TYPES = [
  { value: "360" as SurveyType, label: "360° Review", description: "Multi-rater development feedback", icon: Users, color: "border-purple-200 bg-purple-50" },
  { value: "pulse" as SurveyType, label: "Pulse Survey", description: "Quick team temperature check", icon: BarChart2, color: "border-blue-200 bg-blue-50" },
  { value: "enps" as SurveyType, label: "eNPS", description: "Would you recommend working here?", icon: TrendingUp, color: "border-green-200 bg-green-50" },
];

// Contextual guidance content for the right panel
const GUIDANCE: Record<string, { title: string; content: string[] }> = {
  "type-360": {
    title: "What is a 360° Review?",
    content: [
      "A 360 review collects feedback about a person from multiple perspectives — themselves, their manager, their peers, and their direct reports.",
      "It's designed for development, not evaluation. The goal is to help people understand how others experience their work.",
      "Feedback is confidential. Peer and direct report responses are aggregated (minimum 3 raters required) so individuals can't be identified.",
      "Best practice: keep it under 15 minutes for raters. Focus on 3-5 competency areas with 2-3 open-ended questions.",
    ],
  },
  "type-pulse": {
    title: "What is a Pulse Survey?",
    content: [
      "A pulse survey is a short, frequent check-in that measures team sentiment and engagement.",
      "Keep it short — 5 to 10 questions maximum. The goal is a quick temperature check, not a deep dive.",
      "Responses are anonymous. Everyone in your workspace will be invited to participate.",
      "Run pulse surveys regularly (monthly or quarterly) to track trends over time.",
    ],
  },
  "type-enps": {
    title: "What is eNPS?",
    content: [
      "Employee Net Promoter Score measures how likely your team is to recommend your organisation as a place to work.",
      "It's a single question on a 0-10 scale, followed by an optional open-ended follow-up.",
      "Scores 9-10 are Promoters, 7-8 are Passives, 0-6 are Detractors. Your eNPS = % Promoters minus % Detractors.",
      "A score above 0 is acceptable, above 20 is good, above 50 is excellent.",
    ],
  },
  name: {
    title: "Naming your survey",
    content: [
      "Use a clear name that includes the time period, e.g. 'Q1 2026 360 Review' or 'March Pulse Check'.",
      "This name appears in Slack messages to participants, so make it recognisable.",
    ],
  },
  subjects: {
    title: "Who gets reviewed?",
    content: [
      "Select the people who will receive 360 feedback. Each person you select becomes a 'subject' — someone that others will review.",
      "For a company-wide review, select everyone. For targeted development, pick specific individuals or teams.",
      "Once launched, each subject's manager, direct reports, and nominated peers will be asked to provide feedback.",
    ],
  },
  peers: {
    title: "How peer selection works",
    content: [
      "Peers are the only reviewers who can't be auto-assigned from your org chart — the system doesn't know who works closely with whom.",
      "Subject nominates: Each subject receives a Slack DM asking them to pick 3-5 colleagues who know their work best. This is the most common approach.",
      "Manager nominates: Managers pick peers for their direct reports. Good when subjects are junior or new.",
      "Admin assigns: You select peers for each subject right now. Best for small teams where you know the working relationships.",
      "Research recommends 3-5 peer reviewers per subject for reliable, anonymous data.",
    ],
  },
  questions: {
    title: "Writing effective questions",
    content: [
      "Focus on observable behaviours, not personality traits. 'Communicates project priorities clearly' is better than 'Is a good communicator'.",
      "Keep it to 15-25 rated items plus 2-3 open-ended questions. Surveys longer than 15 minutes see quality drop significantly.",
      "The two most effective open-ended questions are: 'What should this person keep doing?' and 'What could this person improve?'",
      "Use a consistent rating scale. A 5-point or 7-point scale works best for reliable data.",
    ],
  },
  participants: {
    title: "Who receives this survey?",
    content: [
      "By default, everyone in your workspace will receive this survey.",
      "You can target specific departments or individual people instead.",
      "For eNPS, we recommend surveying the whole organisation for a representative score.",
      "For pulse surveys, targeting specific teams lets you check in on groups that need attention.",
    ],
  },
  review: {
    title: "Before you launch",
    content: [
      "Once launched, participants receive a Slack DM from Nami with the survey.",
      "You can schedule the launch for a specific time, or send immediately.",
      "The survey stays open until you close it manually, or until the close date (if set).",
      "You can track response rates and send reminders from the survey detail page.",
    ],
  },
};

export default function NewSurveyPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNamiConfirm, setShowNamiConfirm] = useState(false);
  const [namiScheduleMode, setNamiScheduleMode] = useState<"now" | "schedule" | "recurring">("now");
  const [recurrence, setRecurrence] = useState<"weekly" | "biweekly" | "monthly">("biweekly");
  const [recurrenceDay, setRecurrenceDay] = useState("monday");
  const [namiScheduleDate, setNamiScheduleDate] = useState("");
  const [pendingSurveyId, setPendingSurveyId] = useState<string | null>(null);
  const [namiParticipantCount, setNamiParticipantCount] = useState(0);
  const [targetMode, setTargetMode] = useState<"all" | "departments" | "people">("all");
  const [selectedDepartments, setSelectedDepartments] = useState<Set<string>>(new Set());
  const [selectedPeople, setSelectedPeople] = useState<Set<string>>(new Set());
  const [peopleSearch, setPeopleSearch] = useState("");

  // Active guidance section for the right panel
  const [activeGuide, setActiveGuide] = useState<string>("type-360");

  // Step 1
  const [surveyType, setSurveyType] = useState<SurveyType | null>(null);

  // Step 2 — shared
  const [name, setName] = useState("");
  const [closesAt, setClosesAt] = useState("");

  // Step 2 — 360 specific
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());
  const [peerMode, setPeerMode] = useState<PeerMode>("subject_nominates");
  const [showQuestions, setShowQuestions] = useState(false);
  const [questions360, setQuestions360] = useState<Question[]>([
    { id: crypto.randomUUID(), type: "rating_7", label: "Communicates clearly and effectively", required: true },
    { id: crypto.randomUUID(), type: "rating_7", label: "Delivers on commitments consistently", required: true },
    { id: crypto.randomUUID(), type: "rating_7", label: "Collaborates well across teams", required: true },
    { id: crypto.randomUUID(), type: "rating_7", label: "Takes ownership and follows through", required: true },
    { id: crypto.randomUUID(), type: "text", label: "What should this person keep doing?", required: false },
    { id: crypto.randomUUID(), type: "text", label: "What is one thing this person could improve?", required: false },
  ]);

  // Step 2 — pulse specific
  const [pulseQuestions, setPulseQuestions] = useState<Question[]>([
    { id: crypto.randomUUID(), type: "rating_7", label: "I feel motivated in my work this week", required: true },
    { id: crypto.randomUUID(), type: "text", label: "Anything on your mind you'd like to share?", required: false },
  ]);

  // Step 2 — eNPS specific
  const [enpsFollowUp, setEnpsFollowUp] = useState("What's the main reason for your score?");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function loadTeam() {
      const identity = await getClientIdentity(supabase);
      if (!identity) return;
      const wsId = identity.workspaceId;
      const { data } = await supabase.from("users").select("id, slack_name, job_title, manager_id, department").eq("workspace_id", wsId).order("slack_name");
      setTeam(data || []);
    }
    loadTeam();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute auto-assigned counts
  const autoAssignSummary = useMemo(() => {
    if (selectedSubjects.size === 0) return null;
    let selfCount = 0;
    let managerCount = 0;
    let directReportCount = 0;
    for (const subjectId of selectedSubjects) {
      const subject = team.find(u => u.id === subjectId);
      if (!subject) continue;
      selfCount++;
      if (subject.manager_id && team.some(u => u.id === subject.manager_id)) managerCount++;
      if (team.some(u => u.manager_id === subjectId)) directReportCount++;
    }
    return { selfCount, managerCount, directReportCount };
  }, [selectedSubjects, team]);

  const departments = useMemo(() => {
    const depts = new Set(team.filter(u => u.department).map(u => u.department!));
    return Array.from(depts).sort();
  }, [team]);

  function addQuestion(set: "360" | "pulse") {
    const q: Question = { id: crypto.randomUUID(), type: "rating_7", label: "", required: true };
    if (set === "360") setQuestions360(prev => [...prev, q]);
    else setPulseQuestions(prev => [...prev, q]);
  }

  function removeQuestion(set: "360" | "pulse", id: string) {
    if (set === "360") setQuestions360(prev => prev.filter(q => q.id !== id));
    else setPulseQuestions(prev => prev.filter(q => q.id !== id));
  }

  function updateQuestion(set: "360" | "pulse", id: string, field: keyof Question, value: any) {
    const updater = (prev: Question[]) => prev.map(q => q.id === id ? { ...q, [field]: value } : q);
    if (set === "360") setQuestions360(updater);
    else setPulseQuestions(updater);
  }

  async function handleLaunch() {
    if (!surveyType || !name.trim()) return;
    if (surveyType === "360" && selectedSubjects.size === 0) {
      setError("Select at least one person to review.");
      return;
    }
    if (surveyType === "360" || surveyType === "pulse") {
      const activeQuestions = surveyType === "360" ? questions360 : pulseQuestions;
      const firstEmptyIndex = activeQuestions.findIndex(q => !q.label.trim());
      if (firstEmptyIndex >= 0) {
        setError(`Question ${firstEmptyIndex + 1} is empty — every question needs a label before you can save.`);
        return;
      }
    }
    setLoading(true);
    setError(null);
    try {
      const identity = await getClientIdentity(supabase);
      if (!identity) throw new Error("Not authenticated");
      const { data: userData } = await supabase.from("users").select("id, workspace_id, manager_id").eq("id", identity.userId).single();
      if (!userData) throw new Error("User not found");

      let config: any = {};
      if (surveyType === "360") {
        config = {
          questions: questions360,
          peer_mode: peerMode,
          min_raters_to_show: 3,
        };
      } else if (surveyType === "pulse") {
        config = {
          questions: pulseQuestions,
          ...(targetMode !== "all" && {
            targeting: {
              mode: targetMode,
              ...(targetMode === "departments" && { departments: Array.from(selectedDepartments) }),
              ...(targetMode === "people" && { user_ids: Array.from(selectedPeople) }),
            },
          }),
        };
      } else {
        config = {
          follow_up: enpsFollowUp,
          ...(targetMode !== "all" && {
            targeting: {
              mode: targetMode,
              ...(targetMode === "departments" && { departments: Array.from(selectedDepartments) }),
              ...(targetMode === "people" && { user_ids: Array.from(selectedPeople) }),
            },
          }),
        };
      }

      const { data: survey, error: surveyErr } = await supabase
        .from("surveys")
        .insert({
          workspace_id: userData.workspace_id,
          type: surveyType,
          name: name.trim(),
          status: "draft",
          config,
          created_by: userData.id,
          closes_at: closesAt || null,
        })
        .select("id")
        .single();
      if (surveyErr) throw surveyErr;

      const wsId = userData.workspace_id;
      const participants: any[] = [];
      if (surveyType === "360") {
        const { data: wsUsers } = await supabase
          .from("users")
          .select("id, manager_id")
          .eq("workspace_id", wsId);

        for (const subjectId of selectedSubjects) {
          const subjectData = wsUsers?.find(u => u.id === subjectId);

          // Self-review (always included)
          participants.push({ survey_id: survey.id, user_id: subjectId, subject_user_id: subjectId, role: "self", workspace_id: wsId });

          // Manager review (auto from org chart)
          if (subjectData?.manager_id && wsUsers?.some(u => u.id === subjectData.manager_id)) {
            participants.push({ survey_id: survey.id, user_id: subjectData.manager_id, subject_user_id: subjectId, role: "manager", workspace_id: wsId });
          }

          // Direct report reviews (auto from org chart)
          for (const wu of (wsUsers || [])) {
            if (wu.manager_id === subjectId && wu.id !== subjectId) {
              participants.push({ survey_id: survey.id, user_id: wu.id, subject_user_id: subjectId, role: "direct_report", workspace_id: wsId });
            }
          }

          // Subject tracking entry
          participants.push({ survey_id: survey.id, user_id: subjectId, subject_user_id: subjectId, role: "subject", workspace_id: wsId });

          // Peers are NOT assigned here for subject_nominates/manager_nominates modes
          // They'll be assigned via a nomination step after launch
        }
      } else {
        let targetUsers: { id: string }[] = [];
        if (targetMode === "all") {
          const { data } = await supabase.from("users").select("id").eq("workspace_id", wsId);
          targetUsers = data || [];
        } else if (targetMode === "departments") {
          const { data } = await supabase.from("users").select("id, department").eq("workspace_id", wsId);
          targetUsers = (data || []).filter((u: any) => selectedDepartments.has(u.department || ""));
        } else {
          targetUsers = Array.from(selectedPeople).map(id => ({ id }));
        }
        for (const wu of targetUsers) {
          participants.push({ survey_id: survey.id, user_id: wu.id, role: "respondent", workspace_id: wsId });
        }
      }

      // Deduplicate
      const seen = new Set<string>();
      const uniqueParticipants = participants.filter(p => {
        const key = `${p.user_id}:${p.subject_user_id || ""}:${p.role}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (uniqueParticipants.length) {
        const { error: partErr } = await supabase.from("survey_participants").insert(uniqueParticipants);
        if (partErr) throw partErr;
      }

      setNamiParticipantCount(uniqueParticipants.length);
      setPendingSurveyId(survey.id);
      setShowNamiConfirm(true);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function confirmNamiSend() {
    if (!pendingSurveyId) return;
    setLoading(true);
    try {
      const sendAt = namiScheduleMode === "schedule" && namiScheduleDate
        ? new Date(namiScheduleDate).toISOString() : null;

      const identity = await getClientIdentity(supabase);
      const wsId = identity?.workspaceId;

      const updatePayload: any = { nami_confirmed: true, status: "active" };

      if (namiScheduleMode === "recurring") {
        // Fetch current config and merge recurrence settings
        const { data: currentSurvey } = await supabase.from("surveys").select("config").eq("id", pendingSurveyId).single();
        updatePayload.config = {
          ...(currentSurvey?.config || {}),
          recurrence,
          recurrence_day: recurrenceDay,
          last_recurrence_at: null,
        };
      } else {
        updatePayload.nami_send_at = sendAt;
      }

      await supabase.from("surveys").update(updatePayload).eq("id", pendingSurveyId).eq("workspace_id", wsId);

      // Send immediately for "now" mode or first send of recurring
      if (!sendAt) {
        await supabase.functions.invoke("nami-bot", {
          body: { action: "launch_survey", survey_id: pendingSurveyId },
        });
      }

      router.push(`/dashboard/surveys/${pendingSurveyId}`);
    } catch (e: any) {
      setError(e.message || "Failed to send Nami messages");
      setLoading(false);
    }
  }

  // Determine which guidance to show
  const currentGuide = GUIDANCE[activeGuide] || GUIDANCE["type-360"];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/surveys"><ArrowLeft className="h-4 w-4 mr-1" />Back</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New Survey</h1>
          <p className="text-sm text-muted-foreground">Step {step} of 3</p>
        </div>
      </div>

      {error && <div className="rounded-md bg-destructive/10 text-destructive text-sm px-4 py-3 mb-4">{error}</div>}

      <div className="flex gap-8">
        {/* Left side — Builder */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* Step 1: Pick type */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">What kind of survey would you like to run?</p>
              <div className="grid gap-3">
                {SURVEY_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => { setSurveyType(t.value); setActiveGuide(`type-${t.value}`); }}
                    onFocus={() => setActiveGuide(`type-${t.value}`)}
                    className={`flex items-start gap-4 p-4 rounded-lg border-2 text-left transition-colors ${
                      surveyType === t.value ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${t.color}`}>
                      <t.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-medium text-foreground">{t.label}</div>
                      <div className="text-sm text-muted-foreground mt-0.5">{t.description}</div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex justify-end">
                <Button onClick={() => { setStep(2); setActiveGuide("name"); }} disabled={!surveyType}>
                  Next <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Configure */}
          {step === 2 && surveyType && (
            <div className="space-y-6">
              <div className="space-y-2" onFocus={() => setActiveGuide("name")}>
                <Label htmlFor="name">Survey name</Label>
                <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Q1 2026 360 Review" onFocus={() => setActiveGuide("name")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="closes">Close date (optional)</Label>
                <Input id="closes" type="date" value={closesAt} onChange={e => setClosesAt(e.target.value)} />
              </div>

              {surveyType === "360" && (
                <>
                  {/* Subjects */}
                  <div className="space-y-2" onClick={() => setActiveGuide("subjects")}>
                    <div className="flex items-center justify-between">
                      <Label>Who is being reviewed?</Label>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="text-xs h-7"
                          onClick={() => setSelectedSubjects(new Set(team.map(u => u.id)))}>
                          Select all
                        </Button>
                        {selectedSubjects.size > 0 && (
                          <Button variant="ghost" size="sm" className="text-xs h-7"
                            onClick={() => setSelectedSubjects(new Set())}>
                            Clear
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
                      {team.map(u => (
                        <label key={u.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 cursor-pointer">
                          <Checkbox
                            checked={selectedSubjects.has(u.id)}
                            onCheckedChange={checked => {
                              setSelectedSubjects(prev => {
                                const next = new Set(prev);
                                checked ? next.add(u.id) : next.delete(u.id);
                                return next;
                              });
                            }}
                          />
                          <span className="text-sm">{u.slack_name}</span>
                          {u.job_title && <span className="text-xs text-muted-foreground">{u.job_title}</span>}
                        </label>
                      ))}
                    </div>
                    {selectedSubjects.size > 0 && (
                      <p className="text-xs text-muted-foreground">{selectedSubjects.size} selected</p>
                    )}
                  </div>

                  {/* Auto-assigned summary */}
                  {selectedSubjects.size > 0 && autoAssignSummary && (
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                      <p className="text-sm font-medium">Automatically included from org chart</p>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>Self-review: {autoAssignSummary.selfCount}</span>
                        <span>Manager review: {autoAssignSummary.managerCount}</span>
                        <span>Direct reports: {autoAssignSummary.directReportCount}</span>
                      </div>
                    </div>
                  )}

                  {/* Peer nomination */}
                  {selectedSubjects.size > 0 && (
                    <div className="space-y-3" onClick={() => setActiveGuide("peers")}>
                      <Label>How should peers be selected?</Label>
                      <div className="space-y-2">
                        {([
                          { value: "subject_nominates" as PeerMode, label: "Subjects nominate their own peers", desc: "Each person picks 3-5 colleagues who know their work best" },
                          { value: "manager_nominates" as PeerMode, label: "Managers nominate peers", desc: "Managers choose peers for their direct reports" },
                          { value: "admin_assigns" as PeerMode, label: "Skip peers for now", desc: "Launch without peer reviews — you can add them later" },
                        ]).map(opt => (
                          <label key={opt.value}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                              peerMode === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                            }`}>
                            <input
                              type="radio"
                              name="peerMode"
                              checked={peerMode === opt.value}
                              onChange={() => setPeerMode(opt.value)}
                              className="mt-0.5 accent-primary"
                            />
                            <div>
                              <p className="text-sm font-medium">{opt.label}</p>
                              <p className="text-xs text-muted-foreground">{opt.desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Questions — collapsed by default */}
                  <div className="space-y-2" onClick={() => setActiveGuide("questions")}>
                    <button
                      type="button"
                      className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
                      onClick={(e) => { e.stopPropagation(); setShowQuestions(!showQuestions); setActiveGuide("questions"); }}
                    >
                      {showQuestions ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      Questions ({questions360.length})
                      <span className="text-xs text-muted-foreground font-normal">— click to customise</span>
                    </button>

                    {showQuestions && (
                      <div className="space-y-2 pl-6">
                        {questions360.map((q, i) => (
                          <div key={q.id} className="flex gap-2 items-start">
                            <div className="flex-1 space-y-1">
                              <Input value={q.label} onChange={e => updateQuestion("360", q.id, "label", e.target.value)} placeholder="Question text" />
                              <div className="flex gap-2 items-center">
                                <select
                                  value={q.type}
                                  onChange={e => updateQuestion("360", q.id, "type", e.target.value)}
                                  className="text-xs border rounded px-2 py-1 bg-background"
                                >
                                  <option value="rating_7">Rating (1-7)</option>
                                  <option value="text">Open text</option>
                                </select>
                                <Badge variant="outline" className="text-xs">Q{i + 1}</Badge>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => removeQuestion("360", q.id)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" onClick={() => addQuestion("360")}>
                          <Plus className="h-3.5 w-3.5 mr-1" />Add question
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {surveyType === "pulse" && (
                <div className="space-y-2">
                  <Label>Questions <span className="text-xs text-muted-foreground font-normal ml-1">(5-15 recommended)</span></Label>
                  <div className="space-y-2">
                    {pulseQuestions.map((q, i) => (
                      <div key={q.id} className="flex gap-2 items-start">
                        <div className="flex-1 space-y-1">
                          <Input value={q.label} onChange={e => updateQuestion("pulse", q.id, "label", e.target.value)} placeholder="Question text" />
                          <select
                            value={q.type}
                            onChange={e => updateQuestion("pulse", q.id, "type", e.target.value)}
                            className="text-xs border rounded px-2 py-1 bg-background"
                          >
                            <option value="rating_7">Rating (1-7)</option>
                            <option value="text">Open text</option>
                          </select>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeQuestion("pulse", q.id)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => addQuestion("pulse")}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Add question
                  </Button>
                </div>
              )}

              {surveyType === "enps" && (
                <div className="space-y-2">
                  <Label>Follow-up question</Label>
                  <p className="text-xs text-muted-foreground">Shown after the 0-10 rating</p>
                  <Input value={enpsFollowUp} onChange={e => setEnpsFollowUp(e.target.value)} />
                </div>
              )}

              {(surveyType === "pulse" || surveyType === "enps") && (
                <div className="space-y-3" onFocus={() => setActiveGuide("participants")}>
                  <Label>Who should receive this survey?</Label>
                  <div className="space-y-2">
                    {[
                      { value: "all" as const, label: "All workspace members", desc: `Everyone in your workspace (${team.length} people)` },
                      { value: "departments" as const, label: "Select departments", desc: "Target specific departments" },
                      { value: "people" as const, label: "Select specific people", desc: "Hand-pick individual participants" },
                    ].map((opt) => (
                      <label key={opt.value} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${targetMode === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-border/80"}`}>
                        <input type="radio" name="targetMode" checked={targetMode === opt.value} onChange={() => { setTargetMode(opt.value); setActiveGuide("participants"); }} className="accent-primary mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">{opt.label}</p>
                          <p className="text-xs text-muted-foreground">{opt.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  {targetMode === "departments" && (
                    <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-1.5">
                      {departments.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No departments found. Assign departments to team members in the Directory.</p>
                      ) : departments.map((dept) => (
                        <label key={dept} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={selectedDepartments.has(dept)}
                            onCheckedChange={(checked) => {
                              const next = new Set(selectedDepartments);
                              if (checked) next.add(dept); else next.delete(dept);
                              setSelectedDepartments(next);
                            }}
                          />
                          <span>{dept}</span>
                          <span className="text-xs text-muted-foreground ml-auto">{team.filter(u => u.department === dept).length} people</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {targetMode === "people" && (
                    <div className="space-y-2">
                      <Input placeholder="Search people..." value={peopleSearch} onChange={e => setPeopleSearch(e.target.value)} />
                      <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-1.5">
                        {team.filter(u => !peopleSearch || u.slack_name?.toLowerCase().includes(peopleSearch.toLowerCase())).map((u) => (
                          <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={selectedPeople.has(u.id)}
                              onCheckedChange={(checked) => {
                                const next = new Set(selectedPeople);
                                if (checked) next.add(u.id); else next.delete(u.id);
                                setSelectedPeople(next);
                              }}
                            />
                            <span>{u.slack_name}</span>
                            {u.department && <span className="text-xs text-muted-foreground ml-auto">{u.department}</span>}
                          </label>
                        ))}
                      </div>
                      {selectedPeople.size > 0 && <p className="text-xs text-muted-foreground">{selectedPeople.size} people selected</p>}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => { setStep(1); setActiveGuide(surveyType ? `type-${surveyType}` : "type-360"); }}>
                  <ArrowLeft className="h-4 w-4 mr-1.5" />Back
                </Button>
                <Button
                  onClick={() => {
                    if (surveyType === "360" || surveyType === "pulse") {
                      const activeQuestions = surveyType === "360" ? questions360 : pulseQuestions;
                      const firstEmptyIndex = activeQuestions.findIndex(q => !q.label.trim());
                      if (firstEmptyIndex >= 0) {
                        setError(`Question ${firstEmptyIndex + 1} is empty — every question needs a label before you can continue.`);
                        return;
                      }
                    }
                    setError(null);
                    setStep(3);
                    setActiveGuide("review");
                  }}
                  disabled={!name.trim() || (surveyType === "360" && selectedSubjects.size === 0)}
                >
                  Review <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Review & Launch */}
          {step === 3 && surveyType && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ready to launch</CardTitle>
                  <CardDescription>Review your survey before sending Slack notifications</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <Badge variant="outline">{surveyType === "360" ? "360° Review" : surveyType === "pulse" ? "Pulse" : "eNPS"}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{name}</span>
                  </div>
                  {surveyType === "360" && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Subjects</span>
                        <span>{selectedSubjects.size} {selectedSubjects.size === 1 ? "person" : "people"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Auto-included</span>
                        <span className="text-xs">Self, Manager, Direct reports</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Peer selection</span>
                        <span className="text-xs">{
                          peerMode === "subject_nominates" ? "Subjects nominate" :
                          peerMode === "manager_nominates" ? "Managers nominate" : "Skipped"
                        }</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Questions</span>
                        <span>{questions360.length}</span>
                      </div>
                    </>
                  )}
                  {surveyType === "pulse" && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Questions</span>
                      <span>{pulseQuestions.length}</span>
                    </div>
                  )}
                  {(surveyType === "pulse" || surveyType === "enps") && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Participants</span>
                      <span>{targetMode === "all" ? "All members" : targetMode === "departments" ? `${selectedDepartments.size} department${selectedDepartments.size !== 1 ? "s" : ""}` : `${selectedPeople.size} people`}</span>
                    </div>
                  )}
                  {closesAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Closes</span>
                      <span>{closesAt}</span>
                    </div>
                  )}
                  {surveyType === "360" && peerMode !== "admin_assigns" && (
                    <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2 text-blue-700 text-xs mt-2">
                      After launch, {peerMode === "subject_nominates" ? "each subject" : "managers"} will receive a Slack DM to nominate peer reviewers.
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => { setStep(2); setActiveGuide("subjects"); }}>
                  <ArrowLeft className="h-4 w-4 mr-1.5" />Back
                </Button>
                <Button onClick={handleLaunch} disabled={loading}>
                  {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Launching...</> : "Launch Survey"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right side — Contextual guidance panel.
            Shown at md+ (was lg-only) so tablet users don't lose this key help. */}
        <div className="w-64 md:w-72 shrink-0 hidden md:block">
          <div className="sticky top-6">
            <div className="rounded-lg border bg-muted/20 p-5 space-y-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <h3 className="text-sm font-semibold">{currentGuide.title}</h3>
              </div>
              <div className="space-y-2.5">
                {currentGuide.content.map((paragraph, i) => (
                  <p key={i} className="text-xs text-muted-foreground leading-relaxed">{paragraph}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Nami confirm modal */}
      {showNamiConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl p-6 max-w-md w-full mx-4 space-y-4 shadow-xl">
            <h3 className="text-lg font-semibold">Nami will message participants</h3>
            <p className="text-sm text-muted-foreground">
              <strong>{namiParticipantCount}</strong> participants will receive a Slack DM to complete the survey.
            </p>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="namiSchedule" checked={namiScheduleMode === "now"}
                  onChange={() => setNamiScheduleMode("now")} className="accent-primary" />
                Send now
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="namiSchedule" checked={namiScheduleMode === "schedule"}
                  onChange={() => setNamiScheduleMode("schedule")} className="accent-primary" />
                Schedule
              </label>
              {(surveyType === "pulse" || surveyType === "enps") && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="namiSchedule" checked={namiScheduleMode === "recurring"}
                    onChange={() => setNamiScheduleMode("recurring")} className="accent-primary" />
                  Recurring
                </label>
              )}
            </div>
            {namiScheduleMode === "schedule" && (
              <input type="datetime-local" value={namiScheduleDate}
                onChange={(e) => setNamiScheduleDate(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
            )}
            {namiScheduleMode === "recurring" && (
              <div className="space-y-3 rounded-lg border border-border p-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Frequency</Label>
                  <div className="flex gap-2">
                    {([["weekly", "Weekly"], ["biweekly", "Every 2 weeks"], ["monthly", "Monthly"]] as const).map(([val, label]) => (
                      <label key={val} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs cursor-pointer border ${recurrence === val ? "border-primary bg-primary/5 font-medium" : "border-border"}`}>
                        <input type="radio" name="recurrence" checked={recurrence === val} onChange={() => setRecurrence(val)} className="sr-only" />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Day of the week</Label>
                  <select value={recurrenceDay} onChange={e => setRecurrenceDay(e.target.value)} className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background">
                    {["monday", "tuesday", "wednesday", "thursday", "friday"].map(d => (
                      <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-muted-foreground">Nami will automatically send this survey on the selected day. First send happens immediately.</p>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button onClick={confirmNamiSend} disabled={loading || (namiScheduleMode === "schedule" && !namiScheduleDate)}
                className="flex-1">
                {loading ? "Sending..." : "Confirm & Send"}
              </Button>
              <Button variant="outline" onClick={async () => {
                  setShowNamiConfirm(false);
                  const identity = await getClientIdentity(supabase);
                  if (identity?.workspaceId) {
                    await supabase.from("surveys").update({ status: "active" }).eq("id", pendingSurveyId).eq("workspace_id", identity.workspaceId);
                  }
                  router.push(`/dashboard/surveys/${pendingSurveyId}`);
                }}
                className="flex-1">
                Skip Nami
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
