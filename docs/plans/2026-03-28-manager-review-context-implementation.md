# Enhanced Manager Review Context + Security Hardening — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enrich the manager review DM with competency matrix expectations, per-competency previous ratings, and goal status breakdown — plus fix critical authorization gaps.

**Architecture:** Extend `getManagerContext()` in nami-bot to fetch level_competencies + previous per-competency ratings + goal tracking statuses. Update `buildManagerReviewOpening()` in nami-blocks to render the new context sections. Add authorization checks in slack-interactivity to prevent unauthorized review access.

**Tech Stack:** Supabase Edge Functions (Deno/TypeScript), Slack Block Kit, PostgREST queries

---

### Task 1: Security — Add Manager Authorization Check in slack-interactivity

**Files:**
- Modify: `supabase/functions/slack-interactivity/index.ts:1097-1129` (open_cycle_review)
- Modify: `supabase/functions/slack-interactivity/index.ts:1181-1207` (start_dm_review)
- Modify: `supabase/functions/slack-interactivity/index.ts:1562-1605` (nami_start_review)

**Step 1: Add authorization check to `open_cycle_review` handler**

At line ~1109, after determining `reviewRole`, add validation before proceeding:

```typescript
      // After existing role assignment (line 1109):
      let reviewRole = "manager";
      if (user.id === assignment.employee_id) reviewRole = "self";
      if (assignment.assignment_type === "upward" && user.id === assignment.reviewer_id) reviewRole = "upward";
      if (assignment.assignment_type === "peer" && user.id === assignment.reviewer_id) reviewRole = "peer";

      // ADD: Authorization check — reject if role doesn't match
      if (reviewRole === "manager" && user.id !== assignment.manager_id) {
        await slackApi(botToken, "chat.postEphemeral", {
          channel: payload.channel?.id || payload.user.id,
          user: payload.user.id,
          text: ":no_entry: You are not authorized to review this employee.",
        });
        return json({});
      }
```

**Step 2: Add same authorization check to `start_dm_review` handler**

At line ~1197, after determining `reviewRole`:

```typescript
      let reviewRole = "manager";
      if (user.id === assignment.employee_id) reviewRole = "self";
      if (assignment.assignment_type === "upward" && user.id === assignment.reviewer_id) reviewRole = "upward";
      if (assignment.assignment_type === "peer" && user.id === assignment.reviewer_id) reviewRole = "peer";

      // ADD: Authorization check
      if (reviewRole === "manager" && user.id !== assignment.manager_id) {
        await slackApi(botToken, "chat.postMessage", {
          channel: payload.user.id,
          text: ":no_entry: You are not authorized to review this employee.",
        });
        return json({});
      }
```

**Step 3: Add same authorization check to `nami_start_review` handler**

At line ~1581, after determining `reviewRole`:

```typescript
      let reviewRole = "manager";
      if (rolePrefix === "self" || user.id === assignment.employee_id) reviewRole = "self";
      if (rolePrefix === "upward" || (assignment.assignment_type === "upward" && user.id === assignment.reviewer_id)) reviewRole = "upward";
      if (assignment.assignment_type === "peer" && user.id === assignment.reviewer_id) reviewRole = "peer";

      // ADD: Authorization check
      if (reviewRole === "manager" && user.id !== assignment.manager_id) {
        await slackApi(botToken, "chat.postMessage", {
          channel: slackUserId,
          text: ":no_entry: You are not authorized to review this employee.",
        });
        return json({});
      }
```

**Step 4: Commit**

```bash
git add supabase/functions/slack-interactivity/index.ts
git commit -m "security: add manager authorization check to review action handlers

Prevents unauthorized users from opening review forms for employees
they don't manage. Validates user.id === assignment.manager_id before
allowing manager role. Also adds peer role detection."
```

---

### Task 2: Extend `getManagerContext()` with Workspace Isolation + New Data

**Files:**
- Modify: `supabase/functions/nami-bot/index.ts:107-173`

**Step 1: Update the ManagerContext interface and function signature**

Replace the existing interface and function (lines 107-173) with:

