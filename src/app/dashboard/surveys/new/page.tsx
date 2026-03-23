"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Loader2, Plus, X, Users, BarChart2, TrendingUp } from "lucide-react";
import Link from "next/link";

type SurveyType = "360" | "pulse" | "enps";
type RaterGroup = "self" | "manager" | "peer" | "direct_report";

interface Question {
  id: string;
  type: "rating_7" | "text" | "single_select";
  label: string;
  required: boolean;
  options?: string[];
}

const SURVEY_TYPES = [
  { value: "360" as SurveyType, label: "360° Review", description: "Multi-rater development feedback", icon: Users, color: "border-purple-200 bg-purple-50" },
  { value: "pulse" as SurveyType, label: "Pulse Survey", description: "Quick team temperature check", icon: BarChart2, color: "border-blue-200 bg-blue-50" },
  { value: "enps" as SurveyType, label: "eNPS", description: "Would you recommend working here?", icon: TrendingUp, color: "border-green-200 bg-green-50" },
];

const RATER_GROUPS: { value: RaterGroup; label: string }[] = [
  { value: "self", label: "Self" },
  { value: "manager", label: "Manager" },
  { value: "peer", label: "Peers" },
  { value: "direct_report", label: "Direct Reports" },
];

export default function NewSurveyPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNamiConfirm, setShowNamiConfirm] = useState(false);
  const [namiScheduleMode, setNamiScheduleMode] = useState<"now" | "schedule">("now");
  const [namiScheduleDate, setNamiScheduleDate] = useState("");
  const [pendingSurveyId, setPendingSurveyId] = useState<string | null>(null);
  const [namiParticipantCount, setNamiParticipantCount] = useState(0);

  // Step 1
  const [surveyType, setSurveyType] = useState<SurveyType | null>(null);

  // Step 2 — shared
  const [name, setName] = useState("");
  const [closesAt, setClosesAt] = useState("");

  // Step 2 — 360 specific
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());
  const [raterGroups, setRaterGroups] = useState<Set<RaterGroup>>(new Set(["self", "manager", "peer"]));
  const [questions360, setQuestions360] = useState<Question[]>([
    { id: crypto.randomUUID(), type: "rating_7", label: "Communicates clearly and effectively", required: true },
    { id: crypto.randomUUID(), type: "rating_7", label: "Delivers on commitments consistently", required: true },
    { id: crypto.randomUUID(), type: "text", label: "What should this person do more of?", required: false },
    { id: crypto.randomUUID(), type: "text", label: "What should this person do differently?", required: false },
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
      const { data } = await supabase.from("users").select("id, slack_name, job_title").order("slack_name");
      setSubjects(data || []);
    }
    loadTeam();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setError("Select at least one person to review before launching a 360 survey.");
      return;
    }
    if (surveyType === "360" || surveyType === "pulse") {
      const activeQuestions = surveyType === "360" ? questions360 : pulseQuestions;
      if (activeQuestions.some(q => !q.label.trim())) {
        setError("All questions must have a label. Please fill in any empty questions or remove them.");
        return;
      }
    }
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const appUserId = user.user_metadata?.app_user_id;
      const { data: userData } = await supabase.from("users").select("id, workspace_id, manager_id").eq("id", appUserId).single();
      if (!userData) throw new Error("User not found");

      let config: any = {};
      if (surveyType === "360") {
        config = { questions: questions360, rater_groups: [...raterGroups], min_raters_to_show: 3 };
      } else if (surveyType === "pulse") {
        config = { questions: pulseQuestions };
      } else {
        config = { follow_up: enpsFollowUp };
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

      const participants: any[] = [];
      if (surveyType === "360") {
        const { data: wsUsers } = await supabase
          .from("users")
          .select("id, manager_id")
          .eq("workspace_id", userData.workspace_id);

        for (const subjectId of selectedSubjects) {
          const subjectData = wsUsers?.find(u => u.id === subjectId);
          for (const wu of (wsUsers || [])) {
            if (wu.id === subjectId) {
              if (raterGroups.has("self")) {
                participants.push({ survey_id: survey.id, user_id: wu.id, subject_user_id: subjectId, role: "self" });
              }
            } else if (raterGroups.has("manager") && wu.id === subjectData?.manager_id) {
              participants.push({ survey_id: survey.id, user_id: wu.id, subject_user_id: subjectId, role: "manager" });
            } else if (raterGroups.has("direct_report") && wu.manager_id === subjectId) {
              participants.push({ survey_id: survey.id, user_id: wu.id, subject_user_id: subjectId, role: "direct_report" });
            } else if (raterGroups.has("peer")) {
              participants.push({ survey_id: survey.id, user_id: wu.id, subject_user_id: subjectId, role: "peer" });
            }
          }
          // Always add subject tracking entry
          participants.push({ survey_id: survey.id, user_id: subjectId, subject_user_id: subjectId, role: "subject" });
        }
      } else {
        const { data: wsUsers } = await supabase.from("users").select("id").eq("workspace_id", userData.workspace_id);
        for (const wu of (wsUsers || [])) {
          participants.push({ survey_id: survey.id, user_id: wu.id, role: "respondent" });
        }
      }

      // Deduplicate participants by user_id + subject_user_id + role
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

      await supabase.from("surveys").update({
        nami_send_at: sendAt, nami_confirmed: true
      }).eq("id", pendingSurveyId);

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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/surveys"><ArrowLeft className="h-4 w-4 mr-1" />Back</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New Survey</h1>
          <p className="text-sm text-muted-foreground">Step {step} of 3</p>
        </div>
      </div>

      {error && <div className="rounded-md bg-destructive/10 text-destructive text-sm px-4 py-3">{error}</div>}

      {/* Step 1: Pick type */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">What kind of survey would you like to run?</p>
          <div className="grid gap-3">
            {SURVEY_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => setSurveyType(t.value)}
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
            <Button onClick={() => setStep(2)} disabled={!surveyType}>
              Next <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Configure */}
      {step === 2 && surveyType && (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Survey name</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Q1 360 Review" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="closes">Close date (optional)</Label>
            <Input id="closes" type="date" value={closesAt} onChange={e => setClosesAt(e.target.value)} />
          </div>

          {surveyType === "360" && (
            <>
              <div className="space-y-2">
                <Label>Who are you reviewing?</Label>
                <p className="text-xs text-muted-foreground">Select one or more team members</p>
                <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
                  {subjects.map(u => (
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
              </div>
              <div className="space-y-2">
                <Label>Rater groups</Label>
                <div className="flex flex-wrap gap-4">
                  {RATER_GROUPS.map(g => (
                    <label key={g.value} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={raterGroups.has(g.value)}
                        onCheckedChange={checked => {
                          setRaterGroups(prev => {
                            const next = new Set(prev);
                            checked ? next.add(g.value) : next.delete(g.value);
                            return next;
                          });
                        }}
                      />
                      <span className="text-sm">{g.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Questions <span className="text-xs text-muted-foreground font-normal ml-1">(max 12 recommended)</span></Label>
                <div className="space-y-2">
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
                            <option value="rating_7">Rating (1–7)</option>
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
                </div>
                <Button variant="outline" size="sm" onClick={() => addQuestion("360")}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Add question
                </Button>
              </div>
            </>
          )}

          {surveyType === "pulse" && (
            <div className="space-y-2">
              <Label>Questions <span className="text-xs text-muted-foreground font-normal ml-1">(5–15 recommended)</span></Label>
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
                        <option value="rating_7">Rating (1–7)</option>
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
              <p className="text-xs text-muted-foreground">Shown after the 0–10 rating in a modal</p>
              <Input value={enpsFollowUp} onChange={e => setEnpsFollowUp(e.target.value)} />
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4 mr-1.5" />Back</Button>
            <Button
              onClick={() => {
                if (surveyType === "360" || surveyType === "pulse") {
                  const activeQuestions = surveyType === "360" ? questions360 : pulseQuestions;
                  if (activeQuestions.some(q => !q.label.trim())) {
                    setError("All questions must have a label. Please fill in any empty questions or remove them.");
                    return;
                  }
                }
                setError(null);
                setStep(3);
              }}
              disabled={!name.trim()}
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
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subjects</span>
                  <span>{selectedSubjects.size} person{selectedSubjects.size !== 1 ? "s" : ""}</span>
                </div>
              )}
              {surveyType === "360" && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Questions</span>
                  <span>{questions360.length}</span>
                </div>
              )}
              {surveyType === "pulse" && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Questions</span>
                  <span>{pulseQuestions.length}</span>
                </div>
              )}
              {closesAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Closes</span>
                  <span>{closesAt}</span>
                </div>
              )}
              <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2 text-blue-700 text-xs mt-2">
                Participants will receive a Slack DM immediately on launch.
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4 mr-1.5" />Back</Button>
            <Button onClick={handleLaunch} disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Launching...</> : "Launch Survey 🚀"}
            </Button>
          </div>
        </div>
      )}

      {showNamiConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 space-y-4 shadow-xl">
            <h3 className="text-lg font-semibold">🤖 Nami will message:</h3>
            <p className="text-sm text-zinc-600">
              <strong>{namiParticipantCount}</strong> participants will receive a Slack DM to complete the survey.
            </p>
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
                className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm" />
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={confirmNamiSend} disabled={loading || (namiScheduleMode === "schedule" && !namiScheduleDate)}
                className="flex-1 bg-emerald-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                {loading ? "Sending..." : "Confirm & Send"}
              </button>
              <button onClick={async () => {
                  setShowNamiConfirm(false);
                  try {
                    await supabase.functions.invoke("survey-notifications", {
                      body: { survey_id: pendingSurveyId, mode: "launch" },
                    });
                  } catch (e) { console.error("Notification error:", e); }
                  router.push(`/dashboard/surveys/${pendingSurveyId}`);
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
