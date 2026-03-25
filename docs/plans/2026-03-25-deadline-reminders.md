# Nami Deadline Reminders Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the every-3-days reminder ladder with deadline-anchored reminders (7d, 3d, 1d before + overdue) and add consolidated manager notifications (1d warning + overdue alert).

**Architecture:** Modify the `processAssignmentReminder()` function in `nami-bot/index.ts` to use deadline-anchored event types instead of counting reminders. Add two new Block Kit builders to `nami-blocks.ts` for the new message types. Remove the `daysLeft < 0` skip so overdue assignments still get processed. Add manager grouping logic to `handleReminders()` for consolidated manager DMs.

**Tech Stack:** Deno (Supabase Edge Functions), Slack Block Kit, PostgreSQL (`notification_log` table)

---

### Task 1: Add New Block Kit Message Builders

**Files:**
- Modify: `supabase/functions/_shared/nami-blocks.ts`

**Step 1: Add `buildDeadlineReminder` function**

Add after the existing `buildReminderMessage` function (line ~478):

```typescript
// ---------------------------------------------------------------------------
//  Deadline-anchored reminder (7d, 3d, 1d)
// ---------------------------------------------------------------------------
export function buildDeadlineReminder(
  userName: string,
  itemName: string,
  daysLeft: number,
  actionValue: string,
  actionId: string,
) {
  const urgency =
    daysLeft <= 1
      ? ":rotating_light: *Last call!*"
      : daysLeft <= 3
        ? ":hourglass_flowing_sand: *Getting close!*"
        : ":wave: *Heads up!*";

  const timeText =
    daysLeft <= 1
      ? "due *tomorrow*"
      : `due in *${daysLeft} days*`;

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${urgency}\n\nHey ${userName}, your *${itemName}* is ${timeText}. Don't miss it!`,
      },
    },
    { type: "divider" },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: daysLeft <= 1 ? "Complete now :zap:" : "Let's do it :muscle:", emoji: true },
          style: "primary",
          action_id: actionId,
          value: actionValue,
        },
      ],
    },
  ];
}
```

**Step 2: Add `buildOverdueNotice` function**

```typescript
// ---------------------------------------------------------------------------
//  Overdue notice (past deadline, still open)
// ---------------------------------------------------------------------------
export function buildOverdueNotice(
  userName: string,
  itemName: string,
  actionValue: string,
  actionId: string,
) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:warning: Hey ${userName}, your *${itemName}* is now *overdue*.\n\nPlease complete it as soon as possible — your team is counting on your input.`,
      },
    },
    { type: "divider" },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Submit now :rotating_light:", emoji: true },
          style: "primary",
          action_id: actionId,
          value: actionValue,
        },
      ],
    },
  ];
}
```

**Step 3: Add `buildManagerDeadlineAlert` function**

```typescript
// ---------------------------------------------------------------------------
//  Manager deadline alert (consolidated list of direct reports)
// ---------------------------------------------------------------------------
export function buildManagerDeadlineAlert(
  mgrName: string,
  reports: { name: string; itemName: string; status: string }[],
  isOverdue: boolean,
) {
  const header = isOverdue
    ? `:warning: Hey ${mgrName}, some of your direct reports have *overdue* reviews:`
    : `:wave: Hey ${mgrName}, some of your direct reports haven't completed their reviews yet — the deadline is *tomorrow*:`;

  const lines = reports.map(
    (r) => `• *${r.name}* — ${r.itemName}`,
  );

  const footer = isOverdue
    ? "You may want to follow up with them directly."
    : "A quick nudge might help them get it done on time.";

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${header}\n\n${lines.join("\n")}\n\n${footer}`,
      },
    },
    {
      type: "context",
      elements: [
        { type: "mrkdwn", text: "Automated alert from Nami." },
      ],
    },
  ];
}
```

**Step 4: Update exports**

Add the three new functions to the imports in `nami-bot/index.ts` (line 8-15):

```typescript
import {
  buildSelfReviewOpening,
  buildManagerReviewOpening,
  buildUpwardFeedbackOpening,
  buildSurveyOpening,
  buildReminderMessage,
  buildManagerEscalation,
  buildFinalWarning,
  buildDeadlineReminder,    // NEW
  buildOverdueNotice,       // NEW
  buildManagerDeadlineAlert, // NEW
} from "../_shared/nami-blocks.ts";
```

**Step 5: Commit**

```bash
git add supabase/functions/_shared/nami-blocks.ts supabase/functions/nami-bot/index.ts
git commit -m "feat(nami): add deadline reminder and manager alert block builders"
```

