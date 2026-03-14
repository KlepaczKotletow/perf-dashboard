"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  survey: any;
  responses: any[];
  participants: any[];
  subjectNames: Record<string, string>;
}

function eNPSScore(responses: any[]) {
  const scores = responses.map(r => parseInt(r.answers?.score)).filter(s => !isNaN(s));
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
    const scores = responses.map(r => parseInt(r.answers?.score)).filter(s => !isNaN(s));
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
                <div className="text-5xl font-bold text-foreground mb-1">{score > 0 ? `+${score}` : score}</div>
                <p className="text-xs text-muted-foreground mb-4">Range: −100 to +100 · Global benchmark ~+20</p>
                <div className="flex gap-6 text-sm">
                  <div className="text-center">
                    <div className="text-2xl font-semibold text-green-600">{promoters}</div>
                    <div className="text-xs text-muted-foreground">Promoters (9–10)</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-semibold text-yellow-600">{passives}</div>
                    <div className="text-xs text-muted-foreground">Passives (7–8)</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-semibold text-red-500">{detractors}</div>
                    <div className="text-xs text-muted-foreground">Detractors (0–6)</div>
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
    const questions: any[] = survey.config?.questions || [];
    if (!questions.length) {
      return <p className="text-sm text-muted-foreground">No questions configured.</p>;
    }
    return (
      <div className="space-y-4">
        {questions.map((q: any) => {
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
                          <div key={i} className="text-sm bg-muted/40 rounded-md px-3 py-2 border">{text}</div>
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
          const max = Math.max(...counts, 1);
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
                      {[1, 2, 3, 4, 5, 6, 7].map(n => (
                        <div key={n} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-3 text-right">{n}</span>
                          <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                            <div
                              className="h-full bg-primary/70 rounded transition-all"
                              style={{ width: `${(counts[n - 1] / max) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-5 text-right">{counts[n - 1]}</span>
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground mt-1">{qResponses.length} response{qResponses.length !== 1 ? "s" : ""}</p>
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
    const subjectResponses = responses.filter(r => r.subject_user_id === activeSubjectId);
    const selfParticipant = participants.find(p => p.subject_user_id === activeSubjectId && p.role === "self");
    const selfResp = selfParticipant
      ? subjectResponses.find(r => r.participant_id === selfParticipant.id)
      : null;
    const othersResp = subjectResponses.filter(r => r !== selfResp);
    const MIN_RATERS = (survey.config?.min_raters_to_show as number) || 3;
    const questions: any[] = survey.config?.questions || [];

    return (
      <div className="space-y-4">
        {/* Subject selector for multi-subject surveys */}
        {subjects.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {subjects.map((s: any) => (
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

        {othersResp.length < MIN_RATERS ? (
          <Card>
            <CardContent className="pt-6 text-center py-8">
              <p className="text-sm text-muted-foreground">
                Results will be visible once at least <strong>{MIN_RATERS}</strong> raters have responded.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {othersResp.length} of {MIN_RATERS} required responses received
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {questions.filter((q: any) => q.type === "rating_7").map((q: any) => {
              const selfScore = selfResp ? parseFloat(selfResp.answers?.[q.id]) : null;
              const otherScores = othersResp
                .map((r: any) => parseFloat(r.answers?.[q.id]))
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
                          <div className={`text-2xl font-bold ${gap > 0 ? "text-green-600" : gap < 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                            {gap > 0 ? "▲" : gap < 0 ? "▼" : "="} {Math.abs(gap).toFixed(1)}
                          </div>
                          <div className="text-xs text-muted-foreground">Gap</div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {questions.filter((q: any) => q.type === "text").map((q: any) => {
              const textResp = othersResp.map((r: any) => r.answers?.[q.id]).filter(Boolean);
              if (!textResp.length) return null;
              return (
                <Card key={q.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{q.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {textResp.map((t: any, i: number) => (
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
