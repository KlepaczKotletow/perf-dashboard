# Notifications, Slack App Home Tab & Org Chart — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an org chart toggle to Team Directory, Slack DM notifications for review assignments / deadlines / goal status, and a personalized Slack App Home tab.

**Architecture:** Option B — Supabase Edge Functions for async/scheduled work, Next.js for UI. Org chart is pure frontend (data already in DB). Notifications use a `cycle-notifications` edge function (already wired in `cycle-actions.tsx`) plus a new `send-deadline-reminders` edge function with `pg_cron`. Slack App Home tab is served by a new `slack-events` edge function.

**Tech Stack:** Next.js 14 App Router, Supabase (Edge Functions + pg_cron), Slack Web API (Block Kit, chat.postMessage, views.publish), TypeScript, Tailwind + shadcn/ui

---

## Key Context

- **`supabase/functions/slack-interactivity/index.ts`** already exists with full Slack signature verification pattern — copy that HMAC-SHA256 pattern for new edge functions.
- **`cycle-actions.tsx:77`** already calls `supabase.functions.invoke("cycle-notifications", { body: { action: "launch", cycle_id } })` — Task 2 creates this missing function.
- **`goals-client.tsx:284`** has `updateTrackingStatus` — Task 4 augments this.
- **`team/page.tsx`** already fetches users with `manager_id` — pass same data to OrgChart.
- Env vars: `SLACK_SIGNING_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `DASHBOARD_URL` are already set on the Supabase edge function env. `NEXT_PUBLIC_APP_URL` may need adding.

---

## Task 1: DB Migration — notification_log table

**Files:**
- Create: `supabase/migrations/20260316_notification_log.sql`

**Step 1: Write the migration SQL**

```sql
-- supabase/migrations/20260316_notification_log.sql
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now()
);

-- Unique index prevents duplicate sends for the same event+reference
CREATE UNIQUE INDEX IF NOT EXISTS notification_log_dedup
  ON notification_log(workspace_id, user_id, event_type, reference_id);

CREATE INDEX IF NOT EXISTS notification_log_workspace_idx
  ON notification_log(workspace_id, event_type, sent_at);
```

**Step 2: Apply the migration via Supabase MCP**

Use the `apply_migration` MCP tool with the SQL above. Confirm it runs without error.

**Step 3: Verify table exists**

Use `list_tables` MCP tool, confirm `notification_log` appears.

**Step 4: Commit**

```bash
git add supabase/migrations/20260316_notification_log.sql
git commit -m "feat: add notification_log table for dedup tracking"
```

---

## Task 2: cycle-notifications Edge Function

Handles immediate Slack DMs on cycle launch and goal status changes.

**Files:**
- Create: `supabase/functions/cycle-notifications/index.ts`

**Step 1: Create the edge function**

```typescript
// supabase/functions/cycle-notifications/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DASHBOARD_URL = Deno.env.get("DASHBOARD_URL") || "https://nami-ochre.vercel.app";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function sendSlackDM(botToken: string, slackUserId: string, text: string): Promise<boolean> {
  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel: slackUserId, text }),
    });
    const data = await res.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

async function logNotification(
  workspaceId: string,
  userId: string,
  eventType: string,
  referenceId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("notification_log")
    .insert({ workspace_id: workspaceId, user_id: userId, event_type: eventType, reference_id: referenceId });
  // If unique constraint fires, insert fails — that means already sent, return false
  return !error;
}

