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
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, ArrowRight, Loader2, Plus, X, Users, BarChart2, TrendingUp, Check, UserCircle, UserCog, UsersRound, ArrowDown } from "lucide-react";
import Link from "next/link";

type SurveyType = "360" | "pulse" | "enps";

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
}

const SURVEY_TYPES = [
  { value: "360" as SurveyType, label: "360° Review", description: "Multi-rater development feedback", icon: Users, color: "border-purple-200 bg-purple-50" },
  { value: "pulse" as SurveyType, label: "Pulse Survey", description: "Quick team temperature check", icon: BarChart2, color: "border-blue-200 bg-blue-50" },
  { value: "enps" as SurveyType, label: "eNPS", description: "Would you recommend working here?", icon: TrendingUp, color: "border-green-200 bg-green-50" },
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
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());
  const [includeSelf, setIncludeSelf] = useState(true);
  const [includeManager, setIncludeManager] = useState(true);
  const [includeDirectReports, setIncludeDirectReports] = useState(true);
  const [includePeers, setIncludePeers] = useState(true);
  const [maxPeers, setMaxPeers] = useState(5);
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
      const identity = await getClientIdentity(supabase);
      if (!identity) return;
      const wsId = identity.workspaceId;
      const { data } = await supabase.from("users").select("id, slack_name, job_title, manager_id").eq("workspace_id", wsId).order("slack_name");
      setTeam(data || []);
    }
    loadTeam();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute feedback source counts based on selected subjects
  const feedbackSummary = useMemo(() => {
    if (selectedSubjects.size === 0) return null;

    let withManager = 0;
    let withDirectReports = 0;
    let totalPeerCandidates = 0;

    for (const subjectId of selectedSubjects) {
      const subject = team.find(u => u.id === subjectId);
      if (!subject) continue;

      // Has a manager?
      if (subject.manager_id && team.some(u => u.id === subject.manager_id)) {
        withManager++;
      }

      // Has direct reports?
      const directReports = team.filter(u => u.manager_id === subjectId);
      if (directReports.length > 0) {
        withDirectReports++;
      }

      // Peer candidates (everyone who isn't the subject, their manager, or their direct report)
      const peers = team.filter(u =>
        u.id !== subjectId &&
        u.id !== subject.manager_id &&
        u.manager_id !== subjectId
      );
      totalPeerCandidates += Math.min(peers.length, maxPeers);
    }

    return {
      subjectCount: selectedSubjects.size,
      withManager,
      withDirectReports,
      totalPeerCandidates,
    };
  }, [selectedSubjects, team, maxPeers]);

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
      const identity = await getClientIdentity(supabase);
      if (!identity) throw new Error("Not authenticated");
      const { data: userData } = await supabase.from("users").select("id, workspace_id, manager_id").eq("id", identity.userId).single();
      if (!userData) throw new Error("User not found");

      // Build rater_groups array for config based on toggles
      const raterGroups: string[] = [];
      if (includeSelf) raterGroups.push("self");
      if (includeManager) raterGroups.push("manager");
      if (includePeers) raterGroups.push("peer");
      if (includeDirectReports) raterGroups.push("direct_report");

      let config: any = {};
      if (surveyType === "360") {
        config = { questions: questions360, rater_groups: raterGroups, max_peers: maxPeers, min_raters_to_show: 3 };
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
          const peerCandidates: string[] = [];

          for (const wu of (wsUsers || [])) {
            if (wu.id === subjectId) {
              // Self-review
              if (includeSelf) {
                participants.push({ survey_id: survey.id, user_id: wu.id, subject_user_id: subjectId, role: "self" });
              }
            } else if (includeManager && wu.id === subjectData?.manager_id) {
              // Manager review
              participants.push({ survey_id: survey.id, user_id: wu.id, subject_user_id: subjectId, role: "manager" });
            } else if (includeDirectReports && wu.manager_id === subjectId) {
              // Direct report review
              participants.push({ survey_id: survey.id, user_id: wu.id, subject_user_id: subjectId, role: "direct_report" });
            } else if (includePeers) {
              // Peer candidate
              peerCandidates.push(wu.id);
            }
          }

          // Limit peers per subject
          const shuffled = peerCandidates.sort(() => Math.random() - 0.5);
          for (const peerId of shuffled.slice(0, maxPeers)) {
            participants.push({ survey_id: survey.id, user_id: peerId, subject_user_id: subjectId, role: "peer" });
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

      const identity = await getClientIdentity(supabase);
      const wsId = identity?.workspaceId;

      await supabase.from("surveys").update({
        nami_send_at: sendAt, nami_confirmed: true
      }).eq("id", pendingSurveyId).eq("workspace_id", wsId);

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
    <div className="max-w-3xl mx-auto space-y-6">
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
              {/* Subjects selection */}
              <div className="space-y-2">
                <Label>Who is being reviewed?</Label>
                <p className="text-xs text-muted-foreground">Select the people who will receive 360 feedback</p>
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

              {/* Feedback sources — auto-assigned based on org chart */}
              {selectedSubjects.size > 0 && feedbackSummary && (
                <div className="space-y-3">
                  <div>
                    <Label>Feedback sources</Label>
                    <p className="text-xs text-muted-foreground">Reviewers are automatically assigned based on your org chart. Toggle which perspectives to include.</p>
                  </div>

                  <div className="rounded-lg border divide-y">
                    {/* Self */}
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <UserCircle className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Self-review</p>
                          <p className="text-xs text-muted-foreground">Each subject rates themselves</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="text-xs">{feedbackSummary.subjectCount} {feedbackSummary.subjectCount === 1 ? "person" : "people"}</Badge>
                        <Switch checked={includeSelf} onCheckedChange={setIncludeSelf} />
                      </div>
                    </div>

                    {/* Manager */}
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <UserCog className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Manager review</p>
                          <p className="text-xs text-muted-foreground">Their direct manager provides feedback</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {feedbackSummary.withManager < feedbackSummary.subjectCount ? (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">{feedbackSummary.withManager} of {feedbackSummary.subjectCount} have a manager</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs"><Check className="h-3 w-3 mr-1" />All have managers</Badge>
                        )}
                        <Switch checked={includeManager} onCheckedChange={setIncludeManager} />
                      </div>
                    </div>

                    {/* Direct Reports */}
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ArrowDown className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Direct report review</p>
                          <p className="text-xs text-muted-foreground">People who report to them provide upward feedback</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {feedbackSummary.withDirectReports === 0 ? (
                          <Badge variant="outline" className="text-xs text-muted-foreground">No subjects have direct reports</Badge>
                        ) : feedbackSummary.withDirectReports < feedbackSummary.subjectCount ? (
                          <Badge variant="outline" className="text-xs">{feedbackSummary.withDirectReports} of {feedbackSummary.subjectCount} have direct reports</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs"><Check className="h-3 w-3 mr-1" />All have direct reports</Badge>
                        )}
                        <Switch checked={includeDirectReports} onCheckedChange={setIncludeDirectReports} />
                      </div>
                    </div>

                    {/* Peers */}
                    <div className="px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <UsersRound className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">Peer review</p>
                            <p className="text-xs text-muted-foreground">Colleagues provide lateral feedback (randomly assigned)</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="text-xs">{feedbackSummary.totalPeerCandidates} reviewers</Badge>
                          <Switch checked={includePeers} onCheckedChange={setIncludePeers} />
                        </div>
                      </div>
                      {includePeers && (
                        <div className="flex items-center gap-2 pl-7">
                          <Label className="text-xs text-muted-foreground whitespace-nowrap">Max peers per subject</Label>
                          <Input
                            type="number"
                            min={1}
                            max={10}
                            value={maxPeers}
                            onChange={e => setMaxPeers(Math.max(1, Math.min(10, parseInt(e.target.value) || 5)))}
                            className="w-16 h-7 text-xs"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Questions */}
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
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subjects</span>
                    <span>{selectedSubjects.size} person{selectedSubjects.size !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Feedback sources</span>
                    <span className="text-right text-xs">
                      {[
                        includeSelf && "Self",
                        includeManager && "Manager",
                        includeDirectReports && "Direct reports",
                        includePeers && `Peers (max ${maxPeers})`,
                      ].filter(Boolean).join(", ")}
                    </span>
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
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Launching...</> : "Launch Survey"}
            </Button>
          </div>
        </div>
      )}

      {showNamiConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl p-6 max-w-md w-full mx-4 space-y-4 shadow-xl">
            <h3 className="text-lg font-semibold">Nami will message participants</h3>
            <p className="text-sm text-muted-foreground">
              <strong>{namiParticipantCount}</strong> participants will receive a Slack DM to complete the survey.
            </p>
            <div className="flex gap-4">
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
            </div>
            {namiScheduleMode === "schedule" && (
              <input type="datetime-local" value={namiScheduleDate}
                onChange={(e) => setNamiScheduleDate(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
            )}
            <div className="flex gap-3 pt-2">
              <Button onClick={confirmNamiSend} disabled={loading || (namiScheduleMode === "schedule" && !namiScheduleDate)}
                className="flex-1">
                {loading ? "Sending..." : "Confirm & Send"}
              </Button>
              <Button variant="outline" onClick={() => {
                  setShowNamiConfirm(false);
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