```typescript
interface CompetencyExpectation {
  name: string;
  expectedLevel: number;
  prevRating?: number;
}

interface ManagerContext {
  selfAvg?: number;
  prevRating?: number;
  goalsCount?: number;
  goalsByStatus?: Record<string, number>;
  levelName?: string;
  competencyExpectations?: CompetencyExpectation[];
}

async function getManagerContext(
  employeeId: string,
  cycleId: string,
  workspaceId: string,
): Promise<ManagerContext> {
  const ctx: ManagerContext = {};

  try {
    // 0. Verify cycle belongs to this workspace
    const { data: cycle } = await supabase
      .from("performance_cycles")
      .select("id")
      .eq("id", cycleId)
      .eq("workspace_id", workspaceId)
      .single();
    if (!cycle) return ctx;

    // 1. Self-assessment average for this cycle
    const { data: assignments } = await supabase
      .from("review_assignments")
      .select("id")
      .eq("cycle_id", cycleId)
      .eq("employee_id", employeeId);

    if (assignments && assignments.length > 0) {
      const assignmentIds = assignments.map((a: any) => a.id);
      const { data: selfResponses } = await supabase
        .from("review_responses")
        .select("rating")
        .in("assignment_id", assignmentIds)
        .eq("reviewer_role", "self");

      if (selfResponses && selfResponses.length > 0) {
        const rated = selfResponses.filter((r: any) => r.rating != null);
        if (rated.length > 0) {
          ctx.selfAvg =
            rated.reduce((s: number, r: any) => s + r.rating, 0) / rated.length;
        }
      }
    }

    // 2. Previous cycle overall rating
    const { data: prevAssignments } = await supabase
      .from("review_assignments")
      .select("id, overall_rating")
      .eq("employee_id", employeeId)
      .eq("status", "completed")
      .neq("cycle_id", cycleId)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (prevAssignments?.[0]?.overall_rating) {
      ctx.prevRating = prevAssignments[0].overall_rating;
    }

    // 3. Previous cycle per-competency manager ratings
    let prevCompRatings: Record<string, number> = {};
    if (prevAssignments?.[0]?.id) {
      const { data: prevResponses } = await supabase
        .from("review_responses")
        .select("competency_id, rating")
        .eq("assignment_id", prevAssignments[0].id)
        .eq("reviewer_role", "manager");

      if (prevResponses) {
        for (const r of prevResponses) {
          if (r.competency_id && r.rating != null) {
            prevCompRatings[r.competency_id] = r.rating;
          }
        }
      }
    }

    // 4. Employee level name + competency expectations
    const { data: empData } = await supabase
      .from("users")
      .select("level_id, job_title, levels(name, job_families(name))")
      .eq("id", employeeId)
      .eq("workspace_id", workspaceId)
      .single();

    if (empData?.level_id) {
      const level = (empData as any).levels;
      if (level) {
        const jfName = level.job_families?.name;
        ctx.levelName = jfName ? `${jfName} — ${level.name}` : level.name;
      }

      // Fetch competency expectations for this level
      const { data: levelComps } = await supabase
        .from("level_competencies")
        .select("competency_id, expected_level, competencies(name)")
        .eq("level_id", empData.level_id)
        .eq("workspace_id", workspaceId);

      if (levelComps && levelComps.length > 0) {
        ctx.competencyExpectations = levelComps.map((lc: any) => ({
          name: lc.competencies?.name || "Unknown",
          expectedLevel: lc.expected_level,
          prevRating: prevCompRatings[lc.competency_id],
        }));
      }
    }

    // 5. Goal status breakdown
    const { data: goals } = await supabase
      .from("goals")
      .select("id, tracking_status")
      .eq("employee_id", employeeId)
      .eq("status", "active");

    if (goals && goals.length > 0) {
      ctx.goalsCount = goals.length;
      ctx.goalsByStatus = {};
      for (const g of goals) {
        const ts = g.tracking_status || "no_status";
        ctx.goalsByStatus[ts] = (ctx.goalsByStatus[ts] || 0) + 1;
      }
    }
  } catch (err) {
    console.error("getManagerContext error:", err);
  }

  return ctx;
}
```

**Step 2: Update the caller in `handleCycleLaunch()`**

At line ~325, change:
```typescript
// OLD:
const context = await getManagerContext(a.employee_id, cycleId);
// NEW:
const context = await getManagerContext(a.employee_id, cycleId, workspaceId);
```

