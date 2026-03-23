# Nami Bot Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build Nami, a conversational Slack bot that proactively DMs all participants for performance reviews, upward feedback, and surveys using interactive buttons + free text, with a reminder ladder and escalation system.

**Architecture:** New `nami-bot` Edge Function for outbound messaging (cycle launch, survey launch, reminders). Extend `slack-interactivity` for inbound Nami button presses. Extend `slack-events` for free-text DM replies. Dashboard gets confirmation modal + Nami status tracker.

**Tech Stack:** Supabase Edge Functions (Deno), Slack Block Kit, Next.js App Router, Supabase PostgreSQL

---

### Task 1: Database Migrations

**Files:**
- Create: `supabase/migrations/20260323_nami_bot_schema.sql`

**Step 1: Write and apply migration**

```sql
-- Nami scheduling columns on performance_cycles
ALTER TABLE performance_cycles
  ADD COLUMN IF NOT EXISTS nami_send_at timestamptz,
  ADD COLUMN IF NOT EXISTS nami_confirmed boolean DEFAULT false;

-- Nami scheduling columns on surveys
ALTER TABLE surveys
  ADD COLUMN IF NOT EXISTS nami_send_at timestamptz,
  ADD COLUMN IF NOT EXISTS nami_confirmed boolean DEFAULT false;

-- Track reminder count per notification
ALTER TABLE notification_log
  ADD COLUMN IF NOT EXISTS reminder_count integer DEFAULT 0;

-- Extend conversation_states for survey flows
ALTER TABLE conversation_states
  ADD COLUMN IF NOT EXISTS flow_type text DEFAULT 'review',
  ADD COLUMN IF NOT EXISTS survey_id uuid,
  ADD COLUMN IF NOT EXISTS survey_answers jsonb DEFAULT '{}';

-- Index for nami-bot cron to efficiently find pending sends
CREATE INDEX IF NOT EXISTS idx_cycles_nami_pending
  ON performance_cycles (status, nami_confirmed, nami_send_at)
  WHERE status = 'active' AND nami_confirmed = true;

CREATE INDEX IF NOT EXISTS idx_surveys_nami_pending
  ON surveys (status, nami_confirmed, nami_send_at)
  WHERE status IN ('active', 'open') AND nami_confirmed = true;

-- Index for reminder ladder: find incomplete assignments efficiently
CREATE INDEX IF NOT EXISTS idx_assignments_incomplete
  ON review_assignments (cycle_id, status)
  WHERE status != 'completed';

-- Index for notification_log reminder tracking
CREATE INDEX IF NOT EXISTS idx_notif_nami_reminders
  ON notification_log (workspace_id, user_id, event_type)
  WHERE event_type LIKE 'nami_%';
```

Apply via Supabase MCP `apply_migration` tool with name `nami_bot_schema`.

**Step 2: Verify migration applied**

Run via MCP `execute_sql`:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'performance_cycles' AND column_name IN ('nami_send_at', 'nami_confirmed');
```
Expected: 2 rows returned.

**Step 3: Commit**

```bash
git add supabase/migrations/20260323_nami_bot_schema.sql
git commit -m "feat(nami): add DB schema for Nami bot scheduling and reminders"
```

---

### Task 2: Nami Bot Edge Function — Block Kit Message Builders

This is the core message-building layer. All messages are dynamic — competency names, question text, cycle names, and employee names come from the database.

**Files:**
- Create: `supabase/functions/nami-bot/index.ts`

**Step 1: Create the nami-bot function with helpers and message builders**

The function follows the same patterns as `cycle-notifications/index.ts`:
- Uses `createClient` from `@supabase/supabase-js@2`
- Same env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DASHBOARD_URL`, `CRON_SECRET`
- Same `sendSlackDM` pattern but extended to support Block Kit `blocks` parameter
- Same `logNotification` / `rollbackNotification` for deduplication

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DASHBOARD_URL = Deno.env.get("DASHBOARD_URL") || "https://nami-ochre.vercel.app";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Slack helpers ──────────────────────────────────────────────────────
async function sendSlackBlocks(
  botToken: string, slackUserId: string, text: string, blocks: any[]
): Promise<{ ok: boolean; ts?: string }> {
  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { Authorization: `Bearer ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ channel: slackUserId, text, blocks }),
    });
    const data = await res.json();
    return { ok: data.ok === true, ts: data.ts };
  } catch { return { ok: false }; }
}

// ── Notification dedup (same pattern as cycle-notifications) ──────────
async function logNotification(
  workspaceId: string, userId: string, eventType: string, referenceId: string, reminderCount = 0
): Promise<boolean> {
  const { error } = await supabase.from("notification_log").insert({
    workspace_id: workspaceId, user_id: userId,
    event_type: eventType, reference_id: referenceId,
    reminder_count: reminderCount,
  });
  if (!error) return true;
  if ((error as any).code === "23505") return false;
  console.error("logNotification error:", error.message, { eventType, referenceId });
  return false;
}

async function rollbackNotification(
  workspaceId: string, userId: string, eventType: string, referenceId: string
): Promise<void> {
  await supabase.from("notification_log").delete()
    .eq("workspace_id", workspaceId).eq("user_id", userId)
    .eq("event_type", eventType).eq("reference_id", referenceId);
}

// ── Rating label helpers ──────────────────────────────────────────────
const ratingLabels = ["Needs improvement", "Below expectations", "Meets expectations", "Exceeds expectations", "Exceptional"];

// ── Block Kit message builders ────────────────────────────────────────

function buildSelfReviewOpening(employeeName: string, cycleName: string, deadline: string, assignmentId: string): any[] {
  return [
    { type: "section", text: { type: "mrkdwn", text: `Hey ${employeeName}! 👋 It's review time for *${cycleName}*.\nI'll walk you through it step by step — shouldn't take long!\n\nDeadline: *${deadline}*` } },
    { type: "actions", elements: [
      { type: "button", text: { type: "plain_text", text: "Let's go 🚀", emoji: true }, style: "primary",
        action_id: "nami_start_review", value: JSON.stringify({ assignmentId, role: "self" }) },
      { type: "button", text: { type: "plain_text", text: "Remind me later", emoji: true },
        action_id: "nami_remind_later", value: JSON.stringify({ assignmentId, role: "self" }) },
    ]},
  ];
}

