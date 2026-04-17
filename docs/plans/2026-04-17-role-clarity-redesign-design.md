# Role-Clarity Redesign — Design

**Date:** 2026-04-17
**Status:** Approved. Ready for implementation plan.
**Goal:** Remove role conflation across the dashboard by restructuring the sidebar, adding a page-level role header, redesigning Home, and implementing a proper goal-permission matrix tied to Supabase RLS.

Filter values: clarity → friendliness → ease → completeness.

---

## Guiding principle

**The sidebar section = the hat you're wearing.** Every page belongs unambiguously to one of three contexts: *My Work* (employee), *My Team* (manager), *Manage* (HR/admin). Role conflation — where a single page blends personal + team + org data — is eliminated. Page headers reinforce the hat on every screen as a second safety net.

Nobody is "just a manager" or "just an admin." A manager is an employee who happens to manage a team; an HR admin is an employee who also runs the workspace. The hat model lets a person switch contexts explicitly while retaining every capability they need.

---

## Section 1 — Sidebar restructure

### Exact new structure

```
━━ MY WORK ━━━━━━━━━━━━━━━━━━━━━  always visible
  🏠 Home                    /dashboard
  📋 My Performance          /dashboard/performance
  🚩 My Goals                /dashboard/goals              ← tabs: Me | Company
  💬 My Kudos                /dashboard/feedback           ← tabs: Received | Sent

━━ MY TEAM ━━━━━━━━━━━━━━━━━━━━━  visible if hasDirectReports
  👥 Team Overview           /dashboard/my-team
  📝 Team Reviews            /dashboard/reviews
  🎯 Team Goals              /dashboard/goals?tab=team     ← same Goals page, team tab

━━ MANAGE ━━━━━━━━━━━━━━━━━━━━━━  visible if admin or hr
  🗓️ Cycles                  /dashboard/cycles
  📇 Directory               /dashboard/team               (renamed from "My Team")
  🧾 Surveys                 /dashboard/surveys
  🧩 Templates               /dashboard/templates
  📊 Analytics               /dashboard/analytics
  🏢 Functions               /dashboard/admin/functions
  ⚙️  Settings                /dashboard/settings
  💳 Billing                 /dashboard/settings/billing
  📜 Audit log               /dashboard/admin/audit        (already exists)

  ❓ Help                     /dashboard/help               (always at bottom)
```

### Key changes from today

| Before | After | Why |
|---|---|---|
| "Performance" | "My Performance" | "My" prefix makes the hat unambiguous |
| "Goals" | "My Goals" under MY WORK + "Team Goals" under MY TEAM | Same page, different tab/filter per section |
| "Kudos" | "My Kudos" | Reinforces: this is your feedback |
| "My Team" (in team section) | "Team Overview" | "My Team" conflicts with the personal "My" prefix; this is a team dashboard |
| "My Team" (nowhere for admin-roster) | Renamed to "Directory" under MANAGE | The admin roster-manager is a different concept from a manager's team |
| "Functions" label | Kept (users know it) | Rename would create confusion; intent is clear |
| No audit log link | Added under MANAGE | We built it in Phase 3 but didn't add nav |

### "My Team" vs "Directory" disambiguation

Today both are called "my team" in conversation, and the URL `/dashboard/team` hosts the admin roster, not the manager's team view. That's why HR admins get confused.

New convention:
- **Team Overview** (`/dashboard/my-team`) = a *manager's* view of their own direct reports.
- **Directory** (`/dashboard/team`) = an *admin's* view of the entire workspace roster.

Both URLs already exist; we just rename the sidebar labels and restructure into the correct sections.

---

## Section 2 — Page-level role header (the breadcrumb system)

Every dashboard page renders a new `<PageHeader>` component at the top. It carries three pieces of information:

1. **Hat chip** — coloured pill showing which section: `My Work` / `My Team` / `Manage`. Matches the sidebar section the page belongs to.
2. **Page title** — the large heading.
3. **Optional subtitle** — context like "Q1 2026" or a person's name.

```
┌─────────────────────────────────────────────────┐
│  [My Work]   Goals                              │
│              Q1 2026                            │
└─────────────────────────────────────────────────┘
```

For team-context pages:
```
┌─────────────────────────────────────────────────┐
│  [My Team]   Sarah Chen                         │
│              Review · Q1 2026                   │
└─────────────────────────────────────────────────┘
```

