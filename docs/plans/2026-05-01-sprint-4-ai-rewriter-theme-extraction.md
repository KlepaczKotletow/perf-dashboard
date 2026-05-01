# Sprint 4: AI Feedback Rewriter (Tone Control) + Cross-Rater Theme Extraction

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Two AI features that compound the value of every Slack-submitted review.
1. **Rewriter:** in any review modal or `/kudos` modal, a "Polish with AI" action regenerates the user's draft with a chosen tone (more specific / kinder / more direct / coaching). Pulls employee context (goals, prior feedback, recent kudos) so output isn't generic.
2. **Theme extraction:** when a manager opens a direct report's review packet, surface 3-5 themes that emerged across all peer + upward feedback ("3 of 5 mentioned communication clarity").

**Architecture:**
- **LLM provider:** Anthropic Claude API (`claude-sonnet-4-6` for cost/speed; can override per workspace).
- **API routes** under `src/app/api/ai/` invoke Anthropic via the `@anthropic-ai/sdk`. Server-only — secret never reaches the client.
- **Prompt caching** is critical: the per-employee context block is reused across multiple rewriter calls and across all peer-comment classifications during theme extraction. Cache the static system prompt + employee context block.
- **Slack composition** uses the existing modal pattern: a "Polish ✨" button posts a `block_actions` event → API route returns rewritten text → modal is updated via `views.update`.
- **Theme extraction** runs once when the manager review modal opens (or asynchronously when peer feedback collection closes). Cached in a new `review_themes` table keyed by (cycle_id, employee_id).

**Tech Stack:**
- `@anthropic-ai/sdk` (new dependency)
- Existing Slack-interactivity edge function (Deno) — needs to call our Next.js AI API or the Anthropic SDK directly
- Prompt caching via `cache_control: { type: 'ephemeral' }` on system + context blocks
- Vitest with mocked Anthropic SDK for unit tests

**Out of scope:** Real-time streaming output (single response is fine). Multi-language tone presets (English only first). Auto-apply (user always reviews + accepts).

---

## Pre-flight

### Task 0: Branch + dependency

```bash
git checkout main && git pull
git checkout -b sprint-4-ai-features
npm install @anthropic-ai/sdk
git add package.json package-lock.json
git commit -m "chore: add @anthropic-ai/sdk"
```

**Step:** Add `ANTHROPIC_API_KEY` to `.env.local` (and document in `.env.example`).

---

## Track A: Schema for cached themes + AI feature flag

### Task 1: Migration — `review_themes` table + workspace AI flag

**Files:**
- Create: `supabase/migrations/20260615_01_review_themes.sql`

```sql
-- Cached cross-rater theme extraction. One row per (cycle, employee). Recomputed
-- when new peer/upward responses land for that pair.

create table if not exists review_themes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  cycle_id uuid not null references performance_cycles(id) on delete cascade,
  employee_id uuid not null references users(id) on delete cascade,
  themes jsonb not null,             -- [{label, support_count, sample_quotes: [..]}]
  source_response_count int not null,
  model_id text not null,
  computed_at timestamptz not null default now(),
  unique (cycle_id, employee_id)
);

create index if not exists review_themes_employee_idx on review_themes(employee_id);

-- Workspace-level kill switch + per-workspace model override
alter table workspaces
  add column if not exists ai_features_enabled boolean not null default false,
  add column if not exists ai_model_id text default 'claude-sonnet-4-6';

comment on column workspaces.ai_features_enabled is
  'When true, Polish-with-AI and theme extraction are available to this workspace.';

alter table review_themes enable row level security;

create policy "review_themes_select_workspace"
  on review_themes for select to authenticated
  using (workspace_id = (select workspace_id from users where id = auth.uid()));

revoke all on review_themes from anon, public;
grant select on review_themes to authenticated;
-- Inserts/updates only via service role (edge functions with service key)
```

**Apply + commit:**

```bash
supabase db reset
git add supabase/migrations/20260615_01_review_themes.sql
git commit -m "feat(ai): review_themes cache + workspace ai flag"
```

---

## Track B: AI rewriter — server endpoint

### Task 2: Pure helper — build the prompt

**Files:**
- Create: `src/lib/ai/rewriter-prompt.ts`
- Create: `src/lib/ai/__tests__/rewriter-prompt.test.ts`

