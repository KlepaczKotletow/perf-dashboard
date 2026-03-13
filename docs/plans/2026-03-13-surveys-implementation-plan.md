# Surveys Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a unified survey engine (360, Pulse, eNPS) with Slack-native delivery and a dashboard for creation, management, and results visualisation.

**Architecture:** Unified `surveys` table with `type` enum + `config JSONB`. Survey participants stored in `survey_participants`, answers in `survey_responses`. Admin launches from dashboard → `survey-notifications` edge function sends Slack DMs → employees respond in Slack modals → results aggregate on dashboard.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + RLS + Edge Functions), Slack Block Kit, TypeScript, Tailwind, shadcn/ui, date-fns. Supabase project: `zhfvxfvmdlpdfgxrwtdn`.

---

## Patterns to follow

- **Server components** use `createServerSupabaseClient()` from `@/lib/supabase-server`
- **Client components** use `createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)`
- **Page structure** follows `src/app/dashboard/cycles/page.tsx` — full-width row list with header
- **Wizard pattern** follows `src/app/dashboard/cycles/new/page.tsx` — `useState` step, `createBrowserClient`
- **Edge functions** deployed via `mcp__supabase__deploy_edge_function` — NOT local files, `verify_jwt: false` for Slack endpoints
- **DB operations** via `mcp__supabase__apply_migration` (DDL) and `mcp__supabase__execute_sql` (queries)
- **No tests** — this project has no test framework configured; verify by running `npm run build` instead

---

## Task 1: DB Migration — core tables

**Files:**
- No local files — apply via Supabase MCP

**Step 1: Apply migration**

Use `mcp__supabase__apply_migration` with name `create_surveys_tables`:

```sql
-- surveys: the survey definition
CREATE TABLE surveys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type         text NOT NULL CHECK (type IN ('360', 'pulse', 'enps')),
  name         text NOT NULL,
  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  config       jsonb NOT NULL DEFAULT '{}',
  created_by   uuid REFERENCES users(id),
  closes_at    timestamptz,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- survey_participants: who is involved and their status
CREATE TABLE survey_participants (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id        uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES users(id),
  subject_user_id  uuid REFERENCES users(id),
  role             text NOT NULL,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  slack_message_ts text,
  completed_at     timestamptz
);

-- survey_responses: actual answers
CREATE TABLE survey_responses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id        uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  participant_id   uuid NOT NULL REFERENCES survey_participants(id) ON DELETE CASCADE,
  subject_user_id  uuid REFERENCES users(id),
  answers          jsonb NOT NULL DEFAULT '{}',
  submitted_at     timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;

-- surveys: managers+ can read their workspace surveys
CREATE POLICY "workspace_members_read_surveys" ON surveys
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM users
      WHERE id::text = (auth.jwt() -> 'user_metadata' ->> 'app_user_id')
    )
  );

-- surveys: admin/hr can create/update
CREATE POLICY "hr_admin_write_surveys" ON surveys
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM users
      WHERE id::text = (auth.jwt() -> 'user_metadata' ->> 'app_user_id')
      AND role IN ('admin', 'hr')
    )
  );

-- participants: users can see their own participations; admin/hr see all
CREATE POLICY "read_own_participations" ON survey_participants
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM users
      WHERE id::text = (auth.jwt() -> 'user_metadata' ->> 'app_user_id')
    )
    OR
    survey_id IN (
      SELECT s.id FROM surveys s
      JOIN users u ON u.workspace_id = s.workspace_id
      WHERE u.id::text = (auth.jwt() -> 'user_metadata' ->> 'app_user_id')
      AND u.role IN ('admin', 'hr')
    )
  );

-- responses: admin/hr see all; subject sees their own 360 results
CREATE POLICY "read_survey_responses" ON survey_responses
  FOR SELECT USING (
    survey_id IN (
      SELECT s.id FROM surveys s
      JOIN users u ON u.workspace_id = s.workspace_id
      WHERE u.id::text = (auth.jwt() -> 'user_metadata' ->> 'app_user_id')
      AND u.role IN ('admin', 'hr')
    )
  );
```

**Step 2: Verify**

Use `mcp__supabase__execute_sql`:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('surveys', 'survey_participants', 'survey_responses')
ORDER BY table_name;
```
Expected: 3 rows.

**Step 3: Commit**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app"
git commit --allow-empty -m "feat: add surveys, survey_participants, survey_responses tables"
```

---

## Task 2: `survey-notifications` edge function

**Files:**
- Deploy via `mcp__supabase__deploy_edge_function` (name: `survey-notifications`, verify_jwt: true)

**Step 1: Deploy the function**