For admin pages:
```
┌─────────────────────────────────────────────────┐
│  [Manage]   Cycles                              │
│             3 active · 1 in calibration         │
└─────────────────────────────────────────────────┘
```

The hat chip colours:
- `My Work` — neutral (bg-muted, subtle)
- `My Team` — blue accent (primary/10)
- `Manage` — amber accent (warn/strong) — admin actions are louder on purpose

### Component API

```tsx
<PageHeader
  hat="my-work" | "my-team" | "manage"
  title="Goals"
  subtitle="Q1 2026"          // optional
  actions={<Button>Create</Button>}  // optional right-aligned actions
/>
```

Applied to every dashboard page. That's ~25 places — worth it for the context clarity.

---

## Section 3 — Home redesign

Today's Home stacks employee widgets, manager widgets, and admin widgets in one page with unclear ordering. New Home is **three vertically-stacked sections, always in this order, each clearly labeled by role hat**:

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  [My Work]   Hey Filip                                  │
│              You have 2 pending actions                 │
└─────────────────────────────────────────────────────────┘

━━ Your next actions ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [Action card] Submit your Q1 self-review — due Friday
  [Action card] Give Sarah her promotion kudos
  [See all →]

━━ Your team needs attention ━━━━━━━━━━━━━━━━━━━━  (managers only)
  [Alert card] Marcus's review is overdue (3 days)
  [Alert card] Priya has no feedback in 90 days
  [See all →]

━━ Workspace health ━━━━━━━━━━━━━━━━━━━━━━━━━━━━  (admins only)
  [Stat] Q1 cycle: 82% complete (→ detail)
  [Stat] 3 cycles pending launch
  [Stat] 47 active goals
  [See all →]