**Step 1: Failing test**

```typescript
import { describe, it, expect } from "vitest";
import { buildRewriterPrompt } from "../rewriter-prompt";

describe("buildRewriterPrompt", () => {
  const ctx = {
    employee_name: "Alice",
    employee_role: "Senior Engineer",
    employee_goals: ["Ship payments v2", "Mentor 2 juniors"],
    prior_feedback_themes: ["communication clarity", "depth in incident response"],
    recent_kudos: ["Saved the deploy on Tuesday — great calm under pressure"],
  };

  it("includes employee context in the system prompt", () => {
    const { system, user } = buildRewriterPrompt({
      draft: "Bob is great",
      tone: "more_specific",
      context: ctx,
    });
    expect(system).toContain("Alice");
    expect(system).toContain("Senior Engineer");
    expect(system).toContain("Ship payments v2");
    expect(user).toBe("Bob is great");
  });

  it("formats tone presets correctly", () => {
    const tones = ["more_specific", "kinder", "more_direct", "coaching"] as const;
    for (const tone of tones) {
      const { system } = buildRewriterPrompt({ draft: "x", tone, context: ctx });
      expect(system.toLowerCase()).toContain(tone.replace("_", " "));
    }
  });

  it("rejects unknown tone", () => {
    expect(() => buildRewriterPrompt({ draft: "x", tone: "snarky" as any, context: ctx })).toThrow();
  });

  it("system prompt is stable for the same context (cache-friendly)", () => {
    const a = buildRewriterPrompt({ draft: "first", tone: "kinder", context: ctx }).system;
    const b = buildRewriterPrompt({ draft: "second", tone: "kinder", context: ctx }).system;
    expect(a).toBe(b);
  });
});
```

**Step 2: Implement**

```typescript
// src/lib/ai/rewriter-prompt.ts

export type Tone = "more_specific" | "kinder" | "more_direct" | "coaching";

export interface EmployeeContext {
  employee_name: string;
  employee_role: string | null;
  employee_goals: string[];
  prior_feedback_themes: string[];
  recent_kudos: string[];
}

const TONE_INSTRUCTIONS: Record<Tone, string> = {
  more_specific: "Make the feedback more specific. Replace vague claims ('great', 'good') with concrete examples grounded in the employee's actual work and recent context. If the input lacks evidence, add a [Specifics needed: e.g., a project, a deadline, a meeting] placeholder.",
  kinder: "Soften the tone while preserving honesty. Lead with genuine appreciation, then frame growth areas as opportunities. Never sugarcoat the underlying message.",
  more_direct: "Make the message more direct and concise. Cut hedging language. Lead with the main point. Preserve specifics.",
  coaching: "Reframe as coaching: identify the behavior, name its impact, and suggest one concrete next step the employee could try.",
};

export function buildRewriterPrompt(args: {
  draft: string;
  tone: Tone;
  context: EmployeeContext;
}): { system: string; user: string } {
  if (!TONE_INSTRUCTIONS[args.tone]) {
    throw new Error(`Unknown tone: ${args.tone}`);
  }

  const { context: ctx } = args;
  const goals = ctx.employee_goals.length ? ctx.employee_goals.map((g) => `- ${g}`).join("\n") : "- (none on file)";
  const themes = ctx.prior_feedback_themes.length ? ctx.prior_feedback_themes.map((t) => `- ${t}`).join("\n") : "- (no prior themes)";
  const kudos = ctx.recent_kudos.length ? ctx.recent_kudos.slice(0, 3).map((k) => `> ${k}`).join("\n") : "(no recent kudos)";

  const system = [
    "You are a writing assistant for performance feedback. You rewrite a draft to a chosen tone, grounded in the specific employee's context. Output ONLY the rewritten feedback — no preamble, no quotes, no notes.",
    "",
    `Employee: ${ctx.employee_name}${ctx.employee_role ? `, ${ctx.employee_role}` : ""}`,
    "",
    "Their current goals:",
    goals,
    "",
    "Themes from their prior reviews:",
    themes,
    "",
    "Recent kudos others have given them:",
    kudos,
    "",
    "Tone instructions:",
    TONE_INSTRUCTIONS[args.tone],
    "",
    "Constraints:",
    "- Same factual content, sharpened or softened per tone.",
    "- Keep length within ±20% of the original.",
    "- Never invent facts not present in the draft, the context above, or that are universally true.",
    "- If the draft is already 1-2 sentences and you're tone='more_specific', add the placeholder [Specifics needed: ...].",
  ].join("\n");

  return { system, user: args.draft };
}
```