---

### Task 2: Rewrite `processAssignmentReminder()` with Deadline-Anchored Logic

**Files:**
- Modify: `supabase/functions/nami-bot/index.ts` (lines 781-993)

**Step 1: Replace `processAssignmentReminder` function**

The new logic checks `daysUntilDeadline` and sends the appropriate event type if it hasn't been sent yet (checked via `notification_log` dedup). No more counting reminders or checking `daysSinceLast`.

```typescript
async function processAssignmentReminder(
  params: AssignmentReminderParams,
): Promise<{ sent: number; skipped: number }> {
  const {
    botToken,
    workspaceId,
    targetUser,
    refPrefix,
    itemName,
    daysLeft,
    now,
    actionId,
    actionValue,
    cycle,
  } = params;

  let sent = 0;
  let skipped = 0;

  // Determine which events should have been sent by now
  const eventsToCheck: { eventType: string; daysThreshold: number }[] = [
    { eventType: "nami_reminder_7d", daysThreshold: 7 },
    { eventType: "nami_reminder_3d", daysThreshold: 3 },
    { eventType: "nami_reminder_1d", daysThreshold: 1 },
    { eventType: "nami_overdue", daysThreshold: -1 }, // 1 day AFTER deadline
  ];

  for (const { eventType, daysThreshold } of eventsToCheck) {
    // Should this event have fired by now?
    const shouldFire = daysThreshold >= 0
      ? daysLeft <= daysThreshold    // pre-deadline: fire when daysLeft <= threshold
      : daysLeft < daysThreshold;    // post-deadline: fire when overdue by 1+ day

    if (!shouldFire) continue;

    // Try to log (dedup check)
    const canSend = await logNotification(
      workspaceId,
      targetUser.id,
      eventType,
      refPrefix,
    );
    if (!canSend) continue; // already sent

    // Build the appropriate message
    let blocks: any[];
    let text: string;

    if (eventType === "nami_overdue") {
      blocks = buildOverdueNotice(
        targetUser.slack_name || "there",
        itemName,
        actionValue,
        actionId,
      );
      text = `Overdue: ${itemName}`;
    } else {
      const daysNum = eventType === "nami_reminder_7d" ? 7
        : eventType === "nami_reminder_3d" ? 3 : 1;
      blocks = buildDeadlineReminder(
        targetUser.slack_name || "there",
        itemName,
        daysNum,
        actionValue,
        actionId,
      );
      text = `Reminder: ${itemName} — ${daysNum} day${daysNum > 1 ? "s" : ""} left`;
    }

    const ok = await sendSlackBlocks(
      botToken,
      targetUser.slack_user_id,
      text,
      blocks,
    );
    if (ok) {
      sent++;
    } else {
      await rollbackNotification(workspaceId, targetUser.id, eventType, refPrefix);
      skipped++;
    }
  }

  return { sent, skipped };
}
```

**Step 2: Remove the `if (daysLeft < 0) continue;` line in `handleReminders()`**

This is at line ~600. The old code skipped overdue cycles entirely. Now we need to process them so the `nami_overdue` event can fire. Change:

```typescript
// OLD: Skip if deadline already passed
if (daysLeft < 0) continue;
```

to:

```typescript
// Allow overdue cycles to be processed (for overdue notifications)
// Only skip if cycle deadline is very old (> 30 days overdue = stale)
if (daysLeft < -30) continue;
```

**Step 3: Commit**

```bash
git add supabase/functions/nami-bot/index.ts
git commit -m "feat(nami): replace reminder ladder with deadline-anchored reminders"
```

---

### Task 3: Add Consolidated Manager Deadline Alerts

**Files:**
- Modify: `supabase/functions/nami-bot/index.ts`

**Step 1: Add manager grouping logic at the end of `handleReminders()` Part 1**

After the existing per-assignment loop (line ~696, before Part 2: Survey reminders), add logic to group outstanding assignments by manager and send consolidated DMs.