```

### Why this order

1. **Personal first, always.** Even the CEO opens Home wanting to know what's on their own plate.
2. **Team second (if applicable).** The hat switch from "me" to "my reports" is explicit via the section heading.
3. **Workspace last (if applicable).** Admin work is deliberate; it should never pre-empt personal tasks.

A pure IC sees only section 1. A manager sees 1 + 2. An HR admin sees all three. No tabs, no role toggle, no hidden state — just stacked sections with clear labels.

### Empty states

- Section 1 empty → "You're all caught up. Good energy." + suggestions (update a goal, give kudos).
- Section 2 empty (manager) → "Your team looks good — everyone's on track this week."
- Section 3 empty (admin) → "No active cycles. Ready to launch Q2?"

Friendly, human. Not "No data found."

---

## Section 4 — Goals permission matrix (the hard part)

### Visibility matrix

| Goal scope | Who can create | Who can edit | Who can view |
|---|---|---|---|
| **individual** | owner, owner's manager, HR/admin | owner, owner's manager, HR | owner, owner's manager, HR/admin (plus public-read if `visibility='workspace'`) |
| **team** | manager of that team, HR | team manager, HR | team members, HR (plus workspace if public) |
| **company** | HR/admin | HR/admin | everyone in workspace (always public) |

### The three product decisions already approved

1. **Manager-created goals are employee-owned.** A manager who creates a goal for Sarah: Sarah becomes the owner, the goal shows a `Suggested by [Manager]` badge, and Sarah can edit/delete like any self-created goal. `suggested_by_user_id` column stores the manager who kicked it off for attribution.
2. **Company goals are public-read to everyone.** Always visible. The "Company" tab on the Goals page shows them to every user.
3. **"Company Goals" lives as a tab inside the Goals page**, not as a separate sidebar item. Simpler sidebar, less chrome.

### Goals page tab structure

```
Goals  [My Work]

  ┌─ Me ─┬─ Team ─┬─ Company ─┐     ← tabs, visible based on role
  │      │        │           │
  │  (owner=me)   (reports')   (scope=company, anyone reads)
  │
  │  [+ New goal]              ← context-aware; in "Me" it creates individual/me
  │                              in "Team" it opens a chooser (for me / for
  │                              [report] / team goal); in "Company" admins only
```

Tab visibility:
- **Me** — always.
- **Team** — only if `hasDirectReports` (mirrors sidebar logic).
- **Company** — always (everyone can read company OKRs).

Under the tab nav: goal cards with:
- Title, progress bar, metric (x/y), tracking badge
- **Alignment line** — if `parent_id` set: `Contributes to: [parent goal title]` (clickable)
- **Suggested-by badge** — if `suggested_by_user_id` set: small `💡 Suggested by Sarah (your manager)`
- Owner avatar + name

### Schema change

```sql
ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS suggested_by_user_id uuid
    REFERENCES public.users(id) ON DELETE SET NULL;
```

No backfill needed — existing goals are self-created (NULL = self-created).

### RLS policies on `goals` table

Dropping existing permissive goals policies and replacing with the matrix above. Key policies:

**SELECT policy** — visible if:
- scope = 'company' (everyone in workspace sees), OR
- caller is the owner (`employee_id = auth_user_id()`), OR
- caller manages the owner (`employee_id IN (SELECT id FROM users WHERE manager_id = auth_user_id())`), OR
- caller is admin/HR.

**INSERT policy** — allowed if:
- scope = 'individual' AND (owner = self OR caller manages owner OR caller is admin/HR), OR
- scope = 'team' AND (caller is admin/HR OR caller manages someone in that team), OR
- scope = 'company' AND caller is admin/HR.

**UPDATE policy** — same as INSERT for each scope, plus owner can always update their own individual goals.

**DELETE policy** — owner, or admin/HR, or for manager-scope goals the manager of that team.

All policies end with `workspace_id = auth_workspace_id()`.

### Enforcement layers

1. **DB-level RLS** — the authoritative gate. Cannot be bypassed from the browser.
2. **Client-side** — UI hides "Create for report" button if not a manager, hides "Team goal" if no team, hides Company-create if not admin. This is UX, not security.
3. **Error handling** — when RLS rejects an insert (42501), the UI surfaces a clear "You don't have permission to create this goal — ask your admin" instead of a generic error.

---

## Section 5 — Implementation order

Phased so each layer can be verified before the next:

1. **Migration** — add `suggested_by_user_id`, drop+replace goals RLS policies with the matrix above. Verify with `execute_sql` before touching app code.
2. **`<PageHeader>` component** — build, test in isolation, don't wire up yet.
3. **Sidebar restructure** — rename items, reorder, add Audit log link. Low-risk, purely cosmetic.
4. **Goals page refactor** — tabs (Me / Team / Company), context-aware create button, suggested-by badge rendering, alignment line.
5. **Apply `<PageHeader>` across all dashboard pages** — 25 locations, one commit per section cluster to keep diffs reviewable.
6. **Home redesign** — rebuild into three stacked sections with role-hat labels.
7. **Manual spot-check** — open each page, confirm the right hat + title renders, confirm goal permissions work.
8. **Full verification** — `npm test`, `npx tsc --noEmit`, live smoke test of /, /dashboard (→ signin), a few public routes.
9. **Commit, push, Vercel deploy** — merge to main, confirm `namihr.com` serves the new build, confirm deploy alias includes `namihr.com`.

---

## Section 6 — Risks and mitigations

| Risk | Mitigation |
|---|---|
| RLS policy regressions lock users out of their own goals | Test insert/update/select per persona before shipping; keep a rollback migration ready |
| 25 pages × `<PageHeader>` is mechanical and prone to mis-naming | Single source of truth in a `ROUTE_METADATA` constant so the hat + title are derived from pathname, not re-typed per page |
| "Company Goals" tab visible but empty freaks people out | Seed empty state with friendly copy + admin-only CTA to "Add your first company OKR" |
| Sidebar relabel confuses existing users | Include the rename in a changelog / release note; the new labels are strictly more descriptive, not ambiguous |
| Manager creates goal for report but the report never sees the badge | Include `suggested_by_user_id` in the Goals page query + render the badge prominently |

---

## Section 7 — Out of scope (for this phase)

Deliberately NOT doing:
- Tree/kanban views for goals (future polish)
- Competency radar charts on Performance page (future)
- Real-time activity feed on Home (future — needs Supabase realtime wiring)
- Bulk goal operations (create 10 at once) — future
- Starter goal templates ("Engineering IC goals") — future
- Goal approval workflow (deliberately rejected: friction + usually bypassed)

---

## Deliverables

At end of this phase:
- 1 new migration (goals RLS + `suggested_by_user_id`)
- 1 new component (`<PageHeader>`)
- 1 sidebar layout change
- 1 Goals page refactor (tabs + permission-aware create + badges)
- 1 Home page redesign (three stacked sections)
- `<PageHeader>` applied to every dashboard page (~25)
- Live on `namihr.com` after Vercel deploy

Single PR or split by implementation order above — decide in the implementation plan.