function buildManagerReviewOpening(
  managerName: string, employeeName: string, cycleName: string, deadline: string,
  assignmentId: string, context: { selfAvg?: string; prevRating?: string; goalsCount?: number }
): any[] {
  const contextLines: string[] = [];
  if (context.selfAvg) contextLines.push(`Self-Assessment: ⭐ *${context.selfAvg}*`);
  if (context.prevRating) contextLines.push(`Previous Rating: ⭐ *${context.prevRating}/5*`);
  if (context.goalsCount !== undefined) contextLines.push(`Active Goals: *${context.goalsCount}*`);

  const blocks: any[] = [
    { type: "section", text: { type: "mrkdwn", text: `Hi ${managerName}! 👋 Time to review *${employeeName}* for *${cycleName}*.\nDeadline: *${deadline}*` } },
  ];
  if (contextLines.length > 0) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: `Here's some context:\n${contextLines.join("\n")}` } });
  }
  blocks.push({ type: "actions", elements: [
    { type: "button", text: { type: "plain_text", text: "Start review 📋", emoji: true }, style: "primary",
      action_id: "nami_start_review", value: JSON.stringify({ assignmentId, role: "manager" }) },
    { type: "button", text: { type: "plain_text", text: "Remind me later", emoji: true },
      action_id: "nami_remind_later", value: JSON.stringify({ assignmentId, role: "manager" }) },
  ]});
  return blocks;
}

function buildUpwardFeedbackOpening(
  reviewerName: string, managerName: string, cycleName: string, deadline: string, assignmentId: string
): any[] {
  return [
    { type: "section", text: { type: "mrkdwn", text: `Hi ${reviewerName}! 👋 You've been asked to share some upward feedback about your manager, *${managerName}*, for *${cycleName}*.\n\nThis is confidential and helps ${managerName} grow. 🙏\nDeadline: *${deadline}*` } },
    { type: "actions", elements: [
      { type: "button", text: { type: "plain_text", text: "I'm ready", emoji: true }, style: "primary",
        action_id: "nami_start_review", value: JSON.stringify({ assignmentId, role: "upward" }) },
      { type: "button", text: { type: "plain_text", text: "Remind me later", emoji: true },
        action_id: "nami_remind_later", value: JSON.stringify({ assignmentId, role: "upward" }) },
    ]},
  ];
}

function buildSurveyOpening(
  userName: string, surveyName: string, questionCount: number, participantId: string, surveyId: string
): any[] {
  const estMinutes = Math.max(1, Math.ceil(questionCount * 0.5));
  return [
    { type: "section", text: { type: "mrkdwn", text: `Hi ${userName}! 👋 There's a new survey for you: *${surveyName}*.\nIt has *${questionCount} questions* and takes ~${estMinutes} minutes.` } },
    { type: "actions", elements: [
      { type: "button", text: { type: "plain_text", text: "Start survey", emoji: true }, style: "primary",
        action_id: "nami_start_survey", value: JSON.stringify({ participantId, surveyId }) },
      { type: "button", text: { type: "plain_text", text: "Remind me later", emoji: true },
        action_id: "nami_remind_later", value: JSON.stringify({ participantId, surveyId, type: "survey" }) },
    ]},
  ];
}

function buildCompetencyPrompt(
  competencyName: string, competencyDesc: string | null, currentIndex: number,
  totalCount: number, convId: string, assignmentId: string
): any[] {
  const progress = `(${currentIndex + 1}/${totalCount})`;
  const descText = competencyDesc ? `\n_${competencyDesc}_` : "";
  return [
    { type: "section", text: { type: "mrkdwn", text: `*${progress} ${competencyName}* 💬${descText}\n\nHow would you rate this?` } },
    { type: "actions", elements: [1, 2, 3, 4, 5].map(n => ({
      type: "button",
      text: { type: "plain_text", text: `${n}`, emoji: true },
      action_id: `nami_rate_${n}`,
      value: JSON.stringify({ convId, assignmentId, rating: n }),
      ...(n === 3 ? { style: "primary" } : {}),
    }))},
    { type: "context", elements: [{ type: "mrkdwn",
      text: `1 = ${ratingLabels[0]} · 3 = ${ratingLabels[2]} · 5 = ${ratingLabels[4]}` }] },
  ];
}

function buildCommentPrompt(competencyName: string, convId: string): any[] {
  return [
    { type: "section", text: { type: "mrkdwn", text: `Any comments on *${competencyName}*? ✍️\n_Type your thoughts below, or tap Skip._` } },
    { type: "actions", elements: [
      { type: "button", text: { type: "plain_text", text: "Skip", emoji: true },
        action_id: "nami_skip_comment", value: JSON.stringify({ convId }) },
    ]},
  ];
}

function buildTextQuestionPrompt(prompt: string, questionIndex: number, totalQuestions: number, convId: string): any[] {
  return [
    { type: "section", text: { type: "mrkdwn", text: `*Question ${questionIndex + 1}/${totalQuestions}:* ${prompt}\n\n_Type your answer below._` } },
  ];
}

function buildReviewSummary(
  employeeName: string, compNames: string[], ratings: Record<string, { rating: number; comment?: string }>,
  textQuestions: string[], textResponses: Record<string, string>, convId: string
): any[] {
  const lines = compNames.map((name, i) => {
    const compId = Object.keys(ratings)[i]; // maintained by index order
    const r = ratings[compId];
    if (r?.rating) {
      const commentSnippet = r.comment ? ` — _${r.comment.slice(0, 50)}${r.comment.length > 50 ? "..." : ""}_` : "";
      return `• ${name}: *${r.rating}/5*${commentSnippet}`;
    }
    return `• ${name}: _skipped_`;
  }).join("\n");

  const textLines = textQuestions.map((prompt, i) => {
    const qId = Object.keys(textResponses)[i];
    const answer = textResponses[qId];
    return answer ? `• _${prompt.slice(0, 40)}..._ → ${answer.slice(0, 60)}${answer.length > 60 ? "..." : ""}` : null;
  }).filter(Boolean).join("\n");

  const blocks: any[] = [
    { type: "section", text: { type: "mrkdwn", text: `Almost done! Here's your summary for *${employeeName}*:` } },
    { type: "divider" },
    { type: "section", text: { type: "mrkdwn", text: lines } },
  ];
  if (textLines) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: textLines } });
  }
  blocks.push(
    { type: "divider" },
    { type: "actions", elements: [
      { type: "button", text: { type: "plain_text", text: "Submit ✅", emoji: true }, style: "primary",
        action_id: "nami_submit_review", value: JSON.stringify({ convId }) },
      { type: "button", text: { type: "plain_text", text: "Edit a section ✏️", emoji: true },
        action_id: "nami_edit_review", value: JSON.stringify({ convId }) },
      { type: "button", text: { type: "plain_text", text: "Cancel", emoji: true },
        action_id: "nami_cancel_review", value: JSON.stringify({ convId }) },
    ]},
  );
  return blocks;
}