```typescript
    // ── Manager deadline alerts (consolidated) ──
    // Group outstanding assignments by manager for 1d-warning and overdue alerts
    if (daysLeft <= 1 || daysLeft < 0) {
      const mgrMap = new Map<string, {
        mgrUser: any;
        reports: { name: string; itemName: string; status: string }[];
      }>();

      for (const a of assignments) {
        if (a.status === "completed") continue;

        // For standard assignments: the employee's manager
        if (a.assignment_type === "standard") {
          const emp = (a as any).employee;
          const mgrId = emp?.manager_id;
          if (!mgrId || !emp?.slack_name) continue;

          if (!mgrMap.has(mgrId)) {
            mgrMap.set(mgrId, { mgrUser: null, reports: [] });
          }
          const entry = mgrMap.get(mgrId)!;

          // Check if self-review is incomplete
          const selfRef = `self_${a.id}`;
          const { data: selfResp } = await supabase
            .from("review_responses")
            .select("id")
            .eq("assignment_id", a.id)
            .eq("reviewer_role", "self")
            .limit(1);

          if (!selfResp?.length) {
            entry.reports.push({
              name: emp.slack_name,
              itemName: `self-review for ${cycle.name}`,
              status: daysLeft < 0 ? "overdue" : "due tomorrow",
            });
          }
        }

        // For upward assignments: the reviewer's manager
        if (a.assignment_type === "upward") {
          const reviewer = (a as any).reviewer;
          const mgrId = reviewer?.manager_id;
          if (!mgrId || !reviewer?.slack_name) continue;

          if (!mgrMap.has(mgrId)) {
            mgrMap.set(mgrId, { mgrUser: null, reports: [] });
          }
          mgrMap.get(mgrId)!.reports.push({
            name: reviewer.slack_name,
            itemName: `upward feedback for ${cycle.name}`,
            status: daysLeft < 0 ? "overdue" : "due tomorrow",
          });
        }
      }

      // Fetch manager user data and send consolidated DMs
      for (const [mgrId, { reports }] of mgrMap) {
        if (reports.length === 0) continue;

        const isOverdue = daysLeft < 0;
        const eventType = isOverdue ? "nami_mgr_overdue" : "nami_mgr_warning";
        const refId = `mgr_alert_${cycle.id}_${isOverdue ? "overdue" : "warning"}`;

        const canSend = await logNotification(workspaceId, mgrId, eventType, refId);
        if (!canSend) continue;

        const { data: mgrUser } = await supabase
          .from("users")
          .select("id, slack_user_id, slack_name")
          .eq("id", mgrId)
          .single();

        if (!mgrUser?.slack_user_id) {
          await rollbackNotification(workspaceId, mgrId, eventType, refId);
          continue;
        }

        const blocks = buildManagerDeadlineAlert(
          mgrUser.slack_name || "there",
          reports,
          isOverdue,
        );
        const ok = await sendSlackBlocks(
          botToken,
          mgrUser.slack_user_id,
          isOverdue
            ? `${reports.length} direct report(s) have overdue reviews`
            : `${reports.length} direct report(s) have reviews due tomorrow`,
          blocks,
        );
        if (ok) {
          sent++;
        } else {
          await rollbackNotification(workspaceId, mgrId, eventType, refId);
        }
      }
    }
```

**Step 2: Remove the old per-assignment manager escalation**

In the new `processAssignmentReminder()`, we no longer need the individual manager escalation logic (the old `nami_escalation_manager` and `nami_final_warning` to manager code). The new function only handles employee DMs. Manager alerts are now handled by the consolidated logic above.

**Step 3: Commit**

```bash
git add supabase/functions/nami-bot/index.ts
git commit -m "feat(nami): add consolidated manager deadline alerts"
```

---

### Task 4: Deploy Edge Function and Verify

**Step 1: Deploy the updated nami-bot function**

```bash
supabase functions deploy nami-bot --no-verify-jwt
```

Or use the Supabase MCP tool to deploy.

**Step 2: Deploy the updated shared module**

The `_shared/nami-blocks.ts` is imported by `nami-bot` — it deploys automatically with the function.

**Step 3: Test by invoking manually**

```bash
curl -X POST https://zhfvxfvmdlpdfgxrwtdn.supabase.co/functions/v1/nami-bot \
  -H "Authorization: Bearer <CRON_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"action": "run_reminders"}'
```

Verify in the Supabase edge function logs that:
- No errors
- Correct event types being logged
- DMs sent to the right users

**Step 4: Commit any fixes**

```bash
git add -A supabase/functions/
git commit -m "fix(nami): post-deploy adjustments"
```

---

## Summary

| Task | What Changes | Files |
|------|-------------|-------|
| 1 | New Block Kit builders (deadline reminder, overdue, manager alert) | `_shared/nami-blocks.ts`, `nami-bot/index.ts` (imports) |
| 2 | Replace reminder ladder with deadline-anchored logic | `nami-bot/index.ts` (`processAssignmentReminder`) |
| 3 | Consolidated manager DMs | `nami-bot/index.ts` (`handleReminders`) |
| 4 | Deploy and verify | Edge function deployment |