This function is called from the dashboard (authenticated) to send Slack DMs when a survey is launched or a reminder is sent.

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  try {
    const { survey_id, mode } = await req.json(); // mode: 'launch' | 'remind'
    if (!survey_id) return new Response(JSON.stringify({ error: "survey_id required" }), { status: 400 });

    async function dbQuery(table: string, query: string) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
        headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      });
      return res.json();
    }
    async function dbUpdate(table: string, query: string, data: any) {
      return fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(data),
      });
    }

    // Fetch survey
    const surveys = await dbQuery("surveys", `id=eq.${survey_id}&select=id,type,name,workspace_id,config,status`);
    const survey = surveys?.[0];
    if (!survey) return new Response(JSON.stringify({ error: "survey not found" }), { status: 404 });

    // Fetch workspace bot token
    const wsList = await dbQuery("workspaces", `id=eq.${survey.workspace_id}&select=bot_token,refresh_token,token_expires_at`);
    const ws = wsList?.[0];
    if (!ws?.bot_token) return new Response(JSON.stringify({ error: "no bot token" }), { status: 400 });
    const botToken = ws.bot_token;

    // Fetch participants (pending only for reminders, all for launch)
    const statusFilter = mode === "remind" ? "&status=eq.pending" : "";
    const participants = await dbQuery(
      "survey_participants",
      `survey_id=eq.${survey_id}&select=id,user_id,subject_user_id,role,status,slack_message_ts${statusFilter}`
    );
    if (!participants?.length) return new Response(JSON.stringify({ sent: 0 }), { status: 200 });

    // Fetch slack_user_ids for all participants
    const userIds = [...new Set(participants.map((p: any) => p.user_id))];
    const users = await dbQuery("users", `id=in.(${userIds.join(",")})&select=id,slack_user_id,slack_name`);
    const userMap = Object.fromEntries(users.map((u: any) => [u.id, u]));

    // For 360: also fetch subject names
    const subjectIds = [...new Set(participants.filter((p: any) => p.subject_user_id).map((p: any) => p.subject_user_id))];
    const subjectMap: Record<string, any> = {};
    if (subjectIds.length) {
      const subjects = await dbQuery("users", `id=in.(${subjectIds.join(",")})&select=id,slack_name`);
      subjects.forEach((s: any) => { subjectMap[s.id] = s; });
    }

    let sent = 0;

    for (const participant of participants) {
      const user = userMap[participant.user_id];
      if (!user?.slack_user_id) continue;

      let blocks: any[];
      let text: string;

      if (survey.type === "enps") {
        // eNPS: inline 0-10 scale in DM, no modal
        const options = Array.from({ length: 11 }, (_, i) => ({
          text: { type: "plain_text" as const, text: String(i) },
          value: String(i),
        }));
        const followUp = survey.config?.follow_up || "What's the main reason for your score?";
        text = `📊 ${survey.name} — quick question`;
        blocks = [
          {
            type: "section",
            text: { type: "mrkdwn", text: `*${survey.name}*\nHow likely are you to recommend this company as a place to work?` },
          },
          {
            type: "actions",
            block_id: `enps_score_${participant.id}`,
            elements: [{
              type: "static_select",
              action_id: "enps_score",
              placeholder: { type: "plain_text", text: "0 = Not at all, 10 = Extremely likely" },
              options,
            }],
          },
          {
            type: "input",
            block_id: `enps_followup_${participant.id}`,
            optional: true,
            label: { type: "plain_text", text: followUp },
            element: { type: "plain_text_input", action_id: "enps_followup", multiline: true },
          },
          {
            type: "actions",
            elements: [{
              type: "button",
              action_id: "enps_submit",
              text: { type: "plain_text", text: "Submit" },
              style: "primary",
              value: JSON.stringify({ participantId: participant.id, surveyId: survey_id }),
            }],
          },
        ];
      } else if (survey.type === "360") {
        const subjectName = subjectMap[participant.subject_user_id]?.slack_name || "a colleague";
        text = `👋 ${subjectName} has requested your feedback`;
        blocks = [
          {
            type: "section",
            text: { type: "mrkdwn", text: `*${subjectName}* has requested your feedback as part of *${survey.name}*.\nTakes ~3 minutes.` },
          },
          {
            type: "actions",
            elements: [{
              type: "button",
              action_id: "open_survey_modal",
              text: { type: "plain_text", text: "Give Feedback ✏️", emoji: true },
              style: "primary",
              value: JSON.stringify({ participantId: participant.id, surveyId: survey_id }),
            }],
          },
        ];
      } else {
        // pulse
        text = `📊 ${survey.name} — your team wants to hear from you`;
        blocks = [
          {
            type: "section",
            text: { type: "mrkdwn", text: `*${survey.name}*\nYour team wants to hear from you. Takes 2 minutes.` },
          },
          {
            type: "actions",
            elements: [{
              type: "button",
              action_id: "open_survey_modal",
              text: { type: "plain_text", text: "Take Survey 📝", emoji: true },
              style: "primary",
              value: JSON.stringify({ participantId: participant.id, surveyId: survey_id }),
            }],
          },
        ];
      }

      // For reminders: thread reply on original message
      const messagePayload: any = { channel: user.slack_user_id, text, blocks };
      if (mode === "remind" && participant.slack_message_ts) {
        messagePayload.thread_ts = participant.slack_message_ts;
        messagePayload.text = `🔔 Reminder: ${text}`;
      }

      const dmRes = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: { Authorization: `Bearer ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(messagePayload),
      });
      const dmData = await dmRes.json();
      if (dmData.ok && mode !== "remind") {
        // Store ts for future reminders
        await dbUpdate("survey_participants", `id=eq.${participant.id}`, { slack_message_ts: dmData.ts });
      }
      if (dmData.ok) sent++;
    }

    // If launching: update survey status to active
    if (mode === "launch") {
      await dbUpdate("surveys", `id=eq.${survey_id}`, { status: "active", updated_at: new Date().toISOString() });
    }

    return new Response(JSON.stringify({ sent, mode }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[survey-notifications] error:", err?.message || err);
    return new Response(JSON.stringify({ error: err?.message }), { status: 500 });
  }
});
```

**Step 2: Commit**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app"
git commit --allow-empty -m "feat: deploy survey-notifications edge function"
```

---

## Task 3: `slack-commands` — add `/survey` handler

**Files:**
- Read current source: `mcp__supabase__get_edge_function` (slug: `slack-commands`)
- Deploy updated source: `mcp__supabase__deploy_edge_function` (verify_jwt: false)

**Step 1: Add `/survey` handler**

Read the full current source of `slack-commands`. After the `/feedback` handler block (before `return new Response("", { status: 200 })`), insert:

```typescript
    // ==============================================================
    // /survey — show pending surveys for this user
    // ==============================================================
    if (cmd === "/survey") {
      const users = await dbQuery("users", `workspace_id=eq.${ws.id}&slack_user_id=eq.${userId}&select=id`);
      const appUser = users?.[0];
      if (!appUser) {
        return new Response(JSON.stringify({
          response_type: "ephemeral",
          text: "You're not set up yet. Ask your admin to run a team sync.",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      const participants = await dbQuery(
        "survey_participants",
        `user_id=eq.${appUser.id}&status=eq.pending&select=id,survey_id,subject_user_id,surveys(name,type)&surveys.workspace_id=eq.${ws.id}&surveys.status=eq.active`
      );

      if (!participants?.length) {
        return new Response(JSON.stringify({
          response_type: "ephemeral",
          text: ":white_check_mark: No pending surveys — you're all caught up!",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      const options = participants.slice(0, 100).map((p: any) => {
        const surveyName = p.surveys?.name || "Survey";
        const typeLabel = p.surveys?.type === "360" ? "360°" : p.surveys?.type === "pulse" ? "Pulse" : "eNPS";
        return {
          text: { type: "plain_text" as const, text: `${surveyName} (${typeLabel})`.slice(0, 75) },
          value: JSON.stringify({ participantId: p.id, surveyId: p.survey_id }),
        };
      });

      const view = {
        type: "modal",
        callback_id: "survey_select",
        title: { type: "plain_text", text: "Your Surveys" },
        submit: { type: "plain_text", text: "Next" },
        close: { type: "plain_text", text: "Cancel" },
        private_metadata: JSON.stringify({ workspaceId: ws.id }),
        blocks: [
          {
            type: "section",
            text: { type: "mrkdwn", text: `*You have ${participants.length} pending survey${participants.length > 1 ? "s" : ""}:*` },
          },
          { type: "divider" },
          {
            type: "input",
            block_id: "survey_block",
            label: { type: "plain_text", text: "Select a survey to complete" },
            element: {
              type: "static_select",
              action_id: "survey_selection",
              placeholder: { type: "plain_text", text: "Choose a survey" },
              options,
            },
          },
        ],
      };

      const slackRes = await fetch("https://slack.com/api/views.open", {
        method: "POST",
        headers: { Authorization: `Bearer ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ trigger_id: tr, view }),
      });
      const slackResult = await slackRes.json();
      if (!slackResult.ok) console.error("[slack-commands] /survey views.open failed:", slackResult.error);

      return new Response("", { status: 200 });
    }
```

**Step 2: Deploy** with verify_jwt: false, name: `slack-commands`

**Step 3: Commit**

```bash
git commit --allow-empty -m "feat: slack-commands adds /survey handler"
```

---

## Task 4: `slack-interactivity` — survey modal + eNPS submission

**Files:**
- Read current: `mcp__supabase__get_edge_function` (slug: `slack-interactivity`)
- Deploy updated: `mcp__supabase__deploy_edge_function` (verify_jwt: false)

**Step 1: Add `open_survey_modal` block action**

In the `BLOCK ACTIONS` section (after existing `open_cycle_review` handler), add:

```typescript
      // -- Open survey modal (360 / pulse) --
      if (action?.action_id === "open_survey_modal") {
        const { participantId, surveyId } = safeParse(action.value) || {};
        if (!participantId || !surveyId) return json({});

        const surveys = await dbQuery("surveys", `id=eq.${surveyId}&select=id,type,name,config,workspace_id`);
        const survey = surveys?.[0];
        if (!survey || survey.workspace_id !== ws.id) return json({});

        const questions: any[] = survey.config?.questions || [];
        const blocks = questions.map((q: any) => {
          if (q.type === "rating_7") {
            return {
              type: "input",
              block_id: q.id,
              label: { type: "plain_text", text: q.label },
              element: {
                type: "static_select",
                action_id: q.id,
                placeholder: { type: "plain_text", text: "Select rating" },
                options: [1, 2, 3, 4, 5, 6, 7].map(n => ({
                  text: { type: "plain_text", text: String(n) },
                  value: String(n),
                })),
              },
            };
          } else if (q.type === "text") {
            return {
              type: "input",
              block_id: q.id,
              optional: !q.required,
              label: { type: "plain_text", text: q.label },
              element: { type: "plain_text_input", action_id: q.id, multiline: true },
            };
          } else if (q.type === "single_select") {
            return {
              type: "input",
              block_id: q.id,
              label: { type: "plain_text", text: q.label },
              element: {
                type: "static_select",
                action_id: q.id,
                placeholder: { type: "plain_text", text: "Select an option" },
                options: (q.options || []).map((o: string) => ({ text: { type: "plain_text", text: o }, value: o })),
              },
            };
          }
          return null;
        }).filter(Boolean);

        const view = {
          type: "modal",
          callback_id: "survey_modal_submit",
          title: { type: "plain_text", text: survey.name.slice(0, 24) },
          submit: { type: "plain_text", text: "Submit" },
          close: { type: "plain_text", text: "Cancel" },
          private_metadata: JSON.stringify({ participantId, surveyId, workspaceId: ws.id }),
          blocks: blocks.length > 0 ? blocks : [
            { type: "section", text: { type: "mrkdwn", text: "_This survey has no questions configured._" } }
          ],
        };

        await slackApi(botToken, "views.open", { trigger_id: payload.trigger_id, view });
        return json({});
      }

      // -- eNPS inline submit --
      if (action?.action_id === "enps_submit") {
        const { participantId, surveyId } = safeParse(action.value) || {};
        if (!participantId) return json({});

        // Extract score and follow-up from message state
        const state = payload.state?.values || {};
        const scoreBlock = Object.keys(state).find(k => k.startsWith("enps_score_"));
        const followupBlock = Object.keys(state).find(k => k.startsWith("enps_followup_"));
        const score = scoreBlock ? state[scoreBlock]?.enps_score?.selected_option?.value : null;
        const followup = followupBlock ? state[followupBlock]?.enps_followup?.value : null;

        if (score !== null && score !== undefined) {
          await dbInsert("survey_responses", {
            survey_id: surveyId,
            participant_id: participantId,
            answers: { score, follow_up: followup || "" },
          });
          await dbUpdate("survey_participants", `id=eq.${participantId}`, {
            status: "completed",
            completed_at: new Date().toISOString(),
          });

          // Update the DM to show submitted state
          await slackApi(botToken, "chat.update", {
            channel: payload.channel?.id || payload.user.id,
            ts: payload.message?.ts,
            text: "✅ Your eNPS response has been submitted. Thank you!",
            blocks: [
              { type: "section", text: { type: "mrkdwn", text: "✅ *Thank you!* Your response has been recorded." } },
            ],
          });
        }
        return json({});
      }
```

**Step 2: Add `survey_modal_submit` view submission handler**

In the `VIEW SUBMISSIONS` section (after `feedback_modal` handler), add:

```typescript
      // -- SURVEY MODAL SUBMIT (360 / pulse) --
      if (cbId === "survey_modal_submit") {
        const meta = safeParse(payload.view?.private_metadata || "{}");
        const { participantId, surveyId } = meta || {};
        if (!participantId || !surveyId) return json({ response_action: "clear" });

        const vals = payload.view.state.values;
        const answers: Record<string, any> = {};

        for (const blockId of Object.keys(vals)) {
          const blockVals = vals[blockId];
          const actionId = Object.keys(blockVals)[0];
          const actionVal = blockVals[actionId];
          if (actionVal?.value) answers[blockId] = actionVal.value;
          else if (actionVal?.selected_option?.value) answers[blockId] = actionVal.selected_option.value;
          else if (actionVal?.selected_options) answers[blockId] = actionVal.selected_options.map((o: any) => o.value);
        }

        // Fetch participant to get subject_user_id
        const participants = await dbQuery("survey_participants", `id=eq.${participantId}&select=subject_user_id`);
        const participant = participants?.[0];

        await dbInsert("survey_responses", {
          survey_id: surveyId,
          participant_id: participantId,
          subject_user_id: participant?.subject_user_id || null,
          answers,
        });
        await dbUpdate("survey_participants", `id=eq.${participantId}`, {
          status: "completed",
          completed_at: new Date().toISOString(),
        });

        return json({ response_action: "clear" });
      }
```

**Step 3: Add `survey_select` view submission handler** (from `/survey` command)

In the VIEW SUBMISSIONS section, add after `survey_modal_submit`:

```typescript
      // -- SURVEY SELECT (from /survey command) --
      if (cbId === "survey_select") {
        const vals = payload.view.state.values;
        const selected = safeParse(vals?.survey_block?.survey_selection?.selected_option?.value);
        if (!selected?.participantId) return json({ response_action: "clear" });

        const { participantId, surveyId } = selected;
        const surveys = await dbQuery("surveys", `id=eq.${surveyId}&select=id,type,name,config,workspace_id`);
        const survey = surveys?.[0];
        if (!survey) return json({ response_action: "clear" });

        // Build and push survey modal (same logic as open_survey_modal block action)
        const questions: any[] = survey.config?.questions || [];
        const blocks = questions.map((q: any) => {
          if (q.type === "rating_7") {
            return {
              type: "input", block_id: q.id,
              label: { type: "plain_text", text: q.label },
              element: {
                type: "static_select", action_id: q.id,
                placeholder: { type: "plain_text", text: "Select rating" },
                options: [1,2,3,4,5,6,7].map(n => ({ text: { type: "plain_text", text: String(n) }, value: String(n) })),
              },
            };
          } else if (q.type === "text") {
            return {
              type: "input", block_id: q.id, optional: !q.required,
              label: { type: "plain_text", text: q.label },
              element: { type: "plain_text_input", action_id: q.id, multiline: true },
            };
          }
          return null;
        }).filter(Boolean);

        const surveyView = {
          type: "modal",
          callback_id: "survey_modal_submit",
          title: { type: "plain_text", text: survey.name.slice(0, 24) },
          submit: { type: "plain_text", text: "Submit" },
          close: { type: "plain_text", text: "Cancel" },
          private_metadata: JSON.stringify({ participantId, surveyId, workspaceId: ws.id }),
          blocks: blocks.length > 0 ? blocks : [
            { type: "section", text: { type: "mrkdwn", text: "_No questions configured._" } }
          ],
        };

        return json({ response_action: "push", view: surveyView });
      }
```

**Step 4: Deploy** with verify_jwt: false, name: `slack-interactivity`

**Step 5: Commit**

```bash
git commit --allow-empty -m "feat: slack-interactivity handles survey modals and eNPS inline"
```

---

## Task 5: Surveys list page + sidebar nav

**Files:**
- Create: `src/app/dashboard/surveys/page.tsx`
- Modify: `src/app/dashboard/layout.tsx`

**Step 1: Create `src/app/dashboard/surveys/page.tsx`**

```tsx
import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Plus, ChevronRight, Lock, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { isManagerOrAbove } from "@/lib/roles";

async function getSurveys() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("surveys")
    .select(`
      id, type, name, status, closes_at, created_at,
      survey_participants(count),
      completed:survey_participants(count)
    `)
    .order("created_at", { ascending: false });
  return data || [];
}

const TYPE_LABELS: Record<string, string> = { "360": "360°", pulse: "Pulse", enps: "eNPS" };
const TYPE_COLORS: Record<string, string> = {
  "360": "bg-purple-100 text-purple-700 border-purple-200",
  pulse: "bg-blue-100 text-blue-700 border-blue-200",
  enps: "bg-green-100 text-green-700 border-green-200",
};
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600 border-gray-200",
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  closed: "bg-slate-100 text-slate-600 border-slate-200",
};

export default async function SurveysPage() {
  const workspace = await getUserWorkspace();
  if (!isManagerOrAbove(workspace?.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-semibold text-foreground mb-1">Access Restricted</h1>
        <p className="text-sm text-muted-foreground mb-5 max-w-xs">Surveys are available to managers and admins.</p>
        <Button variant="outline" size="sm" asChild><Link href="/dashboard">Back to Dashboard</Link></Button>
      </div>
    );
  }

  const surveys = await getSurveys();
  const isAdminOrHR = workspace?.role === "admin" || workspace?.role === "hr";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Surveys</h1>
          <p className="text-sm text-muted-foreground mt-1">360 reviews, pulse checks, and eNPS — all via Slack</p>
        </div>
        {isAdminOrHR && (
          <Button size="sm" asChild>
            <Link href="/dashboard/surveys/new">
              <Plus className="h-3.5 w-3.5 mr-1.5" />New Survey
            </Link>
          </Button>
        )}
      </div>

      {surveys.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-lg border border-dashed">
          <ClipboardList className="h-10 w-10 text-muted-foreground/40 mb-4" />
          <h3 className="text-base font-medium text-foreground mb-1">No surveys yet</h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-sm">
            Launch a 360, pulse survey, or eNPS — participants respond directly in Slack.
          </p>
          {isAdminOrHR && (
            <Button size="sm" asChild>
              <Link href="/dashboard/surveys/new"><Plus className="h-3.5 w-3.5 mr-1.5" />Launch your first survey</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
          <div className="grid grid-cols-[1fr_80px_80px_120px_120px_40px] gap-4 px-4 py-2.5 bg-muted/40">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Name</span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Responses</span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Closes</span>
            <span />
          </div>
          {surveys.map((survey: any) => {
            const total = survey.survey_participants?.[0]?.count ?? 0;
            const completed = survey.completed?.[0]?.count ?? 0;
            return (
              <Link
                key={survey.id}
                href={`/dashboard/surveys/${survey.id}`}
                className="grid grid-cols-[1fr_80px_80px_120px_120px_40px] gap-4 px-4 py-3.5 hover:bg-muted/30 transition-colors items-center"
              >
                <span className="text-sm font-medium text-foreground truncate">{survey.name}</span>
                <Badge variant="outline" className={`text-xs w-fit ${TYPE_COLORS[survey.type] || ""}`}>
                  {TYPE_LABELS[survey.type] || survey.type}
                </Badge>
                <Badge variant="outline" className={`text-xs w-fit capitalize ${STATUS_COLORS[survey.status] || ""}`}>
                  {survey.status}
                </Badge>
                <span className="text-sm text-muted-foreground">{completed}/{total} responded</span>
                <span className="text-sm text-muted-foreground">
                  {survey.closes_at ? format(new Date(survey.closes_at), "MMM d, yyyy") : "—"}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Add to sidebar in `src/app/dashboard/layout.tsx`**

Add `ClipboardList` to the lucide-react import. Add to the Organization section (before Analytics):

```typescript
{ href: "/dashboard/surveys", label: "Surveys", icon: ClipboardList, requiresManager: true, requiresAdmin: false },
```

**Step 3: Build check**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app"
npm run build 2>&1 | tail -20
```
Expected: `✓ Compiled successfully`, `/dashboard/surveys` in route list.

**Step 4: Commit**

```bash
git add src/app/dashboard/surveys/page.tsx src/app/dashboard/layout.tsx
git commit -m "feat: surveys list page and sidebar nav"
```

---

## Task 6: Survey creation wizard

**Files:**
- Create: `src/app/dashboard/surveys/new/page.tsx`

**Step 1: Create wizard**

This is a 3-step client component. Model it after `src/app/dashboard/cycles/new/page.tsx`.

```tsx
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
  competency_id?: string;
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
    setLoading(true);
    setError(null);
    try {
      // Get current user workspace
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const appUserId = user.user_metadata?.app_user_id;
      const { data: userData } = await supabase.from("users").select("id, workspace_id").eq("id", appUserId).single();
      if (!userData) throw new Error("User not found");

      // Build config
      let config: any = {};
      if (surveyType === "360") {
        config = { questions: questions360, rater_groups: [...raterGroups], min_raters_to_show: 3 };
      } else if (surveyType === "pulse") {
        config = { questions: pulseQuestions };
      } else {
        config = { follow_up: enpsFollowUp };
      }

      // Create survey
      const { data: survey, error: surveyErr } = await supabase
        .from("surveys")
        .insert({ workspace_id: userData.workspace_id, type: surveyType, name, status: "draft", config, created_by: userData.id, closes_at: closesAt || null })
        .select("id")
        .single();
      if (surveyErr) throw surveyErr;

      // Create participants
      const participants: any[] = [];
      if (surveyType === "360") {
        for (const subjectId of selectedSubjects) {
          // Add subject (self)
          if (raterGroups.has("self")) {
            participants.push({ survey_id: survey.id, user_id: subjectId, subject_user_id: subjectId, role: "self" });
          }
          // Add manager, peers, direct reports — for MVP: all workspace members get included as peers
          const { data: wsUsers } = await supabase.from("users").select("id, manager_id").eq("workspace_id", userData.workspace_id);
          for (const wu of (wsUsers || [])) {
            if (wu.id === subjectId) continue;
            const subjectData = wsUsers?.find(u => u.id === subjectId);
            if (raterGroups.has("manager") && wu.id === subjectData?.manager_id) {
              participants.push({ survey_id: survey.id, user_id: wu.id, subject_user_id: subjectId, role: "manager" });
            } else if (raterGroups.has("direct_report") && wu.manager_id === subjectId) {
              participants.push({ survey_id: survey.id, user_id: wu.id, subject_user_id: subjectId, role: "direct_report" });
            } else if (raterGroups.has("peer")) {
              participants.push({ survey_id: survey.id, user_id: wu.id, subject_user_id: subjectId, role: "peer" });
            }
          }
          // Always add the subject as a participant entry for tracking
          participants.push({ survey_id: survey.id, user_id: subjectId, subject_user_id: subjectId, role: "subject" });
        }
      } else {
        // Pulse / eNPS: all workspace members
        const { data: wsUsers } = await supabase.from("users").select("id").eq("workspace_id", userData.workspace_id);
        for (const wu of (wsUsers || [])) {
          participants.push({ survey_id: survey.id, user_id: wu.id, role: "respondent" });
        }
      }

      if (participants.length) {
        const { error: partErr } = await supabase.from("survey_participants").insert(participants);
        if (partErr) throw partErr;
      }

      // Trigger survey-notifications edge function
      const { error: notifErr } = await supabase.functions.invoke("survey-notifications", {
        body: { survey_id: survey.id, mode: "launch" },
      });
      if (notifErr) console.warn("Notification error (non-fatal):", notifErr);

      router.push(`/dashboard/surveys/${survey.id}`);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
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
                  surveyType === t.value ? "border-primary bg-primary/5" : `border-border hover:${t.color}`
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
          {/* Common fields */}
          <div className="space-y-2">
            <Label htmlFor="name">Survey name</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Q1 360 Review" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="closes">Close date (optional)</Label>
            <Input id="closes" type="date" value={closesAt} onChange={e => setClosesAt(e.target.value)} />
          </div>

          {/* 360 specific */}
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
                <div className="flex flex-wrap gap-3">
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
                        <div className="flex gap-2">
                          <select value={q.type} onChange={e => updateQuestion("360", q.id, "type", e.target.value)} className="text-xs border rounded px-2 py-1">
                            <option value="rating_7">Rating (1–7)</option>
                            <option value="text">Open text</option>
                          </select>
                          <Badge variant="outline" className="text-xs">Q{i + 1}</Badge>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeQuestion("360", q.id)}><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={() => addQuestion("360")}><Plus className="h-3.5 w-3.5 mr-1" />Add question</Button>
              </div>
            </>
          )}

          {/* Pulse specific */}
          {surveyType === "pulse" && (
            <div className="space-y-2">
              <Label>Questions <span className="text-xs text-muted-foreground font-normal ml-1">(5–15 recommended)</span></Label>
              <div className="space-y-2">
                {pulseQuestions.map((q, i) => (
                  <div key={q.id} className="flex gap-2 items-start">
                    <div className="flex-1 space-y-1">
                      <Input value={q.label} onChange={e => updateQuestion("pulse", q.id, "label", e.target.value)} placeholder="Question text" />
                      <select value={q.type} onChange={e => updateQuestion("pulse", q.id, "type", e.target.value)} className="text-xs border rounded px-2 py-1">
                        <option value="rating_7">Rating (1–7)</option>
                        <option value="text">Open text</option>
                      </select>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeQuestion("pulse", q.id)}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={() => addQuestion("pulse")}><Plus className="h-3.5 w-3.5 mr-1" />Add question</Button>
            </div>
          )}

          {/* eNPS specific */}
          {surveyType === "enps" && (
            <div className="space-y-2">
              <Label>Follow-up question</Label>
              <p className="text-xs text-muted-foreground">Shown after the 0–10 rating</p>
              <Input value={enpsFollowUp} onChange={e => setEnpsFollowUp(e.target.value)} />
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4 mr-1.5" />Back</Button>
            <Button onClick={() => setStep(3)} disabled={!name.trim()}>
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
              <div className="flex justify-between"><span className="text-muted-foreground">Type</span><Badge variant="outline">{surveyType === "360" ? "360° Review" : surveyType === "pulse" ? "Pulse" : "eNPS"}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-medium">{name}</span></div>
              {surveyType === "360" && <div className="flex justify-between"><span className="text-muted-foreground">Subjects</span><span>{selectedSubjects.size} person{selectedSubjects.size !== 1 ? "s" : ""}</span></div>}
              {surveyType === "360" && <div className="flex justify-between"><span className="text-muted-foreground">Questions</span><span>{questions360.length}</span></div>}
              {surveyType === "pulse" && <div className="flex justify-between"><span className="text-muted-foreground">Questions</span><span>{pulseQuestions.length}</span></div>}
              {closesAt && <div className="flex justify-between"><span className="text-muted-foreground">Closes</span><span>{closesAt}</span></div>}
              <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2 text-blue-700 text-xs">
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
    </div>
  );
}
```

**Step 2: Build check**

```bash
npm run build 2>&1 | tail -20
```
Expected: `✓ Compiled successfully`, `/dashboard/surveys/new` in route list.

**Step 3: Commit**

```bash
git add src/app/dashboard/surveys/new/page.tsx
git commit -m "feat: survey creation wizard (360, pulse, eNPS)"
```

---

## Task 7: Survey detail + results page

**Files:**
- Create: `src/app/dashboard/surveys/[id]/page.tsx`

**Step 1: Create detail page**

```tsx
import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft, Bell, XCircle } from "lucide-react";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { isAdmin } from "@/lib/roles";
import { SurveyActions } from "./survey-actions";
import { SurveyResults } from "./survey-results";

async function getSurvey(id: string) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("surveys")
    .select(`id, type, name, status, config, closes_at, created_at,
      survey_participants(id, user_id, subject_user_id, role, status)`)
    .eq("id", id)
    .single();
  return data;
}

async function getSurveyResponses(surveyId: string) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("survey_responses")
    .select("id, participant_id, subject_user_id, answers, submitted_at")
    .eq("survey_id", surveyId);
  return data || [];
}

const TYPE_COLORS: Record<string, string> = {
  "360": "bg-purple-100 text-purple-700 border-purple-200",
  pulse: "bg-blue-100 text-blue-700 border-blue-200",
  enps: "bg-green-100 text-green-700 border-green-200",
};
const TYPE_LABELS: Record<string, string> = { "360": "360°", pulse: "Pulse", enps: "eNPS" };

export default async function SurveyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [survey, workspace] = await Promise.all([getSurvey(id), getUserWorkspace()]);
  if (!survey) notFound();

  const responses = await getSurveyResponses(id);
  const participants = survey.survey_participants || [];
  const respondents = participants.filter((p: any) => p.role !== "subject");
  const completed = respondents.filter((p: any) => p.status === "completed").length;
  const total = respondents.length;
  const responseRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const canManage = isAdmin(workspace?.role) || workspace?.role === "hr";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/surveys"><ArrowLeft className="h-4 w-4 mr-1" />Surveys</Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{survey.name}</h1>
              <Badge variant="outline" className={`text-xs ${TYPE_COLORS[survey.type]}`}>
                {TYPE_LABELS[survey.type] || survey.type}
              </Badge>
              <Badge variant="outline" className="text-xs capitalize">{survey.status}</Badge>
            </div>
            {survey.closes_at && (
              <p className="text-sm text-muted-foreground mt-0.5">
                Closes {format(new Date(survey.closes_at), "MMMM d, yyyy")}
              </p>
            )}
          </div>
        </div>
        {canManage && survey.status === "active" && (
          <SurveyActions surveyId={id} />
        )}
      </div>

      {/* Response rate */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Response Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 mb-2">
            <span className="text-3xl font-bold text-foreground">{responseRate}%</span>
            <span className="text-sm text-muted-foreground mb-1">{completed} of {total} responded</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${responseRate}%` }} />
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <SurveyResults survey={survey} responses={responses} participants={participants} />
    </div>
  );
}
```

**Step 2: Create `src/app/dashboard/surveys/[id]/survey-actions.tsx`**

```tsx
"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Bell, XCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function SurveyActions({ surveyId }: { surveyId: string }) {
  const [loading, setLoading] = useState<"remind" | "close" | null>(null);
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function sendReminder() {
    setLoading("remind");
    try {
      await supabase.functions.invoke("survey-notifications", { body: { survey_id: surveyId, mode: "remind" } });
      alert("Reminders sent to pending participants!");
    } finally {
      setLoading(null);
    }
  }

  async function closeSurvey() {
    if (!confirm("Close this survey? Participants will no longer be able to respond.")) return;
    setLoading("close");
    try {
      await supabase.from("surveys").update({ status: "closed", updated_at: new Date().toISOString() }).eq("id", surveyId);
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={sendReminder} disabled={!!loading}>
        {loading === "remind" ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Bell className="h-4 w-4 mr-1.5" />}
        Send Reminder
      </Button>
      <Button variant="outline" size="sm" onClick={closeSurvey} disabled={!!loading} className="text-destructive hover:text-destructive">
        {loading === "close" ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <XCircle className="h-4 w-4 mr-1.5" />}
        Close Survey
      </Button>
    </div>
  );
}
```

**Step 3: Create `src/app/dashboard/surveys/[id]/survey-results.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  survey: any;
  responses: any[];
  participants: any[];
}

function eNPSScore(responses: any[]) {
  const scores = responses.map(r => parseInt(r.answers?.score)).filter(s => !isNaN(s));
  if (!scores.length) return null;
  const promoters = scores.filter(s => s >= 9).length;
  const detractors = scores.filter(s => s <= 6).length;
  return Math.round(((promoters - detractors) / scores.length) * 100);
}

export function SurveyResults({ survey, responses, participants }: Props) {
  const [selected360Subject, setSelected360Subject] = useState<string | null>(null);

  // ── eNPS ────────────────────────────────────────────────────────────────
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
                <p className="text-xs text-muted-foreground mb-4">Range: −100 to +100. Global benchmark ~+20</p>
                <div className="flex gap-4 text-sm">
                  <div className="text-center"><div className="text-xl font-semibold text-green-600">{promoters}</div><div className="text-xs text-muted-foreground">Promoters (9–10)</div></div>
                  <div className="text-center"><div className="text-xl font-semibold text-yellow-600">{passives}</div><div className="text-xs text-muted-foreground">Passives (7–8)</div></div>
                  <div className="text-center"><div className="text-xl font-semibold text-red-500">{detractors}</div><div className="text-xs text-muted-foreground">Detractors (0–6)</div></div>
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

  // ── Pulse ────────────────────────────────────────────────────────────────
  if (survey.type === "pulse") {
    const questions: any[] = survey.config?.questions || [];
    return (
      <div className="space-y-4">
        {questions.map(q => {
          const qResponses = responses.map(r => r.answers?.[q.id]).filter(v => v !== undefined && v !== null && v !== "");
          if (q.type === "text") {
            return (
              <Card key={q.id}>
                <CardHeader><CardTitle className="text-base">{q.label}</CardTitle></CardHeader>
                <CardContent>
                  {qResponses.length === 0 ? <p className="text-sm text-muted-foreground">No responses yet.</p> : (
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
          // rating_7: show distribution bar chart
          const counts = [1,2,3,4,5,6,7].map(n => qResponses.filter(v => v === String(n)).length);
          const max = Math.max(...counts, 1);
          return (
            <Card key={q.id}>
              <CardHeader><CardTitle className="text-base">{q.label}</CardTitle></CardHeader>
              <CardContent>
                {qResponses.length === 0 ? <p className="text-sm text-muted-foreground">No responses yet.</p> : (
                  <div className="space-y-1.5">
                    {[1,2,3,4,5,6,7].map(n => (
                      <div key={n} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-3">{n}</span>
                        <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                          <div className="h-full bg-primary/70 rounded transition-all" style={{ width: `${(counts[n-1]/max)*100}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-6 text-right">{counts[n-1]}</span>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground mt-2">{qResponses.length} response{qResponses.length !== 1 ? "s" : ""}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  // ── 360 ─────────────────────────────────────────────────────────────────
  if (survey.type === "360") {
    const subjects = participants.filter((p: any) => p.role === "subject");
    if (!subjects.length) return <p className="text-sm text-muted-foreground">No subjects configured.</p>;

    const activeSubject = selected360Subject || subjects[0]?.subject_user_id;
    const subjectResponses = responses.filter(r => r.subject_user_id === activeSubject);
    const selfResp = subjectResponses.find(r => participants.find((p: any) => p.id === r.participant_id && p.role === "self"));
    const othersResp = subjectResponses.filter(r => r !== selfResp);
    const MIN_RATERS = survey.config?.min_raters_to_show || 3;
    const questions: any[] = survey.config?.questions || [];

    return (
      <div className="space-y-4">
        {/* Subject selector (if multiple) */}
        {subjects.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {subjects.map((s: any) => (
              <button
                key={s.subject_user_id}
                onClick={() => setSelected360Subject(s.subject_user_id)}
                className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                  activeSubject === s.subject_user_id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                }`}
              >
                {s.subject_user_id}
              </button>
            ))}
          </div>
        )}

        {othersResp.length < MIN_RATERS ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Waiting for more responses. Results will be shown once at least {MIN_RATERS} raters have completed the survey.
                <br /><span className="text-xs">({othersResp.length}/{MIN_RATERS} so far)</span>
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {questions.filter(q => q.type === "rating_7").map(q => {
              const selfScore = selfResp ? parseFloat(selfResp.answers?.[q.id]) : null;
              const otherScores = othersResp.map((r: any) => parseFloat(r.answers?.[q.id])).filter(s => !isNaN(s));
              const othersAvg = otherScores.length ? (otherScores.reduce((a, b) => a + b, 0) / otherScores.length).toFixed(1) : null;
              return (
                <Card key={q.id}>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{q.label}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex gap-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-foreground">{selfScore ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">Self</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{othersAvg ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">Others avg ({otherScores.length})</div>
                      </div>
                      {selfScore && othersAvg && (
                        <div className="text-center">
                          <div className={`text-2xl font-bold ${parseFloat(othersAvg) > selfScore ? "text-green-600" : "text-amber-600"}`}>
                            {parseFloat(othersAvg) > selfScore ? "▲" : "▼"} {Math.abs(parseFloat(othersAvg) - selfScore).toFixed(1)}
                          </div>
                          <div className="text-xs text-muted-foreground">Gap</div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {/* Open text responses */}
            {questions.filter(q => q.type === "text").map(q => {
              const textResp = othersResp.map((r: any) => r.answers?.[q.id]).filter(Boolean);
              if (!textResp.length) return null;
              return (
                <Card key={q.id}>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{q.label}</CardTitle></CardHeader>
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
```

**Step 4: Build check**

```bash
npm run build 2>&1 | tail -20
```
Expected: `✓ Compiled successfully`, `/dashboard/surveys/[id]` in route list.

**Step 5: Commit**

```bash
git add src/app/dashboard/surveys/
git commit -m "feat: survey detail page with 360 gap chart, pulse bars, eNPS gauge"
```

---

## Task 8: Deploy to Vercel

**Step 1: Final build check**

```bash
npm run build 2>&1 | grep -E "(error|Error|✓|✗)"
```
Expected: `✓ Compiled successfully`, no errors.

**Step 2: Deploy**

```bash
vercel --prod 2>&1
```
Expected: `Aliased: https://nami-ochre.vercel.app`

**Step 3: Verify routes live**

Check these URLs return 200 (not 404/500):
- `https://nami-ochre.vercel.app/dashboard/surveys`
- `https://nami-ochre.vercel.app/dashboard/surveys/new`

**Step 4: Final commit if any fixes needed**

```bash
git add -u
git commit -m "fix: any post-deploy fixes"
```