**Step 3: Commit**

```bash
git add supabase/functions/nami-bot/index.ts
git commit -m "feat: enrich manager context with competency expectations and goal breakdown

Extends getManagerContext() to fetch:
- Employee level name from users → levels join
- Competency expectations from level_competencies
- Per-competency previous cycle manager ratings
- Goal tracking status breakdown (on_track/at_risk/etc)
- Workspace isolation via workspaceId parameter"
```

---

### Task 3: Update `buildManagerReviewOpening()` Block Kit Builder

**Files:**
- Modify: `supabase/functions/_shared/nami-blocks.ts:56-113`

**Step 1: Update the function signature and implementation**

Replace lines 56-113 with:

```typescript
export function buildManagerReviewOpening(
  managerName: string,
  employeeName: string,
  cycleName: string,
  deadline: string,
  assignmentId: string,
  context: {
    selfAvg?: number;
    prevRating?: number;
    goalsCount?: number;
    goalsByStatus?: Record<string, number>;
    levelName?: string;
    competencyExpectations?: Array<{
      name: string;
      expectedLevel: number;
      prevRating?: number;
    }>;
  },
  ratingMax: number = 5,
) {
  // --- Quick context section ---
  const contextLines: string[] = [];
  if (context.selfAvg != null) {
    contextLines.push(
      `Self-Assessment avg: :star: *${(Math.round(context.selfAvg * 10) / 10).toString()}/${ratingMax}*`,
    );
  }
  if (context.prevRating != null) {
    contextLines.push(
      `Previous cycle: :star: *${(Math.round(context.prevRating * 10) / 10).toString()}/${ratingMax}*`,
    );
  }

  // Goal status breakdown
  if (context.goalsCount != null && context.goalsCount > 0) {
    const statusParts: string[] = [];
    const byStatus = context.goalsByStatus || {};
    if (byStatus.on_track) statusParts.push(`${byStatus.on_track} on track`);
    if (byStatus.achieved) statusParts.push(`${byStatus.achieved} achieved`);
    if (byStatus.at_risk) statusParts.push(`${byStatus.at_risk} at risk`);
    if (byStatus.delayed) statusParts.push(`${byStatus.delayed} delayed`);

    const statusSuffix = statusParts.length > 0 ? ` (${statusParts.join(" · ")})` : "";
    contextLines.push(`Active goals: *${context.goalsCount}*${statusSuffix}`);
  }

  const contextBlock =
    contextLines.length > 0
      ? `\n\n:bar_chart: *Quick context:*\n${contextLines.join("\n")}`
      : "";

  // --- Competency expectations section ---
  let competencyBlock = "";
  if (
    context.competencyExpectations &&
    context.competencyExpectations.length > 0 &&
    context.levelName
  ) {
    const MAX_SHOWN = 5;
    const comps = context.competencyExpectations;
    const lines = comps.slice(0, MAX_SHOWN).map((c) => {
      let line = `• ${c.name} — target: *${c.expectedLevel}/${ratingMax}*`;
      if (c.prevRating != null) {
        const met = c.prevRating >= c.expectedLevel ? " :white_check_mark:" : "";
        line += ` (prev: ${c.prevRating}/${ratingMax})${met}`;
      } else {
        line += " _(no prior data)_";
      }
      return line;
    });
    if (comps.length > MAX_SHOWN) {
      lines.push(`_…and ${comps.length - MAX_SHOWN} more in the review form_`);
    }
    competencyBlock = `\n\n:clipboard: *${context.levelName} expectations:*\n${lines.join("\n")}`;
  }

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Hey ${managerName}! :wave:\n\nIt's time to review *${employeeName}* for *${cycleName}*.\n:calendar: Deadline: *${deadline}*${contextBlock}${competencyBlock}`,
      },
    },
    { type: "divider" },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Start review :pencil:", emoji: true },
          style: "primary",
          action_id: "nami_start_review",
          value: `mgr_${assignmentId}`,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Remind me later", emoji: true },
          action_id: "nami_remind_later",
          value: `mgr_${assignmentId}`,
        },
      ],
    },
  ];
}
```

**Step 2: Commit**

```bash
git add supabase/functions/_shared/nami-blocks.ts
git commit -m "feat: render competency expectations and goal breakdown in manager review DM