function buildSurveyQuestionPrompt(
  question: { id: string; label: string; type: string; options?: string[]; required?: boolean },
  questionIndex: number, totalQuestions: number, convId: string, surveyId: string
): any[] {
  const progress = `(${questionIndex + 1}/${totalQuestions})`;
  const blocks: any[] = [
    { type: "section", text: { type: "mrkdwn", text: `*${progress}* ${question.label}` } },
  ];

  if (question.type === "rating_7") {
    blocks.push({ type: "actions", elements: [1, 2, 3, 4, 5, 6, 7].map(n => ({
      type: "button", text: { type: "plain_text", text: `${n}` },
      action_id: `nami_survey_rate_${n}`,
      value: JSON.stringify({ convId, surveyId, questionId: question.id, answer: String(n) }),
    }))});
  } else if (question.type === "single_select" && question.options) {
    blocks.push({ type: "actions", elements: question.options.slice(0, 5).map((opt, i) => ({
      type: "button", text: { type: "plain_text", text: opt.slice(0, 75) },
      action_id: `nami_survey_select_${i}`,
      value: JSON.stringify({ convId, surveyId, questionId: question.id, answer: opt }),
    }))});
  } else if (question.type === "text") {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: "_Type your answer below._" } });
    if (!question.required) {
      blocks.push({ type: "actions", elements: [
        { type: "button", text: { type: "plain_text", text: "Skip" },
          action_id: "nami_survey_skip", value: JSON.stringify({ convId, surveyId, questionId: question.id }) },
      ]});
    }
  }
  return blocks;
}

function buildReminderMessage(
  userName: string, itemName: string, reminderNumber: number, daysLeft: number | null,
  actionValue: string, actionId: string
): any[] {
  const urgency = daysLeft !== null && daysLeft <= 3 ? "⚠️" : "🔔";
  const daysText = daysLeft !== null ? ` You have *${daysLeft} days left*.` : "";
  return [
    { type: "section", text: { type: "mrkdwn", text: `${urgency} Hey ${userName}! Just a friendly reminder — you still need to complete *${itemName}*.${daysText}` } },
    { type: "actions", elements: [
      { type: "button", text: { type: "plain_text", text: "Let's do it now", emoji: true }, style: "primary",
        action_id: actionId, value: actionValue },
      { type: "button", text: { type: "plain_text", text: "Remind me later", emoji: true },
        action_id: "nami_remind_later", value: actionValue },
    ]},
  ];
}

function buildManagerEscalation(managerName: string, employeeName: string, itemName: string): any[] {
  return [
    { type: "section", text: { type: "mrkdwn", text: `Hi ${managerName} — your direct report *${employeeName}* hasn't completed *${itemName}* yet despite multiple reminders. You may want to follow up with them directly.` } },
  ];
}

function buildFinalWarning(
  userName: string, itemName: string, actionValue: string, actionId: string
): any[] {
  return [
    { type: "section", text: { type: "mrkdwn", text: `⏰ *Final reminder* — ${userName}, *${itemName}* is due tomorrow! Please complete it today.` } },
    { type: "actions", elements: [
      { type: "button", text: { type: "plain_text", text: "Complete now", emoji: true }, style: "primary",
        action_id: actionId, value: actionValue },
    ]},
  ];
}
```

**Step 2: Commit**

```bash
git add supabase/functions/nami-bot/index.ts
git commit -m "feat(nami): add message builders and Slack helpers for Nami bot"
```

---

### Task 3: Nami Bot — Cycle Launch Handler

**Files:**
- Modify: `supabase/functions/nami-bot/index.ts`

**Step 1: Add the cycle launch handler**

Add after the message builder functions. This fetches all assignments for a cycle and sends the appropriate Nami DM to each participant — employees get self-review opening, managers get manager review opening (with context), upward reviewers get upward feedback opening.

Follow the same patterns as `cycle-notifications/index.ts` lines 59-157: fetch cycle + bot token, iterate assignments, use `logNotification` dedup, `rollbackNotification` on failure.

Key differences from existing `cycle-notifications`:
- Sends Block Kit messages (not plain text) using `sendSlackBlocks`
- Sends self-review opening to employees via `buildSelfReviewOpening`
- Sends manager review with context via `buildManagerReviewOpening` (fetches self-assessment avg, previous rating, goals count — same as WS3 pattern in `slack-interactivity/index.ts` lines 277-341)
- Sends upward feedback opening via `buildUpwardFeedbackOpening`
- Uses `nami_initial` event type (not `review_assigned`)

```typescript
async function getManagerContext(employeeId: string, cycleId: string) {
  const context: { selfAvg?: string; prevRating?: string; goalsCount?: number } = {};

  // Self-assessment avg
  const { data: assignments } = await supabase.from("review_assignments")
    .select("id").eq("cycle_id", cycleId).eq("employee_id", employeeId);
  if (assignments?.length) {
    const ids = assignments.map(a => a.id);
    const { data: selfResp } = await supabase.from("review_responses")
      .select("rating").in("assignment_id", ids).eq("reviewer_role", "self").not("rating", "is", null);
    if (selfResp?.length) {
      const avg = selfResp.reduce((s, r) => s + r.rating, 0) / selfResp.length;
      context.selfAvg = (Math.round(avg * 10) / 10).toString();
    }
  }

  // Previous rating
  const { data: prev } = await supabase.from("review_assignments")
    .select("overall_rating").eq("employee_id", employeeId).eq("status", "completed")
    .neq("cycle_id", cycleId).order("updated_at", { ascending: false }).limit(1);
  if (prev?.[0]?.overall_rating) {
    context.prevRating = (Math.round(prev[0].overall_rating * 10) / 10).toString();
  }

  // Goals count
  const { data: goals, count } = await supabase.from("goals")
    .select("id", { count: "exact" }).eq("employee_id", employeeId).eq("status", "active");
  context.goalsCount = count || 0;

  return context;
}

