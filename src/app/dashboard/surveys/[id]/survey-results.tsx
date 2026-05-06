"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SurveyQuestion = {
  id: string;
  type: string;
  label: string;
};

type SurveyConfig = {
  questions?: SurveyQuestion[];
  min_raters_to_show?: number;
};

type SurveyRow = {
  id: string;
  type: string;
  config?: SurveyConfig;
};

type SurveyResponseRow = {
  id?: string;
  participant_id?: string;
  subject_user_id?: string;
  answers?: Record<string, unknown> & { score?: string | number; follow_up?: string };
};

type SurveyParticipantRow = {
  id: string;
  role: "self" | "subject" | "rater";
  subject_user_id: string;
};

interface Props {
  survey: SurveyRow;
  responses: SurveyResponseRow[];
  participants: SurveyParticipantRow[];
  subjectNames: Record<string, string>;
}

function eNPSScore(responses: SurveyResponseRow[]) {
  const scores = responses.map(r => parseInt(String(r.answers?.score ?? ""))).filter(s => !isNaN(s));
  if (!scores.length) return null;
  const promoters = scores.filter(s => s >= 9).length;
  const detractors = scores.filter(s => s <= 6).length;
  return Math.round(((promoters - detractors) / scores.length) * 100);
}

export function SurveyResults({ survey, responses, participants, subjectNames }: Props) {
  const [selected360Subject, setSelected360Subject] = useState<string | null>(null);

  // ── eNPS ──────────────────────────────────────────────────────────────────
  if (survey.type === "enps") {
    const score = eNPSScore(responses);
    const followUps = responses.map(r => r.answers?.follow_up).filter(Boolean);
    const scores = responses.map(r => parseInt(String(r.answers?.score ?? ""))).filter(s => !isNaN(s));
    const promoters = scores.filter(s => s >= 9).length;
    const passives = scores.filter(s => s >= 7 && s <= 8).length;
    const detractors = scores.filter(s => s <= 6).length;

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">eNPS Score</CardTitle></CardHeader>
          <CardContent>
            {score === null ? (
              <p className="text-sm text-muted-foreground">No responses yet.</p>
            ) : (
              <>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-4xl font-bold text-foreground">{score > 0 ? `+${score}` : score}</span>
                  <span className="text-xs text-muted-foreground">Based on {scores.length} response{scores.length !== 1 ? "s" : ""}</span>
                </div>
                {/* Score gauge bar */}
                <div className="relative h-3 rounded-full overflow-hidden mb-4">
                  <div className="absolute inset-0 flex">
                    <div className="h-full bg-red-400/60" style={{ width: "50%" }} />
                    <div className="h-full bg-amber-400/60" style={{ width: "15%" }} />
                    <div className="h-full bg-emerald-400/60" style={{ width: "35%" }} />
                  </div>
                  <div
                    className="absolute top-0 h-full w-1 bg-foreground rounded-full"
                    style={{ left: `${Math.min(100, Math.max(0, ((score + 100) / 200) * 100))}%` }}
                  />
                </div>
                <div className="flex gap-6 text-sm">
                  <div className="text-center">
                    <div className="text-2xl font-semibold text-green-600">{promoters}</div>
                    <div className="text-xs text-muted-foreground">Promoters (9-10)</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-semibold text-yellow-600">{passives}</div>
                    <div className="text-xs text-muted-foreground">Passives (7-8)</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-semibold text-red-500">{detractors}</div>
                    <div className="text-xs text-muted-foreground">Detractors (0-6)</div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
        {followUps.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Open Responses</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {followUps.map((text, i) => (
                  <div key={i} className="text-sm text-foreground bg-muted/40 rounded-md px-3 py-2 border">{text}</div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ── Pulse ─────────────────────────────────────────────────────────────────
  if (survey.type === "pulse") {
    const questions: SurveyQuestion[] = survey.config?.questions || [];
    if (!questions.length) {
      return <p className="text-sm text-muted-foreground">No questions configured.</p>;
    }
    return (
      <div className="space-y-4">
        {questions.map((q) => {
          const qResponses = responses
            .map(r => r.answers?.[q.id])
            .filter(v => v !== undefined && v !== null && v !== "");

          if (q.type === "text") {
            return (
              <Card key={q.id}>
                <CardHeader><CardTitle className="text-sm font-medium">{q.label}</CardTitle></CardHeader>
                <CardContent>
                  {qResponses.length === 0
                    ? <p className="text-sm text-muted-foreground">No responses yet.</p>
                    : (
                      <div className="space-y-2">
                        {qResponses.map((text, i) => (
                          <div key={i} className="text-sm bg-muted/40 rounded-md px-3 py-2 border">{String(text)}</div>
                        ))}
                      </div>
                    )}
                </CardContent>
              </Card>
            );
          }

          // rating_7: distribution bar chart
          const numericResponses = qResponses.map(v => parseInt(String(v), 10)).filter(n => !isNaN(n));
          const counts = [1, 2, 3, 4, 5, 6, 7].map(n => numericResponses.filter(v => v === n).length);
          const avg = numericResponses.length
            ? (numericResponses.reduce((a, b) => a + b, 0) / numericResponses.length).toFixed(1)
            : null;

          return (
            <Card key={q.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm font-medium">{q.label}</CardTitle>
                  {avg && <span className="text-xs text-muted-foreground">avg {avg}/7</span>}
                </div>
              </CardHeader>
              <CardContent>
                {qResponses.length === 0
                  ? <p className="text-sm text-muted-foreground">No responses yet.</p>
                  : (
                    <div className="space-y-1.5">
                      {[1, 2, 3, 4, 5, 6, 7].map(n => {
                        const pct = numericResponses.length > 0 ? Math.round((counts[n - 1] / numericResponses.length) * 100) : 0;
                        return (
                          <div key={n} className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-3 text-right">{n}</span>
                            <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                              <div
                                className="h-full bg-primary/70 rounded transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-12 text-right">{counts[n - 1]} ({pct}%)</span>
                          </div>
                        );
                      })}
                      <p className="text-xs text-muted-foreground mt-1">{numericResponses.length} response{numericResponses.length !== 1 ? "s" : ""}</p>
                    </div>
                  )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  // ── 360 ───────────────────────────────────────────────────────────────────
  if (survey.type === "360") {
    const subjects = participants.filter((p) => p.role === "subject");
    if (!subjects.length) {
      return <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">No subjects configured.</p></CardContent></Card>;
    }

    const activeSubjectId = selected360Subject || subjects[0]?.subject_user_id;
    const subjectResponses = responses.filter((r: SurveyResponseRow) => r.subject_user_id === activeSubjectId);
    const selfParticipant = participants.find(p => p.subject_user_id === activeSubjectId && p.role === "self");
    const selfResp = selfParticipant
      ? subjectResponses.find(r => r.participant_id === selfParticipant.id)
      : null;
    const othersResp = subjectResponses.filter(r => r !== selfResp);
    const MIN_RATERS = survey.config?.min_raters_to_show || 3;
    const questions: SurveyQuestion[] = survey.config?.questions || [];

    return (
      <div className="space-y-4">
        {/* Subject selector for multi-subject surveys */}
        {subjects.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {subjects.map((s) => (
              <button
                key={s.subject_user_id}
                onClick={() => setSelected360Subject(s.subject_user_id)}
                className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                  activeSubjectId === s.subject_user_id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                {subjectNames[s.subject_user_id] || s.subject_user_id.slice(0, 8) + "…"}
              </button>
            ))}
          </div>
        )}

        {othersResp.length === 0 && !selfResp ? (
          <Card>
            <CardContent className="pt-6 text-center py-8">
              <p className="text-sm text-muted-foreground">No responses yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {othersResp.length < MIN_RATERS && othersResp.length > 0 && (
              <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
                {othersResp.length} of {MIN_RATERS} raters responded — anonymity threshold not yet met. Results shown to admins only.
              </div>
            )}
            {questions.filter((q) => q.type === "rating_7").map((q) => {
              const selfScore = selfResp ? parseFloat(String(selfResp.answers?.[q.id] ?? "")) : null;
              const otherScores = othersResp
                .map((r) => parseFloat(String(r.answers?.[q.id] ?? "")))
                .filter(s => !isNaN(s));
              const othersAvg = otherScores.length
                ? (otherScores.reduce((a, b) => a + b, 0) / otherScores.length)
                : null;
              const gap = selfScore !== null && othersAvg !== null ? othersAvg - selfScore : null;

              return (
                <Card key={q.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{q.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-6 items-end">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-foreground">{selfScore !== null && !isNaN(selfScore) ? selfScore : "—"}</div>
                        <div className="text-xs text-muted-foreground">Self</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{othersAvg !== null ? othersAvg.toFixed(1) : "—"}</div>
                        <div className="text-xs text-muted-foreground">Others avg ({otherScores.length})</div>
                      </div>
                      {gap !== null && (
                        <div className="text-center">
                          <div className={`text-2xl font-bold ${
                            Math.abs(gap) <= 0.5 ? "text-muted-foreground"
                            : Math.abs(gap) <= 1.5 ? "text-amber-600"
                            : "text-red-600"
                          }`}>
                            {gap > 0 ? "+" : ""}{gap.toFixed(1)}
                          </div>
                          <div className="text-xs text-muted-foreground" title="Others' average minus Self score">Gap</div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {questions.filter((q) => q.type === "text").map((q) => {
              const textResp = othersResp.map((r) => r.answers?.[q.id]).filter(Boolean) as string[];
              if (!textResp.length) return null;
              return (
                <Card key={q.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{q.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {textResp.map((t, i) => (
                        <div key={i} className="text-sm bg-muted/40 rounded-md px-3 py-2 border">{t}</div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return null;
}