Shows employee's level name, per-competency expected ratings with
previous cycle comparison and checkmark indicators. Goals now show
tracking status breakdown (on track, at risk, etc). Caps at 5
competencies with overflow message."
```

---

### Task 4: Update `sendManagerContext()` in slack-interactivity

**Files:**
- Modify: `supabase/functions/slack-interactivity/index.ts:311-360`

The `sendManagerContext()` function in slack-interactivity is a separate context message sent BEFORE the modal opens (in addition to the DM opening). This should also include competency expectations for consistency.

**Step 1: Add competency expectations to the pre-modal context message**

After the existing context lines (goals, previous rating), add competency expectations. Replace lines 311-360:

```typescript
    async function sendManagerContext(slackUserId: string, employeeId: string, cycleId: string) {
      try {
        const contextLines: string[] = [];

        // Get all assignments for this employee in this cycle
        const empAssignments = await dbQuery("review_assignments",
          `cycle_id=eq.${cycleId}&employee_id=eq.${employeeId}&select=id,status`);
        const empAssignmentIds = (empAssignments || []).map((a: any) => a.id);

        if (empAssignmentIds.length > 0) {
          // 1. Self-assessment summary
          const selfResp = await dbQuery("review_responses",
            `assignment_id=in.(${empAssignmentIds.join(",")})&reviewer_role=eq.self&select=rating`);
          if (selfResp?.length > 0 && !selfResp.error) {
            const selfRatings = selfResp.filter((r: any) => r.rating);
            if (selfRatings.length > 0) {
              const selfAvg = selfRatings.reduce((s: number, r: any) => s + r.rating, 0) / selfRatings.length;
              contextLines.push(`Self-Assessment: :star: *${(Math.round(selfAvg * 10) / 10).toString()}* avg (${selfRatings.length} ratings)`);
            }
          }

          // 2. Peer/upward feedback
          const peerResp = await dbQuery("review_responses",
            `assignment_id=in.(${empAssignmentIds.join(",")})&reviewer_role=in.(peer,upward)&select=rating`);
          if (peerResp?.length > 0 && !peerResp.error) {
            const peerRatings = peerResp.filter((r: any) => r.rating);
            if (peerRatings.length > 0) {
              const peerAvg = peerRatings.reduce((s: number, r: any) => s + r.rating, 0) / peerRatings.length;
              contextLines.push(`Peer Feedback: :star: *${(Math.round(peerAvg * 10) / 10).toString()}* avg (${peerRatings.length} ratings)`);
            }
          }
        }

        // 3. Goals with tracking status
        const goals = await dbQuery("goals",
          `employee_id=eq.${employeeId}&status=eq.active&select=id,progress,tracking_status`);
        if (goals?.length > 0 && !goals.error) {
          const avgProgress = Math.round(goals.reduce((s: number, g: any) => s + (g.progress || 0), 0) / goals.length);
          const statusParts: string[] = [];
          const byStatus: Record<string, number> = {};
          for (const g of goals) {
            const ts = g.tracking_status || "no_status";
            byStatus[ts] = (byStatus[ts] || 0) + 1;
          }
          if (byStatus.on_track) statusParts.push(`${byStatus.on_track} on track`);
          if (byStatus.achieved) statusParts.push(`${byStatus.achieved} achieved`);
          if (byStatus.at_risk) statusParts.push(`${byStatus.at_risk} at risk`);
          if (byStatus.delayed) statusParts.push(`${byStatus.delayed} delayed`);
          const statusSuffix = statusParts.length > 0 ? ` · ${statusParts.join(" · ")}` : "";
          contextLines.push(`Goals: ${goals.length} active (${avgProgress}% avg progress${statusSuffix})`);
        }

        // 4. Previous cycle rating
        const prevAssignments = await dbQuery("review_assignments",
          `employee_id=eq.${employeeId}&status=eq.completed&cycle_id=neq.${cycleId}&select=id,overall_rating,updated_at&order=updated_at.desc&limit=1`);
        if (prevAssignments?.[0]?.overall_rating) {
          contextLines.push(`Previous Rating: :star: *${(Math.round(prevAssignments[0].overall_rating * 10) / 10).toString()}/${ws.rating_scale?.max || 5}*`);
        }

        // 5. Competency expectations from level matrix
        const empData = await dbQuery("users", `id=eq.${employeeId}&workspace_id=eq.${ws.id}&select=level_id,levels(name,job_families(name))`);
        const emp = empData?.[0];
        if (emp?.level_id) {
          const level = (emp as any).levels;
          const levelName = level?.job_families?.name
            ? `${level.job_families.name} — ${level.name}`
            : level?.name;

          const levelComps = await dbQuery("level_competencies",
            `level_id=eq.${emp.level_id}&workspace_id=eq.${ws.id}&select=competency_id,expected_level,competencies(name)`);

          if (levelComps?.length > 0 && !levelComps.error && levelName) {
            // Get previous per-competency ratings
            let prevCompMap: Record<string, number> = {};
            if (prevAssignments?.[0]?.id) {
              const prevResp = await dbQuery("review_responses",
                `assignment_id=eq.${prevAssignments[0].id}&reviewer_role=eq.manager&select=competency_id,rating`);
              if (prevResp && !prevResp.error) {
                for (const r of prevResp) {
                  if (r.competency_id && r.rating != null) prevCompMap[r.competency_id] = r.rating;
                }
              }
            }

            contextLines.push(""); // blank line separator
            contextLines.push(`:clipboard: *${levelName} expectations:*`);
            const MAX_SHOWN = 5;
            const shown = levelComps.slice(0, MAX_SHOWN);
            for (const lc of shown) {
              const compName = lc.competencies?.name || "Unknown";
              const prev = prevCompMap[lc.competency_id];
              let line = `• ${compName} — target: *${lc.expected_level}/${ws.rating_scale?.max || 5}*`;
              if (prev != null) {
                const met = prev >= lc.expected_level ? " :white_check_mark:" : "";
                line += ` (prev: ${prev}/${ws.rating_scale?.max || 5})${met}`;
              } else {
                line += " _(no prior data)_";
              }
              contextLines.push(line);
            }
            if (levelComps.length > MAX_SHOWN) {
              contextLines.push(`_…and ${levelComps.length - MAX_SHOWN} more in the review form_`);
            }
          }
        }

        if (contextLines.length === 0) return; // No context available
```

The rest of `sendManagerContext()` (lines 360+) stays the same — it sends the contextLines as a Block Kit message. Read lines 360-385 to confirm:

**Step 2: Commit**

```bash
git add supabase/functions/slack-interactivity/index.ts
git commit -m "feat: add competency expectations and goal tracking to pre-modal manager context

Enriches the context message sent before the review modal opens with:
- Goal tracking status breakdown (on track, at risk, delayed, achieved)
- Competency matrix expectations from level_competencies
- Per-competency previous cycle ratings with met/unmet indicators
- Workspace-isolated queries via ws.id filtering"
```

---

### Task 5: Deploy and Verify

**Step 1: Deploy all three edge functions**

Deploy the modified functions to Supabase. Order matters — deploy shared module first (nami-blocks), then dependents:

```bash
supabase functions deploy nami-bot
supabase functions deploy slack-interactivity
```

Note: `_shared/nami-blocks.ts` is imported by the other functions and deploys as part of them.

Alternatively, deploy using the Supabase MCP `deploy_edge_function` tool — read each function's file content and deploy.

**Step 2: Manual verification checklist**

1. **Manager context message:** Launch a test cycle where the employee has:
   - A `level_id` set with `level_competencies` defined
   - At least one completed previous cycle with manager ratings
   - Active goals with tracking statuses set
   → Verify the DM shows competency expectations, prev ratings, goal breakdown

2. **No level:** Set employee `level_id` to null → verify competency section is hidden

3. **No previous cycle:** Use an employee with no completed assignments → verify "(no prior data)" labels

4. **Authorization:** Have a non-manager user attempt to click a manager review button → verify rejection message

5. **Duplicate prevention:** Submit a review, then click the button again → verify "already submitted" message

6. **Overflow:** If an employee has >5 level_competencies → verify "and X more..." truncation

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: deploy manager review context enhancement and security fixes"
```