async function handleCycleLaunch(cycleId: string) {
  // Fetch cycle + workspace bot token
  const { data: cycle } = await supabase
    .from("performance_cycles")
    .select("id, name, review_deadline, workspace_id, workspaces(bot_token)")
    .eq("id", cycleId)
    .single();

  if (!cycle) return { sent: 0, skipped: 0 };

  const botToken = (cycle as any).workspaces?.bot_token;
  if (!botToken) return { sent: 0, skipped: 0, error: "No bot token" };

  // Fetch all review assignments for this cycle (both standard and upward)
  const { data: assignments } = await supabase
    .from("review_assignments")
    .select(`
      id,
      employee_id,
      manager_id,
      assignment_type,
      employee:users!review_assignments_employee_id_fkey(id, slack_user_id, slack_name),
      manager:users!review_assignments_manager_id_fkey(id, slack_user_id, slack_name)
    `)
    .eq("cycle_id", cycleId);

  if (!assignments) return { sent: 0, skipped: 0 };

  const workspaceId = cycle.workspace_id;
  const deadline = cycle.review_deadline
    ? new Date(cycle.review_deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "no deadline set";

  let sent = 0;
  let skipped = 0;

  for (const a of assignments) {
    const emp = (a as any).employee;
    const mgr = (a as any).manager;

    // Notify manager to complete review for employee
    if (mgr?.slack_user_id) {
      const canSend = await logNotification(workspaceId, mgr.id, "review_assigned", a.id);
      if (canSend) {
        const text = `📋 *Review cycle started: ${cycle.name}*\nYou have a review to complete for *${emp?.slack_name || "a team member"}*.\nDeadline: ${deadline}\n→ ${DASHBOARD_URL}/dashboard/cycles/${cycleId}`;
        const ok = await sendSlackDM(botToken, mgr.slack_user_id, text);
        if (ok) sent++; else skipped++;
      } else {
        skipped++;
      }
    }

    // Notify employee to complete self-assessment
    if (emp?.slack_user_id && a.assignment_type === "standard") {
      const canSend = await logNotification(workspaceId, emp.id, "review_assigned", `self_${a.id}`);
      if (canSend) {
        const text = `📋 *Review cycle started: ${cycle.name}*\nYour performance review has begun. Please complete your self-assessment.\nDeadline: ${deadline}\n→ ${DASHBOARD_URL}/dashboard/my-reviews`;
        const ok = await sendSlackDM(botToken, emp.slack_user_id, text);
        if (ok) sent++; else skipped++;
      } else {
        skipped++;
      }
    }
  }

  return { sent, skipped };
}

async function handleGoalStatusUpdate(goalId: string, newStatus: string, employeeId: string) {
  // Fetch goal + employee + manager
  const { data: goal } = await supabase
    .from("goals")
    .select("id, title, workspace_id")
    .eq("id", goalId)
    .single();

  if (!goal) return { sent: 0 };

  const { data: employee } = await supabase
    .from("users")
    .select("id, slack_name, manager_id")
    .eq("id", employeeId)
    .single();

  if (!employee?.manager_id) return { sent: 0 };

  const { data: manager } = await supabase
    .from("users")
    .select("id, slack_user_id")
    .eq("id", employee.manager_id)
    .single();

  if (!manager?.slack_user_id) return { sent: 0 };

  // Get bot token
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("bot_token")
    .eq("id", goal.workspace_id)
    .single();

  if (!workspace?.bot_token) return { sent: 0 };

  const statusLabels: Record<string, string> = {
    at_risk: "⚠️ At risk",
    delayed: "🔴 Delayed",
    on_track: "✅ Back on track",
    achieved: "🎉 Achieved",
  };

  const label = statusLabels[newStatus] || newStatus;
  const referenceId = `goal_${goalId}_${newStatus}`;

  const canSend = await logNotification(goal.workspace_id, manager.id, "goal_status_update", referenceId);
  if (!canSend) return { sent: 0 };

  const text = `${label} — *${goal.title}*\n${employee.slack_name}'s goal status has changed.\n→ ${DASHBOARD_URL}/dashboard/goals`;
  const ok = await sendSlackDM(workspace.bot_token, manager.slack_user_id, text);
  return { sent: ok ? 1 : 0 };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    const { action, cycle_id, goal_id, new_status, employee_id } = body;

    let result;
    if (action === "launch" && cycle_id) {
      result = await handleCycleLaunch(cycle_id);
    } else if (action === "goal_status" && goal_id && new_status && employee_id) {
      result = await handleGoalStatusUpdate(goal_id, new_status, employee_id);
    } else {
      return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400 });
    }

    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("cycle-notifications error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
```

**Step 2: Deploy the edge function via Supabase MCP**

Use `deploy_edge_function` MCP tool:
- name: `cycle-notifications`
- entrypoint: content of the file above

**Step 3: Verify deployment**

Use `list_edge_functions` MCP tool and confirm `cycle-notifications` appears.

**Step 4: Commit**

```bash
git add supabase/functions/cycle-notifications/index.ts
git commit -m "feat: cycle-notifications edge function for Slack DMs on launch and goal status"
```

---

## Task 3: Goal status notification — wire up in goals-client

**Files:**
- Modify: `src/app/dashboard/goals/goals-client.tsx` (line 284–287)

**Step 1: Update `updateTrackingStatus` to fire edge function**

Find this existing code in `goals-client.tsx:284`:
```typescript
async function updateTrackingStatus(goalId: string, status: string) {
  await supabase.from("goals").update({ tracking_status: status }).eq("id", goalId);
  router.refresh();
}
```

Replace with:
```typescript
async function updateTrackingStatus(goalId: string, status: string, employeeId?: string) {
  await supabase.from("goals").update({ tracking_status: status }).eq("id", goalId);

  // Notify manager if status is concerning (fire-and-forget, don't block UI)
  if (employeeId && (status === "at_risk" || status === "delayed" || status === "achieved")) {
    supabase.functions.invoke("cycle-notifications", {
      body: { action: "goal_status", goal_id: goalId, new_status: status, employee_id: employeeId },
    }).catch(() => {}); // silent fail — notification is best-effort
  }

  router.refresh();
}
```

**Step 2: Pass `employeeId` when calling `updateTrackingStatus`**

In the same file, find the dropdown menu item (around line 557):
```typescript
onClick={() => updateTrackingStatus(goal.id, key)}
```

Replace with:
```typescript
onClick={() => updateTrackingStatus(goal.id, key, goal.employee?.id ?? undefined)}
```

**Step 3: Verify in browser**

1. Open `/dashboard/goals`
2. Change a goal's status to "At risk" or "Delayed" for a user who has a manager
3. Check Supabase edge function logs (`get_logs` MCP, function: `cycle-notifications`) — should show the invocation
4. If the manager has a real Slack account in the workspace, check their DMs

**Step 4: Commit**

```bash
git add src/app/dashboard/goals/goals-client.tsx
git commit -m "feat: notify manager via Slack when goal tracking status changes"
```

---

## Task 4: Org Chart component

**Files:**
- Create: `src/app/dashboard/team/org-chart.tsx`
- Modify: `src/app/dashboard/team/page.tsx`

**Step 1: Create the OrgChart component**

```typescript
// src/app/dashboard/team/org-chart.tsx
"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";

interface OrgUser {
  id: string;
  slack_name: string | null;
  job_title: string | null;
  department: string | null;
  manager_id: string | null;
  avatar_url?: string | null;
}

interface OrgNode extends OrgUser {
  children: OrgNode[];
}

function buildTree(users: OrgUser[]): OrgNode[] {
  const map = new Map<string, OrgNode>();
  users.forEach((u) => map.set(u.id, { ...u, children: [] }));

  const roots: OrgNode[] = [];
  map.forEach((node) => {
    if (node.manager_id && map.has(node.manager_id)) {
      map.get(node.manager_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function getInitials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function OrgNode({ node, depth = 0 }: { node: OrgNode; depth?: number }) {
  return (
    <div className={depth > 0 ? "ml-8 border-l border-border/60 pl-4" : ""}>
      <div className="py-1.5">
        <Link
          href={`/dashboard/team/${node.id}`}
          className="inline-flex items-center gap-3 px-3 py-2 rounded-xl border border-border/60 bg-card hover:border-border hover:shadow-sm transition-all group"
        >
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="text-xs bg-primary/[0.08] text-primary font-medium">
              {getInitials(node.slack_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
              {node.slack_name || "Unknown"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {node.job_title || node.department || "—"}
            </p>
          </div>
          {node.children.length > 0 && (
            <span className="ml-2 text-[10px] text-muted-foreground/60 shrink-0">
              {node.children.length} direct
            </span>
          )}
        </Link>
      </div>
      {node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <OrgNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

interface OrgChartProps {
  users: OrgUser[];
}

export function OrgChart({ users }: OrgChartProps) {
  const roots = buildTree(users);

  if (roots.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-sm">No org structure to display.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {roots.map((root) => (
        <OrgNode key={root.id} node={root} />
      ))}
    </div>
  );
}
```

**Step 2: Add toggle to `team/page.tsx`**

Add the import at the top of `src/app/dashboard/team/page.tsx`:
```typescript
import { OrgChart } from "./org-chart";
import { List, Network } from "lucide-react";
```

Update the function signature to accept `view` param:
```typescript
export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; view?: string }>;
}) {
  const params = await searchParams;
  const filterUnassigned = params.filter === "unassigned";
  const viewChart = params.view === "chart";
  // ... rest unchanged
```

In the header `<div className="flex justify-between items-center">`, add toggle buttons after the seat indicator and before the admin buttons:
```typescript
{/* View toggle */}
<div className="flex items-center border rounded-lg overflow-hidden">
  <Link
    href="/dashboard/team"
    className={`p-1.5 transition-colors ${!viewChart ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
    title="List view"
  >
    <List className="h-4 w-4" />
  </Link>
  <Link
    href="/dashboard/team?view=chart"
    className={`p-1.5 transition-colors ${viewChart ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
    title="Org chart"
  >
    <Network className="h-4 w-4" />
  </Link>
</div>
```

Replace the bottom section where `<TeamList>` is rendered:
```typescript
{users.length === 0 ? (
  // ... existing empty state unchanged
) : viewChart ? (
  <OrgChart users={users} />
) : (
  <TeamList
    users={users}
    isAdmin={isAdmin}
    currentUserId={workspace?.appUserId}
    workspaceId={workspace?.workspaceId}
    filterUnassigned={filterUnassigned}
    useDepartments={useDepartments}
    useCareerFramework={useCareerFramework}
  />
)}
```

**Step 3: Verify in browser**

1. Open `/dashboard/team`
2. Click the Network/tree icon — should switch to org chart view
3. Click List icon — should switch back
4. Confirm nodes are nested correctly based on `manager_id`
5. Confirm clicking a node navigates to `/dashboard/team/[id]`

**Step 4: Commit**

```bash
git add src/app/dashboard/team/org-chart.tsx src/app/dashboard/team/page.tsx
git commit -m "feat: org chart toggle on team directory page"
```

---

## Task 5: send-deadline-reminders Edge Function

Runs daily at 9am UTC. Sends Slack DMs to reviewers 7 and 3 days before deadline.

**Files:**
- Create: `supabase/functions/send-deadline-reminders/index.ts`

**Step 1: Create the edge function**

```typescript
// supabase/functions/send-deadline-reminders/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DASHBOARD_URL = Deno.env.get("DASHBOARD_URL") || "https://nami-ochre.vercel.app";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function sendSlackDM(botToken: string, slackUserId: string, text: string): Promise<boolean> {
  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel: slackUserId, text }),
    });
    const data = await res.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  // Accept both GET (from pg_cron HTTP call) and POST
  try {
    const today = new Date();
    const daysToCheck = [3, 7];

    let totalSent = 0;
    let totalSkipped = 0;

    for (const daysAhead of daysToCheck) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + daysAhead);
      const dateStr = targetDate.toISOString().split("T")[0]; // YYYY-MM-DD

      // Find active cycles with deadline on this date
      const { data: cycles } = await supabase
        .from("performance_cycles")
        .select("id, name, review_deadline, workspace_id, workspaces(bot_token)")
        .eq("status", "active")
        .gte("review_deadline", `${dateStr}T00:00:00Z`)
        .lt("review_deadline", `${dateStr}T23:59:59Z`);

      if (!cycles) continue;

      for (const cycle of cycles) {
        const botToken = (cycle as any).workspaces?.bot_token;
        if (!botToken) continue;

        const deadline = new Date(cycle.review_deadline).toLocaleDateString("en-GB", {
          day: "numeric", month: "short", year: "numeric",
        });

        // Find incomplete review assignments (managers who haven't submitted)
        const { data: assignments } = await supabase
          .from("review_assignments")
          .select(`
            id,
            manager_id,
            employee:users!review_assignments_employee_id_fkey(slack_name),
            manager:users!review_assignments_manager_id_fkey(id, slack_user_id)
          `)
          .eq("cycle_id", cycle.id)
          .neq("status", "completed");

        if (!assignments) continue;

        for (const a of assignments) {
          const mgr = (a as any).manager;
          const emp = (a as any).employee;
          if (!mgr?.slack_user_id) continue;

          const eventType = "cycle_deadline_reminder";
          const referenceId = `${cycle.id}_${a.id}_d${daysAhead}`;

          // Check if already sent
          const { data: existing } = await supabase
            .from("notification_log")
            .select("id")
            .eq("workspace_id", cycle.workspace_id)
            .eq("user_id", mgr.id)
            .eq("event_type", eventType)
            .eq("reference_id", referenceId)
            .maybeSingle();

          if (existing) {
            totalSkipped++;
            continue;
          }

          const text = `⏰ *Reminder: ${daysAhead} days left — ${cycle.name}*\nYou still have a review to complete for *${emp?.slack_name || "a team member"}*.\nDeadline: ${deadline}\n→ ${DASHBOARD_URL}/dashboard/cycles/${cycle.id}`;
          const ok = await sendSlackDM(botToken, mgr.slack_user_id, text);

          if (ok) {
            await supabase.from("notification_log").insert({
              workspace_id: cycle.workspace_id,
              user_id: mgr.id,
              event_type: eventType,
              reference_id: referenceId,
            });
            totalSent++;
          } else {
            totalSkipped++;
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, sent: totalSent, skipped: totalSkipped }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-deadline-reminders error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
```

**Step 2: Deploy the edge function**

Use `deploy_edge_function` MCP tool:
- name: `send-deadline-reminders`

**Step 3: Set up pg_cron schedule via SQL migration**

Create `supabase/migrations/20260316_deadline_reminders_cron.sql`:

```sql
-- Enable pg_cron extension (may already be enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily at 09:00 UTC
-- Uses net.http_post to call the edge function
SELECT cron.schedule(
  'deadline-reminders-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://zhfvxfvmdlpdfgxrwtdn.supabase.co/functions/v1/send-deadline-reminders',
    headers := '{"Authorization": "Bearer ' || current_setting('app.service_role_key', true) || '"}'::jsonb,
    body := '{}'::jsonb
  )
  $$
);
```

Apply via `apply_migration` MCP tool.

**Step 4: Verify deployment and cron**

Use `list_edge_functions` MCP — confirm `send-deadline-reminders` appears.
Use `execute_sql` MCP with `SELECT * FROM cron.job;` — confirm the job appears.

**Step 5: Commit**

```bash
git add supabase/functions/send-deadline-reminders/index.ts supabase/migrations/20260316_deadline_reminders_cron.sql
git commit -m "feat: scheduled deadline reminder Slack DMs via edge function and pg_cron"
```

---

## Task 6: Slack App Home Tab — slack-events edge function

**Files:**
- Create: `supabase/functions/slack-events/index.ts`

**Step 1: Create the edge function**

```typescript
// supabase/functions/slack-events/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SLACK_SIGNING_SECRET = Deno.env.get("SLACK_SIGNING_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DASHBOARD_URL = Deno.env.get("DASHBOARD_URL") || "https://nami-ochre.vercel.app";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Verify Slack request signature (same pattern as slack-interactivity)
async function verifySlackSignature(req: Request, body: string): Promise<boolean> {
  if (!SLACK_SIGNING_SECRET) return true; // skip in dev
  const timestamp = req.headers.get("x-slack-request-timestamp") || "";
  const slackSig = req.headers.get("x-slack-signature") || "";
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) return false;
  const baseString = `v0:${timestamp}:${body}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(SLACK_SIGNING_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(baseString));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `v0=${hex}` === slackSig;
}

async function publishHomeTab(botToken: string, slackUserId: string, blocks: unknown[]) {
  await fetch("https://slack.com/api/views.publish", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: slackUserId,
      view: { type: "home", blocks },
    }),
  });
}

function divider() {
  return { type: "divider" };
}

function section(text: string) {
  return { type: "section", text: { type: "mrkdwn", text } };
}

function header(text: string) {
  return { type: "header", text: { type: "plain_text", text, emoji: true } };
}

async function buildHomeBlocks(appUser: { id: string; role: string; workspace_id: string }) {
  const blocks: unknown[] = [];
  const { id: userId, role, workspace_id: workspaceId } = appUser;
  const isManagerOrAbove = role === "manager" || role === "admin" || role === "hr";

  // ── Pending reviews ──────────────────────────────────────────────
  const { data: pendingReviews } = await supabase
    .from("review_assignments")
    .select("id, cycle_id, employee:users!review_assignments_employee_id_fkey(slack_name), cycle:performance_cycles(name, review_deadline)")
    .eq("manager_id", userId)
    .eq("status", "pending");

  if (pendingReviews && pendingReviews.length > 0) {
    blocks.push(header("📋 Pending Reviews"));
    for (const r of pendingReviews.slice(0, 5)) {
      const emp = (r as any).employee;
      const cycle = (r as any).cycle;
      const deadline = cycle?.review_deadline
        ? new Date(cycle.review_deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
        : "no deadline";
      blocks.push(section(`*${emp?.slack_name || "Unknown"}* — ${cycle?.name || "Review"}\n_Due: ${deadline}_ | <${DASHBOARD_URL}/dashboard/cycles/${r.cycle_id}|Complete review>`));
    }
    if (pendingReviews.length > 5) {
      blocks.push(section(`_...and ${pendingReviews.length - 5} more. <${DASHBOARD_URL}/dashboard/my-reviews|View all>_`));
    }
    blocks.push(divider());
  }

  // ── Pending self-assessments ─────────────────────────────────────
  const { data: selfPending } = await supabase
    .from("review_assignments")
    .select("id, cycle_id, cycle:performance_cycles(name, review_deadline)")
    .eq("employee_id", userId)
    .eq("status", "pending");

  if (selfPending && selfPending.length > 0) {
    blocks.push(header("✍️ Self-Assessments Due"));
    for (const r of selfPending.slice(0, 3)) {
      const cycle = (r as any).cycle;
      const deadline = cycle?.review_deadline
        ? new Date(cycle.review_deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
        : "no deadline";
      blocks.push(section(`*${cycle?.name || "Review"}*\n_Due: ${deadline}_ | <${DASHBOARD_URL}/dashboard/my-reviews|Start>`));
    }
    blocks.push(divider());
  }

  // ── Recent feedback received (visibility-gated) ───────────────────
  const { data: feedback } = await supabase
    .from("continuous_feedback")
    .select("id, message, feedback_type, is_anonymous, created_at, from_user:users!continuous_feedback_from_user_id_fkey(slack_name)")
    .eq("to_user_id", userId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(3);

  // Only show non-anonymous feedback (anonymous = not visible to recipient)
  const visibleFeedback = (feedback || []).filter((f) => !f.is_anonymous);

  if (visibleFeedback.length > 0) {
    blocks.push(header("💬 Recent Feedback"));
    for (const f of visibleFeedback) {
      const from = (f as any).from_user?.slack_name || "Someone";
      const preview = f.message.length > 120 ? f.message.slice(0, 120) + "…" : f.message;
      blocks.push(section(`*From ${from}:* ${preview}`));
    }
    blocks.push(divider());
  }

  // ── Manager: team's pending reviews ──────────────────────────────
  if (isManagerOrAbove) {
    const { data: teamPending } = await supabase
      .from("review_assignments")
      .select("id, manager_id, employee:users!review_assignments_employee_id_fkey(slack_name, manager_id)")
      .neq("status", "completed")
      .eq("workspace_id", workspaceId);

    // Filter to direct reports of this manager
    const myTeamPending = (teamPending || []).filter((a: any) => a.employee?.manager_id === userId);

    if (myTeamPending.length > 0) {
      blocks.push(header(`👥 Team Reviews Pending (${myTeamPending.length})`));
      const names = [...new Set(myTeamPending.map((a: any) => a.employee?.slack_name).filter(Boolean))];
      blocks.push(section(names.slice(0, 5).map((n) => `• ${n}`).join("\n") + (names.length > 5 ? `\n_...and ${names.length - 5} more_` : "")));
      blocks.push(section(`<${DASHBOARD_URL}/dashboard/cycles|View all cycles>`));
      blocks.push(divider());
    }
  }

  // ── Own at-risk / delayed goals ───────────────────────────────────
  const { data: badGoals } = await supabase
    .from("goals")
    .select("id, title, tracking_status")
    .eq("employee_id", userId)
    .eq("status", "active")
    .in("tracking_status", ["at_risk", "delayed"]);

  if (badGoals && badGoals.length > 0) {
    blocks.push(header("🎯 Goals Needing Attention"));
    for (const g of badGoals.slice(0, 4)) {
      const icon = g.tracking_status === "delayed" ? "🔴" : "⚠️";
      blocks.push(section(`${icon} *${g.title}*`));
    }
    blocks.push(section(`<${DASHBOARD_URL}/dashboard/goals|View all goals>`));
    blocks.push(divider());
  }

  // ── Footer ────────────────────────────────────────────────────────
  if (blocks.length === 0) {
    blocks.push(header("👋 You're all caught up!"));
    blocks.push(section(`No pending reviews or urgent goals.\n<${DASHBOARD_URL}/dashboard|Open dashboard>`));
  } else {
    blocks.push(section(`<${DASHBOARD_URL}/dashboard|Open full dashboard>`));
  }

  return blocks;
}

Deno.serve(async (req) => {
  const body = await req.text();

  const valid = await verifySlackSignature(req, body);
  if (!valid) return new Response("Invalid signature", { status: 403 });

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  // Slack URL verification challenge (one-time during app setup)
  if (event.type === "url_verification") {
    return new Response(JSON.stringify({ challenge: event.challenge }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (event.type !== "event_callback") {
    return new Response("OK", { status: 200 });
  }

  const innerEvent = event.event;

  if (innerEvent?.type === "app_home_opened") {
    const slackUserId = innerEvent.user;
    const teamId = event.team_id;

    // Look up workspace by team_id
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id, bot_token")
      .eq("team_id", teamId)
      .single();

    if (!workspace?.bot_token) {
      return new Response("Workspace not found", { status: 404 });
    }

    // Look up app user by slack_user_id + workspace_id
    const { data: appUser } = await supabase
      .from("users")
      .select("id, role, workspace_id")
      .eq("slack_user_id", slackUserId)
      .eq("workspace_id", workspace.id)
      .single();

    if (!appUser) {
      // User not in system yet — show simple welcome
      await publishHomeTab(workspace.bot_token, slackUserId, [
        header("👋 Welcome to Perf"),
        section("You haven't been added to the workspace yet. Ask your admin to import the team from Slack."),
      ]);
      return new Response("OK", { status: 200 });
    }

    const blocks = await buildHomeBlocks(appUser);
    await publishHomeTab(workspace.bot_token, slackUserId, blocks);
  }

  return new Response("OK", { status: 200 });
});
```

**Step 2: Deploy the edge function**

Use `deploy_edge_function` MCP tool:
- name: `slack-events`

**Step 3: Configure Slack app to send `app_home_opened` events**

In the Slack App dashboard (api.slack.com):
1. Go to **Event Subscriptions** → Enable Events
2. Set Request URL to: `https://zhfvxfvmdlpdfgxrwtdn.supabase.co/functions/v1/slack-events`
3. Under "Subscribe to bot events", add: `app_home_opened`
4. Save Changes — Slack will hit the URL for challenge verification (handled in the function)

**Step 4: Verify**

1. Open the Slack app in your Slack workspace
2. Click the app's Home tab
3. Check edge function logs via `get_logs` MCP (function: `slack-events`)
4. The Home tab should render with your pending reviews/goals

**Step 5: Commit**

```bash
git add supabase/functions/slack-events/index.ts
git commit -m "feat: Slack App Home tab with role-aware dashboard via app_home_opened event"
```

---

## Summary

| Task | Feature | Files |
|---|---|---|
| 1 | DB migration | `supabase/migrations/20260316_notification_log.sql` |
| 2 | Immediate Slack DMs | `supabase/functions/cycle-notifications/index.ts` |
| 3 | Goal status notifications | `src/app/dashboard/goals/goals-client.tsx` |
| 4 | Org chart toggle | `src/app/dashboard/team/org-chart.tsx`, `team/page.tsx` |
| 5 | Scheduled reminders | `supabase/functions/send-deadline-reminders/index.ts`, migration |
| 6 | Slack App Home tab | `supabase/functions/slack-events/index.ts` |

**Recommended order:** 1 → 2 → 4 → 3 → 5 → 6 (DB first, most impactful visible feature next, then notifications, then scheduled, then Home tab last as it needs Slack app config)
