# Landing Page Rebuild — Design Document
*2026-03-19*

## Goal

Rebuild `src/app/page.tsx` to accurately represent what Perf actually is today: a full-stack performance management platform (reviews + goals + competency analytics), not just a "Slack bot that improves completion rates." Slack remains a key differentiator but is no longer the headline — it's the delivery mechanism for a serious platform.

Add realistic JSX UI mockups for each feature section (no real screenshots, since auth is required — build faithful pixel-accurate recreations of the actual UI using Tailwind + inline styles, matching the real app's components: cards, badges, progress bars, heatmap table, goal rings, etc.).

Add persuasive, specific copy explaining *why* each feature is better than alternatives.

No functional changes. No auth changes. Only `src/app/page.tsx`.

---

## Positioning

**Before:** "Reviews people actually complete" → Slack-completion angle
**After:** "The performance platform your team will actually use" → full platform angle, Slack as differentiator

**Target buyer:** HR leaders, VPs of Engineering, founders with 20–200 people who are tired of Lattice/Culture Amp complexity and spreadsheets.

**Core promise:** One place for reviews, goals, and competency data — delivered through Slack so people actually engage.

---

## Page Structure

### 1. Header (minor update)
- Same sticky translucent bar
- Nav: Features · Goals · Analytics · Pricing · Sign in · Add to Slack

### 2. Hero
**Headline:** "The performance platform your team will actually use"
**Subhead:** 2–3 sentences covering: 360 reviews via Slack DMs, goal tracking, competency analytics — all in one place. No new logins. No forms nobody opens.
**Badge:** "Reviews · Goals · Analytics · All in Slack"
**CTA buttons:** "Add to Slack — free" + "Sign in with Slack"
**Right side mockup:** Analytics overview dashboard — show the KPI tiles (Overall Rating, Completion Rate, Participants, Active Cycles) + a horizontal bar chart snippet (competency ratings). This signals "this is a data-rich platform" immediately.

### 3. Feature Spotlight 1 — Reviews
**Headline:** "360° reviews with 95%+ completion — because they happen in Slack"
**Why it's better copy (3–4 bullets):**
- Perf sends review requests as Slack DMs. Your team responds in the thread — no new tab, no new login, no friction.
- Multi-rater: self-assessment, manager review, peer reviews, and upward feedback — all in one cycle.
- Automated assignments based on reporting lines. Perf handles reminders, deadlines, and collection — you just read the results.
- Calibration built in: after collection, HR uses the 9-box grid to align grades before releasing results.
**Mockup (right side):** The existing Slack DM conversation mockup — keep it, it's well-crafted and accurate.

### 4. Feature Spotlight 2 — Goals
**Headline:** "Goals your whole team can see — and actually track"
**Why it's better copy (3–4 bullets):**
- Create OKR-style goals for individuals or teams. Each goal has an owner, a deadline, and a live tracking status: On Track, At Risk, Delayed, or Achieved.
- Goals are visible to managers, so 1:1s have context. No more "what were you working on this quarter?" at review time.
- Goals roll into analytics — see what percentage of the org is on track at a glance.
- When a review cycle opens, historical goal progress is right there. Ratings reflect real work, not impressions.
**Mockup (left side):** A goals list UI — show 3–4 goal rows with GoalRing SVG indicators (circular progress), status badges (On Track in green, At Risk in amber, Delayed in red), owner avatars, and a progress percentage. Match the real app's card+badge style.

### 5. Feature Spotlight 3 — Analytics
**Headline:** "Analytics that tell you something — down to role, level, and tenure"
**Why it's better copy (3–4 bullets):**
- See overall ratings, completion rates, and participant counts filtered by cycle, department, or function — in real time.
- The Competency Heatmap shows which skills are strong and which need development, broken down by role, department, seniority level, or tenure. One table, zero spreadsheets.
- Performance Ranking table shows every employee's average rating with a tier badge (Exceptional / Strong / Solid / Needs Dev) — useful for calibration, promotions, and headcount decisions.
- Cross-cycle trend charts show whether your org is improving cycle over cycle — not just a snapshot.
**Mockup (right side):** Two stacked mini-mockups:
  1. Top: the Competency Heatmap table — show 3 competencies × 3 groups (e.g. IC / Manager / Director) with colored cells (emerald for ≥4.5, primary/5 for ≥3.5, amber for ≥2.5)
  2. Bottom: 3-row Performance Ranking snippet — name, function, avg rating bar, tier badge

### 6. How It Works (3 steps — lightly refreshed copy)
1. Add Perf to Slack (60 seconds)
2. Sync your team + define competencies
3. Launch a cycle — Perf handles the rest

### 7. Stats Strip (updated)
- 95%+ avg review completion rate
- < 2 min to complete a peer review via Slack
- 1 day from install to first live cycle

### 8. Pricing (unchanged)

### 9. CTA (updated headline to match new positioning)
"Ready to run performance reviews that people actually complete — and analytics that actually help?"

### 10. Footer (unchanged)

---

## Mockup Fidelity Requirements

All mockups must be built in JSX using Tailwind CSS only (no images). They should match the real app's visual language:
- Cards: `rounded-2xl border border-border/60 bg-card shadow-sm`
- Badges: colored `text-xs` badges with semantic colors (emerald=good, amber=at risk, red=low)
- Heatmap cells: `bg-emerald-50` / `bg-primary/5` / `bg-amber-50` / `bg-red-50` with `font-semibold tabular-nums` ratings
- Goal rings: SVG circles with stroke-dasharray representing completion %, colored by status
- Bar charts: simple `div` height bars or horizontal progress bars — no recharts dependency on landing page
- Text sizes follow the existing landing page pattern (11px labels, 12px body, 14-15px descriptions)

---

## Copy Tone

- Direct, confident, specific — not vague ("powerful analytics") but concrete ("see ratings by role, department, seniority, or tenure in one heatmap")
- Respect the buyer's intelligence — they've seen Lattice, Culture Amp, 15Five
- Benefits > features: "no more spreadsheet calibration" not "9-box calibration grid available"
- Short paragraphs, bullet points in spotlight sections

---

## Files to Change

- **Modify:** `src/app/page.tsx` — full rewrite of JSX

No other files need changing. CSS variables, fonts, and layout primitives are already correct.

---

## Constraints

- Keep all Slack OAuth URLs (addToSlackUrl, signInWithSlackUrl) exactly as-is
- Keep ScrollReveal component usage
- Keep existing header, footer, stats strip, pricing, CTA structure
- No new npm packages — mockups are pure JSX/Tailwind
- Keep mobile responsiveness (all mockups hidden on mobile or simplified)