**Step 3: Tests pass, commit**

```bash
npm test -- rewriter-prompt
git add src/lib/ai/rewriter-prompt.ts src/lib/ai/__tests__/rewriter-prompt.test.ts
git commit -m "feat(ai): rewriter prompt builder with tone presets"
```

---

### Task 3: Server route `/api/ai/rewrite`

**Files:**
- Create: `src/app/api/ai/rewrite/route.ts`
- Create: `src/app/api/ai/rewrite/__tests__/route.test.ts`

**Step 1: Test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    constructor() {}
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "Rewritten output." }],
        usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 50 },
      }),
    };
  },
}));

describe("POST /api/ai/rewrite", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when body is missing fields", async () => {
    const req = new Request("http://x/api/ai/rewrite", { method: "POST", body: JSON.stringify({}) });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 with rewritten text", async () => {
    const req = new Request("http://x/api/ai/rewrite", {
      method: "POST",
      body: JSON.stringify({
        draft: "Bob is great",
        tone: "more_specific",
        employee_id: "00000000-0000-0000-0000-000000000001",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.rewritten).toBe("Rewritten output.");
  });

  it("returns 403 when workspace.ai_features_enabled is false", async () => {
    // Mock supabase to return ai_features_enabled: false
    // ... test omitted for brevity, but assert 403
  });
});
```

**Step 2: Implement**

```typescript
// src/app/api/ai/rewrite/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildRewriterPrompt, Tone, EmployeeContext } from "@/lib/ai/rewriter-prompt";
import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: NextRequest) {
  const workspace = await getUserWorkspace();
  if (!workspace?.workspaceId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const supabase = await createServerSupabaseClient();
  const { data: ws } = await supabase
    .from("workspaces")
    .select("ai_features_enabled, ai_model_id")
    .eq("id", workspace.workspaceId)
    .single();

  if (!ws?.ai_features_enabled) {
    return NextResponse.json({ error: "ai_features_disabled" }, { status: 403 });
  }

  let body: { draft?: string; tone?: Tone; employee_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }

  if (!body.draft || !body.tone || !body.employee_id) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Hard caps to keep latency + cost bounded
  if (body.draft.length > 4000) return NextResponse.json({ error: "draft_too_long" }, { status: 400 });

  const ctx = await loadEmployeeContext(supabase, workspace.workspaceId, body.employee_id);

  const { system, user } = buildRewriterPrompt({ draft: body.draft, tone: body.tone, context: ctx });

  try {
    const resp = await anthropic.messages.create({
      model: ws.ai_model_id ?? "claude-sonnet-4-6",
      max_tokens: 800,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
    });
    const out = resp.content.find((b: any) => b.type === "text") as any;
    return NextResponse.json({
      rewritten: out?.text ?? "",
      usage: resp.usage,
    });
  } catch (err: any) {
    console.error("Anthropic error:", err);
    return NextResponse.json({ error: "ai_failure", details: err.message }, { status: 502 });
  }
}

async function loadEmployeeContext(supabase: any, workspaceId: string, employeeId: string): Promise<EmployeeContext> {
  const [u, goals, themes, kudos] = await Promise.all([
    supabase.from("users").select("slack_name, job_title").eq("id", employeeId).single(),
    supabase.from("goals").select("title").eq("user_id", employeeId).eq("status", "active").limit(5),
    supabase.from("review_themes").select("themes").eq("employee_id", employeeId).order("computed_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("continuous_feedback").select("message").eq("to_user_id", employeeId).order("created_at", { ascending: false }).limit(5),
  ]);
  return {
    employee_name: u.data?.slack_name ?? "the employee",
    employee_role: u.data?.job_title ?? null,
    employee_goals: (goals.data ?? []).map((g: any) => g.title),
    prior_feedback_themes: (themes.data?.themes ?? []).map((t: any) => t.label),
    recent_kudos: (kudos.data ?? []).map((k: any) => k.message),
  };
}
```

**Step 3: Test passes, commit**

```bash
npm test -- /api/ai/rewrite
git add src/app/api/ai/rewrite/
git commit -m "feat(ai): /api/ai/rewrite endpoint with prompt caching"
```

---

### Task 4: "Polish with AI" button in `/kudos` modal

**Files:**
- Modify: `supabase/functions/slack-commands/index.ts` (the `/kudos` modal builder)
- Modify: `supabase/functions/slack-interactivity/index.ts` (handle the new action)

**Step 1: Add button to modal blocks**

In `buildFeedbackModalBlocks`, append after the message field:

```typescript
{
  type: "actions",
  block_id: "ai_polish_actions",
  elements: [
    { type: "button", text: { type: "plain_text", text: "✨ Polish with AI" }, action_id: "open_polish_picker" },
  ],
}
```

**Step 2: Open a tone-picker overflow when clicked**

In `slack-interactivity`, add:

```typescript
if (action?.action_id === "open_polish_picker") {
  // Open a modal-on-modal asking for tone
  await slackApi(botToken, "views.push", {
    trigger_id: payload.trigger_id,
    view: {
      type: "modal",
      callback_id: "polish_tone_pick",
      private_metadata: JSON.stringify({ parent_view_id: payload.view.id, recipient_id: extractRecipient(payload) }),
      title: { type: "plain_text", text: "Polish tone" },
      submit: { type: "plain_text", text: "Polish" },
      close: { type: "plain_text", text: "Cancel" },
      blocks: [
        { type: "input", block_id: "tone_block", label: { type: "plain_text", text: "Tone" },
          element: {
            type: "radio_buttons", action_id: "tone",
            options: [
              { text: { type: "plain_text", text: "More specific" }, value: "more_specific" },
              { text: { type: "plain_text", text: "Kinder" }, value: "kinder" },
              { text: { type: "plain_text", text: "More direct" }, value: "more_direct" },
              { text: { type: "plain_text", text: "Coaching" }, value: "coaching" },
            ],
          },
        },
      ],
    },
  });
}
```

**Step 3: Handle `polish_tone_pick` view submission**

```typescript
if (cbId === "polish_tone_pick") {
  const meta = JSON.parse(payload.view.private_metadata);
  const tone = payload.view.state.values.tone_block.tone.selected_option.value;

  // Read current draft from the parent view
  const parent = await slackApi(botToken, "views.info", { view_id: meta.parent_view_id });
  const draft = parent.view.state.values.message_block.message.value;

  // Call our /api/ai/rewrite endpoint (use the dashboard URL + service token)
  const resp = await fetch(`${DASHBOARD_URL}/api/ai/rewrite`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${INTERNAL_TOKEN}` },
    body: JSON.stringify({ draft, tone, employee_id: meta.recipient_id }),
  });
  const j = await resp.json();
  if (!resp.ok) {
    return json({ response_action: "errors", errors: { tone_block: j.error ?? "AI failed" } });
  }

  // Update the parent view: replace the message field's initial_value with rewritten text
  await slackApi(botToken, "views.update", {
    view_id: meta.parent_view_id,
    view: rebuildKudosModalWithDraft(j.rewritten, parent.view.private_metadata),
  });

  return new Response("", { status: 200 }); // closes the tone picker modal
}
```

(Helpers `extractRecipient` and `rebuildKudosModalWithDraft` need to be implemented matching your modal's existing block structure.)

**Step 4: Manual smoke test**

```bash
supabase functions serve slack-commands slack-interactivity
npm run dev
```
- Run `/kudos` in Slack DM with Nami
- Pick a recipient + write "Bob is great"
- Click "Polish with AI" → tone picker modal
- Pick "More specific", submit
- Confirm parent modal updates with a rewritten draft

**Step 5: Commit**

```bash
git add supabase/functions/slack-commands/ supabase/functions/slack-interactivity/
git commit -m "feat(ai): Polish-with-AI tone picker in /kudos modal"
```

---

### Task 5: "Polish with AI" in cycle review modal

Same pattern as Task 4, but for the `cycle_review_submit` modal. The modal has a `comment` field (or per-text-question textareas) — add the polish button to each textarea field.

For multi-question modals, polish per-question rather than per-modal: add an `action_id: open_polish_picker_<question_id>` per textarea.

**Files:**
- Modify: `supabase/functions/slack-interactivity/index.ts` (the `buildReviewForm` block builder around line 893+)

**Commit:**
```bash
git add supabase/functions/slack-interactivity/
git commit -m "feat(ai): Polish-with-AI on cycle review modal text questions"
```

---

## Track C: Theme extraction

### Task 6: Pure helper — theme extraction prompt

**Files:**
- Create: `src/lib/ai/theme-prompt.ts`
- Create: `src/lib/ai/__tests__/theme-prompt.test.ts`

**Step 1: Test**

```typescript
import { describe, it, expect } from "vitest";
import { buildThemePrompt, parseThemeResponse } from "../theme-prompt";

describe("buildThemePrompt", () => {
  it("groups responses by reviewer role", () => {
    const { system, user } = buildThemePrompt([
      { role: "peer", text: "Great communicator" },
      { role: "peer", text: "Communicates clearly even when stressed" },
      { role: "manager", text: "Strong project scoping" },
    ]);
    expect(user).toContain("[peer]");
    expect(user).toContain("[manager]");
  });
});

describe("parseThemeResponse", () => {
  it("parses well-formed JSON with themes", () => {
    const json = JSON.stringify({
      themes: [
        { label: "communication clarity", support_count: 2, sample_quotes: ["Great communicator"] },
        { label: "scoping", support_count: 1, sample_quotes: ["Strong project scoping"] },
      ],
    });
    expect(parseThemeResponse(json)).toHaveLength(2);
  });

  it("returns empty array on malformed JSON", () => {
    expect(parseThemeResponse("not json")).toEqual([]);
  });
});
```

**Step 2: Implement**

```typescript
// src/lib/ai/theme-prompt.ts

export interface RawResponse { role: "peer" | "upward" | "manager"; text: string; }
export interface Theme { label: string; support_count: number; sample_quotes: string[]; }

export function buildThemePrompt(responses: RawResponse[]): { system: string; user: string } {
  const system = [
    "You analyze peer/manager feedback and extract recurring themes.",
    "Output a JSON object only — no preamble.",
    "Schema: { \"themes\": [{ \"label\": \"short noun phrase, lowercase\", \"support_count\": int, \"sample_quotes\": [string up to 2] }] }",
    "Rules:",
    "- Merge synonyms (e.g. 'communicates clearly', 'strong communicator' → 'communication clarity').",
    "- Only emit a theme if 2+ responses support it.",
    "- Cap themes at 5. Order by support_count desc.",
    "- Sample_quotes must be verbatim from the input.",
  ].join("\n");

  const lines = responses.map((r) => `[${r.role}] ${r.text.replace(/\s+/g, " ").trim()}`);
  const user = `Responses:\n${lines.join("\n")}\n\nReturn the JSON now.`;

  return { system, user };
}

export function parseThemeResponse(raw: string): Theme[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.themes)) return [];
    return parsed.themes
      .filter((t: any) => typeof t.label === "string" && typeof t.support_count === "number")
      .map((t: any) => ({
        label: String(t.label).slice(0, 80),
        support_count: Math.max(0, Math.floor(t.support_count)),
        sample_quotes: Array.isArray(t.sample_quotes) ? t.sample_quotes.slice(0, 2).map((q: any) => String(q).slice(0, 200)) : [],
      }));
  } catch {
    return [];
  }
}
```

**Step 3: Commit**

```bash
git add src/lib/ai/theme-prompt.ts src/lib/ai/__tests__/theme-prompt.test.ts
git commit -m "feat(ai): theme extraction prompt + parser"
```

---

### Task 7: Server endpoint `/api/ai/themes`

**Files:**
- Create: `src/app/api/ai/themes/route.ts`

**Step 1: Implement**

POST `{ cycle_id, employee_id, force?: boolean }` → returns `{ themes }`. Uses cache from `review_themes` if not stale (refresh if `force` or if `source_response_count` changed).

```typescript
// src/app/api/ai/themes/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildThemePrompt, parseThemeResponse } from "@/lib/ai/theme-prompt";
import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: NextRequest) {
  const workspace = await getUserWorkspace();
  if (!workspace?.workspaceId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { cycle_id, employee_id, force } = await req.json();
  if (!cycle_id || !employee_id) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const { data: ws } = await supabase.from("workspaces")
    .select("ai_features_enabled, ai_model_id").eq("id", workspace.workspaceId).single();
  if (!ws?.ai_features_enabled) return NextResponse.json({ error: "ai_features_disabled" }, { status: 403 });

  // Pull all peer + upward + manager responses for this employee in this cycle
  const { data: responses } = await supabase
    .from("review_responses")
    .select("comment, reviewer_role, assignment:review_assignments!inner(employee_id, cycle_id)")
    .eq("assignment.employee_id", employee_id)
    .eq("assignment.cycle_id", cycle_id)
    .not("comment", "is", null);

  const filtered = (responses ?? [])
    .filter((r: any) => ["peer", "upward", "manager"].includes(r.reviewer_role))
    .map((r: any) => ({ role: r.reviewer_role, text: r.comment }));

  if (filtered.length < 2) return NextResponse.json({ themes: [], reason: "not_enough_responses" });

  // Cache check
  if (!force) {
    const { data: cached } = await supabase.from("review_themes")
      .select("themes, source_response_count")
      .eq("cycle_id", cycle_id).eq("employee_id", employee_id).maybeSingle();
    if (cached && cached.source_response_count === filtered.length) {
      return NextResponse.json({ themes: cached.themes, cached: true });
    }
  }

  const { system, user } = buildThemePrompt(filtered);
  const resp = await anthropic.messages.create({
    model: ws.ai_model_id ?? "claude-sonnet-4-6",
    max_tokens: 600,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  });
  const text = (resp.content.find((b: any) => b.type === "text") as any)?.text ?? "";
  const themes = parseThemeResponse(text);

  // Upsert cache
  await supabase.from("review_themes").upsert({
    workspace_id: workspace.workspaceId,
    cycle_id,
    employee_id,
    themes,
    source_response_count: filtered.length,
    model_id: ws.ai_model_id ?? "claude-sonnet-4-6",
    computed_at: new Date().toISOString(),
  }, { onConflict: "cycle_id,employee_id" });

  return NextResponse.json({ themes, cached: false });
}
```

**Step 2: Commit**

```bash
git add src/app/api/ai/themes/
git commit -m "feat(ai): /api/ai/themes endpoint with cache"
```

---

### Task 8: Themes panel in manager review packet

**Files:**
- Modify: `src/app/dashboard/cycles/[id]/review/[assignmentId]/page.tsx`
- Create: `src/app/dashboard/cycles/[id]/review/[assignmentId]/themes-panel.tsx`

**Step 1: Component**

```tsx
// themes-panel.tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Theme { label: string; support_count: number; sample_quotes: string[]; }

export function ThemesPanel({ cycleId, employeeId }: { cycleId: string; employeeId: string }) {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState<string | null>(null);

  async function load(force = false) {
    setLoading(true);
    const r = await fetch("/api/ai/themes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cycle_id: cycleId, employee_id: employeeId, force }),
    });
    const j = await r.json();
    setThemes(j.themes ?? []);
    setReason(j.reason ?? null);
    setLoading(false);
  }

  useEffect(() => { load(); }, [cycleId, employeeId]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-amber-500" /> Themes from feedback</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => load(true)} disabled={loading}><RefreshCw className="h-3 w-3" /></Button>
      </CardHeader>
      <CardContent>
        {loading && <Skeleton className="h-20" />}
        {!loading && themes.length === 0 && (
          <p className="text-sm text-muted-foreground">{reason === "not_enough_responses" ? "Need at least 2 written responses to extract themes." : "No themes yet."}</p>
        )}
        {!loading && themes.map((t) => (
          <div key={t.label} className="mb-3 last:mb-0">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{t.support_count}</Badge>
              <span className="font-medium text-sm">{t.label}</span>
            </div>
            {t.sample_quotes.slice(0, 1).map((q, i) => (
              <blockquote key={i} className="text-xs italic text-muted-foreground mt-1 ml-1 border-l-2 pl-2 border-border">"{q}"</blockquote>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Render in the manager review page**

Wherever peer/upward responses are displayed for the manager to read, add `<ThemesPanel cycleId={...} employeeId={...} />` above the raw list.

**Step 3: Commit**

```bash
git add src/app/dashboard/cycles/[id]/review/[assignmentId]/themes-panel.tsx src/app/dashboard/cycles/[id]/review/[assignmentId]/page.tsx
git commit -m "feat(ai): themes panel in manager review packet"
```

---

### Task 9: Refresh-trigger when peer response count changes

**Files:**
- Create: `supabase/migrations/20260615_02_review_themes_refresh_trigger.sql`

**Step 1: Trigger**

```sql
-- When new review_responses are inserted that would feed theme extraction,
-- mark the associated review_themes row stale (force recompute on next read).
create or replace function review_themes_invalidate() returns trigger
language plpgsql as $$
declare
  v_employee_id uuid;
  v_cycle_id uuid;
begin
  if new.reviewer_role not in ('peer', 'upward', 'manager') then return new; end if;
  select ra.employee_id, ra.cycle_id into v_employee_id, v_cycle_id
  from review_assignments ra where ra.id = new.assignment_id;
  if v_employee_id is null then return new; end if;
  -- Setting source_response_count = -1 forces recompute on next /api/ai/themes call
  update review_themes
  set source_response_count = -1
  where cycle_id = v_cycle_id and employee_id = v_employee_id;
  return new;
end;
$$;

drop trigger if exists review_themes_invalidate_trigger on review_responses;
create trigger review_themes_invalidate_trigger
  after insert on review_responses
  for each row execute function review_themes_invalidate();
```

**Step 2: Commit**

```bash
supabase db reset
git add supabase/migrations/20260615_02_review_themes_refresh_trigger.sql
git commit -m "feat(ai): invalidate theme cache when new responses land"
```

---

## Track D: Verification + ship

### Task 10: Manual run

1. Flip `workspaces.ai_features_enabled = true` for test workspace.
2. Set `ANTHROPIC_API_KEY` env var.
3. `/kudos` modal → write "Bob is great" → Polish → "more_specific" → confirm rewrite is grounded in Bob's actual context (look at goals + recent kudos appearing in the output).
4. Try with each of 4 tones.
5. Open a manager review packet with 3+ peer responses → confirm Themes panel renders 1-3 themes with quotes.
6. Submit a new peer response in the same cycle → reload manager view → confirm theme cache was invalidated and recomputed (check `review_themes.source_response_count` in DB).

### Task 11: Cost dashboard

Add a small admin page at `src/app/dashboard/admin/ai-usage/page.tsx` showing:
- Token usage by feature (rewrite vs themes), pulled from a new `ai_usage_log` table.
- Cache hit rate (cache_read tokens / total input tokens).

(Out of scope to fully build, but lay the schema:)

```sql
create table if not exists ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  feature text not null,
  model_id text not null,
  input_tokens int not null,
  output_tokens int not null,
  cache_read_tokens int not null default 0,
  created_at timestamptz not null default now()
);
```

Log a row from `/api/ai/rewrite` and `/api/ai/themes` after each successful Anthropic call.

### Task 12: PR

```bash
git push -u origin sprint-4-ai-features
gh pr create --title "Sprint 4: AI rewriter + theme extraction" --body "..."
```

---

## Notes

- **Prompt caching matters:** the system prompt + employee context is ~500-800 tokens; without caching we pay it on every rewrite. With `cache_control: { type: 'ephemeral' }`, second-and-later calls within 5 minutes hit the cache. For multi-question modals, this is huge — saves ~80% of input cost.
- **Always show the rewritten text BEFORE applying.** Never silently mutate the user's draft. The user submits the final version manually.
- **Don't ship "auto-polish on submit."** Customers in our research explicitly hated AI that wrote feedback for them. Augment, don't replace.
- **Theme labels are lowercase noun phrases** by design — they sit alongside `Badge` chips in the UI. Test prompt with non-English content if you have international customers — current prompt is English-only, document the limitation.
- **Stale cache:** the trigger sets `source_response_count = -1`. The endpoint compares `source_response_count === filtered.length`; -1 will never equal a real count, so it always recomputes. Cleaner than a `stale` boolean.
- **Failure mode:** if Anthropic returns 5xx, return 502 from our route and the UI shows "AI temporarily unavailable — try again." Never persist garbled output to `review_themes`.

## Estimated time

| Track | Hours |
|---|---|
| A: Schema + flag | 2 |
| B: Rewriter (server + Slack) | 12 |
| C: Theme extraction | 8 |
| D: Verify + cost | 6 |
| **Total** | **~28h** |