async function handleCycleLaunch(cycleId: string) {
  const { data: cycle } = await supabase.from("performance_cycles")
    .select("id, name, review_deadline, workspace_id, workspaces(bot_token)")
    .eq("id", cycleId).single();
  if (!cycle) return { sent: 0, skipped: 0 };

  const botToken = (cycle as any).workspaces?.bot_token;
  if (!botToken) return { sent: 0, skipped: 0, error: "No bot token" };

  const { data: assignments } = await supabase.from("review_assignments")
    .select(`id, employee_id, manager_id, reviewer_id, assignment_type,
      employee:users!review_assignments_employee_id_fkey(id, slack_user_id, slack_name),
      manager:users!review_assignments_manager_id_fkey(id, slack_user_id, slack_name),
      reviewer:users!review_assignments_reviewer_id_fkey(id, slack_user_id, slack_name)`)
    .eq("cycle_id", cycleId);
  if (!assignments) return { sent: 0, skipped: 0 };

  const deadline = cycle.review_deadline
    ? new Date(cycle.review_deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "no deadline set";

  let sent = 0, skipped = 0;

  for (const a of assignments) {
    const emp = (a as any).employee;
    const mgr = (a as any).manager;

    // Self-review → employee
    if (emp?.slack_user_id && a.assignment_type === "standard") {
      const canSend = await logNotification(cycle.workspace_id, emp.id, "nami_initial", `self_${a.id}`);
      if (canSend) {
        const blocks = buildSelfReviewOpening(emp.slack_name || "there", cycle.name, deadline, a.id);
        const { ok } = await sendSlackBlocks(botToken, emp.slack_user_id, `Review time: ${cycle.name}`, blocks);
        if (ok) { sent++; } else {
          await rollbackNotification(cycle.workspace_id, emp.id, "nami_initial", `self_${a.id}`);
          skipped++;
        }
      } else { skipped++; }
    }

    // Manager review → manager
    if (mgr?.slack_user_id && a.assignment_type === "standard") {
      const canSend = await logNotification(cycle.workspace_id, mgr.id, "nami_initial", `mgr_${a.id}`);
      if (canSend) {
        const context = await getManagerContext(a.employee_id, cycleId);
        const blocks = buildManagerReviewOpening(
          mgr.slack_name || "there", emp?.slack_name || "a team member",
          cycle.name, deadline, a.id, context
        );
        const { ok } = await sendSlackBlocks(botToken, mgr.slack_user_id, `Review ${emp?.slack_name}: ${cycle.name}`, blocks);
        if (ok) { sent++; } else {
          await rollbackNotification(cycle.workspace_id, mgr.id, "nami_initial", `mgr_${a.id}`);
          skipped++;
        }
      } else { skipped++; }
    }

    // Upward feedback → reviewer
    if (a.assignment_type === "upward") {
      const reviewer = (a as any).reviewer;
      if (reviewer?.slack_user_id) {
        const canSend = await logNotification(cycle.workspace_id, reviewer.id, "nami_initial", `upward_${a.id}`);
        if (canSend) {
          const blocks = buildUpwardFeedbackOpening(
            reviewer.slack_name || "there", emp?.slack_name || "your manager",
            cycle.name, deadline, a.id
          );
          const { ok } = await sendSlackBlocks(botToken, reviewer.slack_user_id, `Upward feedback: ${cycle.name}`, blocks);
          if (ok) { sent++; } else {
            await rollbackNotification(cycle.workspace_id, reviewer.id, "nami_initial", `upward_${a.id}`);
            skipped++;
          }
        } else { skipped++; }
      }
    }
  }

  // Mark cycle as nami_confirmed sent
  await supabase.from("performance_cycles").update({ nami_confirmed: true }).eq("id", cycleId);

  return { sent, skipped };
}
```

**Step 2: Add the survey launch handler**

```typescript
async function handleSurveyLaunch(surveyId: string) {
  const { data: survey } = await supabase.from("surveys")
    .select("id, name, config, workspace_id, workspaces(bot_token)")
    .eq("id", surveyId).single();
  if (!survey) return { sent: 0, skipped: 0 };

  const botToken = (survey as any).workspaces?.bot_token;
  if (!botToken) return { sent: 0, skipped: 0 };

  const questions = (survey as any).config?.questions || [];
  const { data: participants } = await supabase.from("survey_participants")
    .select("id, subject_user_id, status, user:users!survey_participants_subject_user_id_fkey(id, slack_user_id, slack_name)")
    .eq("survey_id", surveyId).eq("status", "pending");
  if (!participants) return { sent: 0, skipped: 0 };

  let sent = 0, skipped = 0;
  for (const p of participants) {
    const user = (p as any).user;
    if (!user?.slack_user_id) { skipped++; continue; }

    const canSend = await logNotification(survey.workspace_id, user.id, "nami_initial", `survey_${p.id}`);
    if (canSend) {
      const blocks = buildSurveyOpening(user.slack_name || "there", survey.name, questions.length, p.id, surveyId);
      const { ok } = await sendSlackBlocks(botToken, user.slack_user_id, `New survey: ${survey.name}`, blocks);
      if (ok) { sent++; } else {
        await rollbackNotification(survey.workspace_id, user.id, "nami_initial", `survey_${p.id}`);
        skipped++;
      }
    } else { skipped++; }
  }

  await supabase.from("surveys").update({ nami_confirmed: true }).eq("id", surveyId);
  return { sent, skipped };
}
```

**Step 3: Add the HTTP handler (Deno.serve)**

Same auth pattern as `cycle-notifications`: CRON_SECRET bearer token.

```typescript
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret) return new Response("CRON_SECRET not set", { status: 500 });
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader !== `Bearer ${cronSecret}`) return new Response("Unauthorized", { status: 401 });

  try {
    const body = await req.json();
    const { action, cycle_id, survey_id } = body;

    let result;
    if (action === "launch_cycle" && cycle_id) {
      result = await handleCycleLaunch(cycle_id);
    } else if (action === "launch_survey" && survey_id) {
      result = await handleSurveyLaunch(survey_id);
    } else if (action === "run_reminders") {
      result = await handleReminders();
    } else {
      return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400 });
    }

    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("nami-bot error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
```

**Step 4: Commit**

```bash
git add supabase/functions/nami-bot/index.ts
git commit -m "feat(nami): add cycle and survey launch handlers"
```

---

### Task 4: Nami Bot — Reminder Ladder Handler

**Files:**
- Modify: `supabase/functions/nami-bot/index.ts`

**Step 1: Add the reminder ladder logic**

Add `handleReminders()` function before `Deno.serve()`. This runs daily via cron. For each incomplete assignment in active cycles, it checks the notification_log to determine what reminder level the person is at, then sends the next appropriate message.

Logic:
1. Find all active cycles
2. For each cycle, find incomplete assignments
3. For each assignment, count existing `nami_reminder_*` entries in notification_log
4. Based on count and timing:
   - 0 reminders and 3+ days since initial → send reminder 1
   - 1 reminder and 3+ days since last → send reminder 2
   - 2 reminders and 3+ days since last → send reminder 3
   - 3 reminders → escalate to manager
   - 1 day before deadline → final warning to both

```typescript
async function handleReminders() {
  const today = new Date();
  let totalSent = 0, totalSkipped = 0;

  // ── Review cycle reminders ──────────────────────────────────
  const { data: activeCycles } = await supabase.from("performance_cycles")
    .select("id, name, review_deadline, workspace_id, nami_confirmed, workspaces(bot_token)")
    .eq("status", "active").eq("nami_confirmed", true);

  for (const cycle of activeCycles || []) {
    const botToken = (cycle as any).workspaces?.bot_token;
    if (!botToken) continue;

    const deadline = cycle.review_deadline ? new Date(cycle.review_deadline) : null;
    const daysUntilDeadline = deadline ? Math.ceil((deadline.getTime() - today.getTime()) / (86400000)) : null;

    const { data: incomplete } = await supabase.from("review_assignments")
      .select(`id, employee_id, manager_id, reviewer_id, assignment_type, status,
        employee:users!review_assignments_employee_id_fkey(id, slack_user_id, slack_name),
        manager:users!review_assignments_manager_id_fkey(id, slack_user_id, slack_name),
        reviewer:users!review_assignments_reviewer_id_fkey(id, slack_user_id, slack_name)`)
      .eq("cycle_id", cycle.id).neq("status", "completed");
    if (!incomplete?.length) continue;

    for (const a of incomplete) {
      // Determine the target user (who needs to act)
      let targetUser: any, role: string, actionId: string;
      if (a.assignment_type === "upward") {
        targetUser = (a as any).reviewer;
        role = "upward";
        actionId = "nami_start_review";
      } else if (a.status === "pending") {
        // Self-review not done yet → employee
        targetUser = (a as any).employee;
        role = "self";
        actionId = "nami_start_review";
      } else {
        // in_progress means self done, manager pending
        targetUser = (a as any).manager;
        role = "manager";
        actionId = "nami_start_review";
      }
      if (!targetUser?.slack_user_id) continue;

      // Count existing reminders
      const { data: existingReminders } = await supabase.from("notification_log")
        .select("event_type, sent_at")
        .eq("workspace_id", cycle.workspace_id)
        .eq("user_id", targetUser.id)
        .like("event_type", `nami_reminder_%`)
        .like("reference_id", `%${a.id}%`)
        .order("sent_at", { ascending: false });

      const reminderCount = existingReminders?.length || 0;
      const lastReminderDate = existingReminders?.[0]?.sent_at ? new Date(existingReminders[0].sent_at) : null;
      const daysSinceLast = lastReminderDate ? Math.floor((today.getTime() - lastReminderDate.getTime()) / 86400000) : 999;

      // Also check initial send date
      const { data: initialNotif } = await supabase.from("notification_log")
        .select("sent_at").eq("workspace_id", cycle.workspace_id)
        .eq("user_id", targetUser.id).eq("event_type", "nami_initial")
        .like("reference_id", `%${a.id}%`).limit(1);
      const initialDate = initialNotif?.[0]?.sent_at ? new Date(initialNotif[0].sent_at) : null;
      const daysSinceInitial = initialDate ? Math.floor((today.getTime() - initialDate.getTime()) / 86400000) : 0;

      const emp = (a as any).employee;
      const mgr = (a as any).manager;
      const actionValue = JSON.stringify({ assignmentId: a.id, role });

      // ── Final warning: 1 day before deadline ──
      if (daysUntilDeadline !== null && daysUntilDeadline <= 1) {
        const eventType = "nami_final_warning";
        const refId = `final_${a.id}`;

        // Warn the person who needs to act
        const canSend = await logNotification(cycle.workspace_id, targetUser.id, eventType, refId);
        if (canSend) {
          const blocks = buildFinalWarning(targetUser.slack_name || "there", cycle.name, actionValue, actionId);
          const { ok } = await sendSlackBlocks(botToken, targetUser.slack_user_id, `Final reminder: ${cycle.name}`, blocks);
          if (ok) { totalSent++; } else {
            await rollbackNotification(cycle.workspace_id, targetUser.id, eventType, refId);
          }
        }

        // Also warn the manager (if target is not the manager)
        if (mgr?.slack_user_id && targetUser.id !== mgr.id) {
          const mgrRefId = `final_mgr_${a.id}`;
          const canSendMgr = await logNotification(cycle.workspace_id, mgr.id, eventType, mgrRefId);
          if (canSendMgr) {
            const mgrBlocks = buildManagerEscalation(mgr.slack_name || "there", emp?.slack_name || "your report", cycle.name);
            const { ok } = await sendSlackBlocks(botToken, mgr.slack_user_id, `Final warning: ${emp?.slack_name} — ${cycle.name}`, mgrBlocks);
            if (ok) { totalSent++; } else {
              await rollbackNotification(cycle.workspace_id, mgr.id, eventType, mgrRefId);
            }
          }
        }
        continue; // Don't send regular reminder if final warning sent
      }

      // ── Regular reminders: every 3 days, max 3 ──
      if (reminderCount < 3 && (daysSinceInitial >= 3 && daysSinceLast >= 3)) {
        const nextReminder = reminderCount + 1;
        const eventType = `nami_reminder_${nextReminder}`;
        const refId = `${role}_${a.id}`;
        const canSend = await logNotification(cycle.workspace_id, targetUser.id, eventType, refId, nextReminder);
        if (canSend) {
          const blocks = buildReminderMessage(
            targetUser.slack_name || "there", cycle.name, nextReminder,
            daysUntilDeadline, actionValue, actionId
          );
          const { ok } = await sendSlackBlocks(botToken, targetUser.slack_user_id, `Reminder: ${cycle.name}`, blocks);
          if (ok) { totalSent++; } else {
            await rollbackNotification(cycle.workspace_id, targetUser.id, eventType, refId);
            totalSkipped++;
          }
        }
      }

      // ── Escalation: after 3 reminders, notify manager ──
      if (reminderCount >= 3 && mgr?.slack_user_id && targetUser.id !== mgr.id) {
        const eventType = "nami_escalation_manager";
        const refId = `esc_${a.id}`;
        const canSend = await logNotification(cycle.workspace_id, mgr.id, eventType, refId);
        if (canSend) {
          const blocks = buildManagerEscalation(mgr.slack_name || "there", targetUser.slack_name || "your report", cycle.name);
          const { ok } = await sendSlackBlocks(botToken, mgr.slack_user_id, `Escalation: ${targetUser.slack_name} — ${cycle.name}`, blocks);
          if (ok) { totalSent++; } else {
            await rollbackNotification(cycle.workspace_id, mgr.id, eventType, refId);
          }
        }
      }
    }
  }

  // ── Survey reminders (same ladder, simpler) ──────────────────
  const { data: activeSurveys } = await supabase.from("surveys")
    .select("id, name, workspace_id, nami_confirmed, config, workspaces(bot_token)")
    .in("status", ["active", "open"]).eq("nami_confirmed", true);

  for (const survey of activeSurveys || []) {
    const botToken = (survey as any).workspaces?.bot_token;
    if (!botToken) continue;

    const { data: pending } = await supabase.from("survey_participants")
      .select("id, subject_user_id, user:users!survey_participants_subject_user_id_fkey(id, slack_user_id, slack_name, manager_id)")
      .eq("survey_id", survey.id).eq("status", "pending");
    if (!pending?.length) continue;

    for (const p of pending) {
      const user = (p as any).user;
      if (!user?.slack_user_id) continue;

      const { data: existingReminders } = await supabase.from("notification_log")
        .select("event_type, sent_at")
        .eq("workspace_id", survey.workspace_id).eq("user_id", user.id)
        .like("event_type", `nami_reminder_%`).like("reference_id", `%${p.id}%`)
        .order("sent_at", { ascending: false });

      const reminderCount = existingReminders?.length || 0;
      const lastDate = existingReminders?.[0]?.sent_at ? new Date(existingReminders[0].sent_at) : null;
      const daysSinceLast = lastDate ? Math.floor((today.getTime() - lastDate.getTime()) / 86400000) : 999;

      const { data: initialNotif } = await supabase.from("notification_log")
        .select("sent_at").eq("workspace_id", survey.workspace_id)
        .eq("user_id", user.id).eq("event_type", "nami_initial")
        .like("reference_id", `%${p.id}%`).limit(1);
      const daysSinceInitial = initialNotif?.[0]?.sent_at
        ? Math.floor((today.getTime() - new Date(initialNotif[0].sent_at).getTime()) / 86400000) : 0;

      const actionValue = JSON.stringify({ participantId: p.id, surveyId: survey.id, type: "survey" });

      if (reminderCount < 3 && daysSinceInitial >= 3 && daysSinceLast >= 3) {
        const next = reminderCount + 1;
        const canSend = await logNotification(survey.workspace_id, user.id, `nami_reminder_${next}`, `survey_${p.id}`, next);
        if (canSend) {
          const blocks = buildReminderMessage(user.slack_name || "there", survey.name, next, null, actionValue, "nami_start_survey");
          const { ok } = await sendSlackBlocks(botToken, user.slack_user_id, `Reminder: ${survey.name}`, blocks);
          if (ok) { totalSent++; } else {
            await rollbackNotification(survey.workspace_id, user.id, `nami_reminder_${next}`, `survey_${p.id}`);
          }
        }
      }

      // Escalate after 3 reminders
      if (reminderCount >= 3 && user.manager_id) {
        const { data: mgr } = await supabase.from("users")
          .select("id, slack_user_id, slack_name").eq("id", user.manager_id).single();
        if (mgr?.slack_user_id) {
          const canSend = await logNotification(survey.workspace_id, mgr.id, "nami_escalation_manager", `esc_survey_${p.id}`);
          if (canSend) {
            const blocks = buildManagerEscalation(mgr.slack_name || "there", user.slack_name || "your report", survey.name);
            const { ok } = await sendSlackBlocks(botToken, mgr.slack_user_id, `Escalation: ${survey.name}`, blocks);
            if (ok) { totalSent++; } else {
              await rollbackNotification(survey.workspace_id, mgr.id, "nami_escalation_manager", `esc_survey_${p.id}`);
            }
          }
        }
      }
    }
  }

  return { sent: totalSent, skipped: totalSkipped };
}
```

**Step 2: Commit**

```bash
git add supabase/functions/nami-bot/index.ts
git commit -m "feat(nami): add reminder ladder with 3-strike escalation"
```

---

### Task 5: Nami Bot — Cron Job for Daily Reminders

**Files:**
- Create: `supabase/migrations/20260323_nami_reminder_cron.sql`

**Step 1: Apply migration to create cron job**

```sql
-- Schedule Nami reminder check daily at 09:00 UTC (same as existing deadline reminders)
SELECT cron.schedule(
  'nami-daily-reminders',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/nami-bot',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')
    ),
    body := '{"action": "run_reminders"}'::jsonb
  );
  $$
);
```

Apply via MCP `apply_migration` with name `nami_reminder_cron`.

**Step 2: Verify cron job**

Run via MCP `execute_sql`:
```sql
SELECT * FROM cron.job WHERE jobname = 'nami-daily-reminders';
```
Expected: 1 row with schedule `0 9 * * *`.

**Step 3: Commit**

```bash
git add supabase/migrations/20260323_nami_reminder_cron.sql
git commit -m "feat(nami): add daily cron job for Nami reminders"
```

---

### Task 6: Extend slack-interactivity — Nami Button Handlers

**Files:**
- Modify: `supabase/functions/slack-interactivity/index.ts` (add new action_id handlers after existing ones, around line 1310)

**Step 1: Add Nami button action handlers**

Add these handlers inside the `block_actions` section, following the existing pattern (e.g. `start_dm_review` at line 981).

New `action_id` values to handle:
- `nami_start_review` — Creates conversation_state, sends first competency prompt
- `nami_remind_later` — Schedules +24hr reminder (counts toward 3 limit)
- `nami_rate_1` through `nami_rate_5` — Saves rating, sends comment prompt
- `nami_skip_comment` — Advances to next competency or text questions
- `nami_submit_review` — Saves all responses (same logic as existing `dm_review_submit`)
- `nami_edit_review` — Resets to first competency (same logic as `dm_review_edit`)
- `nami_cancel_review` — Expires conversation (same logic as `dm_review_cancel`)
- `nami_start_survey` — Creates conversation_state for survey, sends first question
- `nami_survey_rate_*` / `nami_survey_select_*` — Saves survey answer, advances
- `nami_survey_skip` — Skips optional question, advances

The `nami_start_review` handler follows the same pattern as `start_dm_review` (line 981):
1. Look up assignment + competencies
2. Expire any existing active conversation_states for this user/assignment
3. Create new conversation_state with `flow_type: "review"`
4. Send first competency prompt using `buildCompetencyPrompt` blocks

The rating handlers (`nami_rate_1`..`nami_rate_5`) update `conversation_states.ratings` with the selected value, then send the comment prompt.

The `nami_skip_comment` handler advances `current_index` and either sends next competency or transitions to text questions phase.

The submit handler uses the same save logic as `dm_review_submit` (line 1059): saves to `review_responses`, updates `review_assignments.status`, calls WS4 + WS5.

**Important:** For text input (comments and text questions), the user types directly in the DM. We handle this in the next task via `slack-events`.

**Step 2: Commit**

```bash
git add supabase/functions/slack-interactivity/index.ts
git commit -m "feat(nami): add Nami button action handlers in slack-interactivity"
```

---

### Task 7: Extend slack-events — Handle Free-Text DM Replies

**Files:**
- Modify: `supabase/functions/slack-events/index.ts`

**Step 1: Add message event handler**

Add a new handler for `innerEvent.type === "message"` after the existing `app_home_opened` handler (line 240).

When a user sends a text message in a DM with the bot, check if they have an active `conversation_state`. If so, interpret the text based on the current phase:

- Phase `competencies` + waiting for comment → save as comment for current competency, advance to next
- Phase `text_questions` → save as text response, advance to next question or summary
- Phase `survey` → save as survey answer, advance to next question

```typescript
if (innerEvent?.type === "message" && innerEvent.channel_type === "im" && !innerEvent.bot_id) {
  const slackUserId = innerEvent.user;
  const text = innerEvent.text?.trim();
  if (!text) return new Response("OK", { status: 200 });

  // Find active conversation state for this user
  const { data: conv } = await supabase.from("conversation_states")
    .select("*")
    .eq("slack_user_id", slackUserId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!conv) return new Response("OK", { status: 200 }); // No active conversation

  const botToken = ... // look up from workspace

  if (conv.flow_type === "review") {
    if (conv.phase === "competencies") {
      // User typed a comment for current competency
      const compId = conv.competency_ids[conv.current_index];
      const ratings = { ...conv.ratings };
      if (ratings[compId]) {
        ratings[compId].comment = text;
      }
      // Advance to next competency
      const nextIndex = conv.current_index + 1;
      if (nextIndex < conv.competency_ids.length) {
        await supabase.from("conversation_states").update({
          ratings, current_index: nextIndex
        }).eq("id", conv.id);
        // Send next competency prompt
        await sendSlackBlocks(botToken, slackUserId, "Next competency",
          buildCompetencyPrompt(conv.competency_names[nextIndex], null, nextIndex, conv.competency_ids.length, conv.id, conv.assignment_id));
      } else {
        // Move to text questions
        // ... fetch text questions, update phase, send first text question
      }
    } else if (conv.phase === "text_questions") {
      // Save text response
      const qId = conv.text_question_ids[conv.current_index];
      const textResponses = { ...conv.text_responses, [qId]: text };
      const nextIndex = conv.current_index + 1;
      if (nextIndex < conv.text_question_ids.length) {
        await supabase.from("conversation_states").update({
          text_responses: textResponses, current_index: nextIndex
        }).eq("id", conv.id);
        // Send next text question
        await sendSlackBlocks(botToken, slackUserId, "Next question",
          buildTextQuestionPrompt(conv.text_question_prompts[nextIndex], nextIndex, conv.text_question_ids.length, conv.id));
      } else {
        // Move to summary
        await supabase.from("conversation_states").update({
          text_responses: textResponses, phase: "summary"
        }).eq("id", conv.id);
        // Send summary
        await sendSlackBlocks(botToken, slackUserId, "Review summary",
          buildReviewSummary(conv.employee_name, conv.competency_names, conv.ratings, conv.text_question_prompts, textResponses, conv.id));
      }
    }
  } else if (conv.flow_type === "survey") {
    // Save survey text answer, advance to next question
    // Similar pattern — update survey_answers in conversation_states
  }
}
```

**Note:** The full implementation needs to import the `buildCompetencyPrompt`, `buildTextQuestionPrompt`, `buildReviewSummary`, and `buildSurveyQuestionPrompt` functions. Since Deno Edge Functions are single-file, either duplicate the builders here or extract to a shared module at `supabase/functions/_shared/nami-blocks.ts` (preferred).

**Step 2: Extract shared block builders**

Create `supabase/functions/_shared/nami-blocks.ts` with all the `build*` functions from Task 2. Import in both `nami-bot/index.ts` and `slack-events/index.ts`:

```typescript
import { buildCompetencyPrompt, buildCommentPrompt, ... } from "../_shared/nami-blocks.ts";
```

**Step 3: Commit**

```bash
git add supabase/functions/slack-events/index.ts supabase/functions/_shared/nami-blocks.ts
git commit -m "feat(nami): handle free-text DM replies for Nami conversations"
```

---

### Task 8: Dashboard — Cycle Launch Confirmation with Nami

**Files:**
- Modify: `src/app/dashboard/cycles/new/page.tsx` (around line 286, the `handleCreateAndLaunch` function)

**Step 1: Add confirmation modal state**

Add state for the Nami confirmation:
```typescript
const [showNamiConfirm, setShowNamiConfirm] = useState(false);
const [namiScheduleMode, setNamiScheduleMode] = useState<"now" | "schedule">("now");
const [namiScheduleDate, setNamiScheduleDate] = useState("");
const [pendingCycleId, setPendingCycleId] = useState<string | null>(null);
const [namiSendCounts, setNamiSendCounts] = useState({ employees: 0, managers: 0, upward: 0 });
```

**Step 2: Modify launch flow**

Change `handleCreateAndLaunch` to:
1. Create the cycle and assignments (same as now, lines 290-334)
2. Calculate send counts from the created assignments
3. Set `showNamiConfirm = true` instead of immediately calling `cycle-notifications`
4. Store `pendingCycleId`

Add a new `confirmNamiSend` function:
```typescript
async function confirmNamiSend() {
  if (!pendingCycleId) return;
  const sendAt = namiScheduleMode === "schedule" && namiScheduleDate
    ? new Date(namiScheduleDate).toISOString() : null;

  // Update cycle with Nami scheduling
  await supabase.from("performance_cycles").update({
    nami_send_at: sendAt, nami_confirmed: true
  }).eq("id", pendingCycleId);

  // If send now, invoke nami-bot immediately
  if (!sendAt) {
    await supabase.functions.invoke("nami-bot", {
      body: { action: "launch_cycle", cycle_id: pendingCycleId },
    });
  }
  // If scheduled, the cron job will pick it up

  router.push(`/dashboard/cycles/${pendingCycleId}`);
  router.refresh();
}
```

**Step 3: Add confirmation modal UI**

Add a modal component at the bottom of the JSX:
```tsx
{showNamiConfirm && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 space-y-4">
      <h3 className="text-lg font-semibold">Nami will send messages to:</h3>
      <ul className="space-y-1 text-sm text-zinc-600">
        <li>• {namiSendCounts.employees} employees (self-review)</li>
        <li>• {namiSendCounts.managers} managers (manager review)</li>
        <li>• {namiSendCounts.upward} direct reports (upward feedback)</li>
      </ul>
      <div className="flex gap-3">
        <label className="flex items-center gap-2">
          <input type="radio" checked={namiScheduleMode === "now"}
            onChange={() => setNamiScheduleMode("now")} />
          Send now
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={namiScheduleMode === "schedule"}
            onChange={() => setNamiScheduleMode("schedule")} />
          Schedule
        </label>
      </div>
      {namiScheduleMode === "schedule" && (
        <input type="datetime-local" value={namiScheduleDate}
          onChange={(e) => setNamiScheduleDate(e.target.value)}
          className="w-full border rounded-lg px-3 py-2" />
      )}
      <div className="flex gap-3 pt-2">
        <button onClick={confirmNamiSend}
          className="flex-1 bg-emerald-600 text-white rounded-lg py-2 font-medium hover:bg-emerald-700">
          Confirm
        </button>
        <button onClick={() => setShowNamiConfirm(false)}
          className="flex-1 border rounded-lg py-2 font-medium hover:bg-zinc-50">
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
```

**Step 4: Commit**

```bash
git add src/app/dashboard/cycles/new/page.tsx
git commit -m "feat(nami): add Nami confirmation modal to cycle launch"
```

---

### Task 9: Dashboard — Survey Launch with Nami

**Files:**
- Modify: survey creation page (find the survey creation form, likely in `src/app/dashboard/surveys/new/` or a modal component)

**Step 1: Add same Nami confirmation pattern as Task 8**

Same approach: after creating survey + participants, show confirmation modal with send counts, send now/schedule toggle.

**Step 2: Commit**

```bash
git add src/app/dashboard/surveys/
git commit -m "feat(nami): add Nami confirmation to survey launch"
```

---

### Task 10: Dashboard — Nami Status Tracker on Cycle Detail Page

**Files:**
- Modify: `src/app/dashboard/cycles/[id]/page.tsx`

**Step 1: Fetch Nami notification data**

Add a data fetcher (alongside existing ones at lines 28-163):
```typescript
async function getNamiStatus(cycleId: string, workspaceId: string) {
  const { data } = await supabase.from("notification_log")
    .select("user_id, event_type, reminder_count, sent_at")
    .eq("workspace_id", workspaceId)
    .like("event_type", "nami_%")
    .like("reference_id", `%`) // will filter by assignment IDs
    .order("sent_at", { ascending: false });
  return data || [];
}
```

**Step 2: Add Nami status section to the page UI**

Add after the Participants Table section (around line 543). Show a new card with:
- Per-participant row: name, role, completion status, reminder count (0/3, 1/3, etc.)
- Color coding: green = done, yellow = in progress, orange = reminded, red = escalated
- Filter buttons: All / Pending / Completed / Escalated

```tsx
{/* Nami Status */}
{cycle.nami_confirmed && (
  <div className="bg-white rounded-xl border p-6 space-y-4">
    <h2 className="text-lg font-semibold flex items-center gap-2">
      🤖 Nami Status
    </h2>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-zinc-500 border-b">
            <th className="pb-2">Person</th>
            <th className="pb-2">Type</th>
            <th className="pb-2">Status</th>
            <th className="pb-2">Reminders</th>
          </tr>
        </thead>
        <tbody>
          {assignments.map((a) => {
            const namiData = namiStatus.filter(n => n.reference_id?.includes(a.id));
            const reminderCount = namiData.filter(n => n.event_type.startsWith("nami_reminder")).length;
            const escalated = namiData.some(n => n.event_type === "nami_escalation_manager");
            const statusColor = a.status === "completed" ? "text-emerald-600" :
              escalated ? "text-red-600" : reminderCount > 0 ? "text-amber-600" : "text-zinc-500";
            return (
              <tr key={a.id} className="border-b">
                <td className="py-2">{a.employee?.slack_name}</td>
                <td className="py-2">{a.assignment_type}</td>
                <td className={`py-2 font-medium ${statusColor}`}>{a.status}</td>
                <td className="py-2">{reminderCount}/3 {escalated && "⚠️"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
)}
```

**Step 3: Commit**

```bash
git add src/app/dashboard/cycles/[id]/page.tsx
git commit -m "feat(nami): add Nami status tracker to cycle detail page"
```

---

### Task 11: Deploy Edge Functions

**Step 1: Deploy nami-bot**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app"
npx supabase functions deploy nami-bot --project-ref zhfvxfvmdlpdfgxrwtdn
```

Or use MCP `deploy_edge_function` with project_id `zhfvxfvmdlpdfgxrwtdn`.

**Step 2: Deploy updated slack-interactivity**

```bash
npx supabase functions deploy slack-interactivity --project-ref zhfvxfvmdlpdfgxrwtdn
```

**Step 3: Deploy updated slack-events**

```bash
npx supabase functions deploy slack-events --project-ref zhfvxfvmdlpdfgxrwtdn
```

**Step 4: Set environment variables for nami-bot**

The new function needs the same env vars as existing functions. Verify they're set:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DASHBOARD_URL`, `CRON_SECRET`

**Step 5: Commit any remaining changes**

```bash
git add -A
git commit -m "feat(nami): deploy all Nami bot edge functions"
```

---

### Task 12: Integration Testing

**Step 1: Test cycle launch flow**

1. Create a test cycle from dashboard with 2-3 test users
2. Verify Nami confirmation modal shows correct counts
3. Click "Send now" → verify DMs sent to test Slack users
4. Verify `notification_log` has `nami_initial` entries
5. Verify `conversation_states` created when user clicks "Let's go"

**Step 2: Test conversational flow**

1. Click "Let's go" in the DM → verify first competency prompt appears
2. Click a rating button → verify comment prompt appears
3. Type a comment → verify next competency appears
4. Complete all competencies → verify text questions appear
5. Complete all questions → verify summary appears
6. Click "Submit" → verify `review_responses` saved correctly
7. Check dashboard → verify data displays correctly

**Step 3: Test reminder ladder**

1. Set a test cron run via MCP `execute_sql`:
```sql
SELECT net.http_post(
  url := 'https://zhfvxfvmdlpdfgxrwtdn.supabase.co/functions/v1/nami-bot',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
  body := '{"action": "run_reminders"}'::jsonb
);
```
2. Verify reminders sent to incomplete assignments
3. Verify escalation after 3 reminders

**Step 4: Test survey flow**

1. Create a test survey, launch with Nami
2. Verify DMs sent to participants
3. Complete survey via buttons + text
4. Verify `survey_responses` saved

**Step 5: Commit test results/fixes**

```bash
git add -A
git commit -m "fix(nami): integration test fixes"
```
