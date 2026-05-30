# Slack App Directory / Marketplace listing — ready-to-submit draft

Companion to [`2026-05-30-seo-ai-visibility.md`](2026-05-30-seo-ai-visibility.md)
and NEW-22 in the launch-readiness supplement. The Marketplace is the highest-
intent discovery channel for a Slack-native product **and** the path to Slack's
own app review — i.e. it serves both halves of the visibility goal. Review takes
~2–4 weeks, so submit early.

**Prerequisite before you submit:** build `/nami pause` (NEW-8 — per-user DM
opt-out). Slack routinely rejects HR bots that employees can't mute. Everything
else below is ready.

Submit at https://api.slack.com/apps → your app → **Manage Distribution →
Slack Marketplace**.

---

## Listing copy (paste-ready, edit to taste)

**App name:** Nami

**Short description** (≤ 140 chars):
> Performance reviews, OKRs, and pulse surveys your team actually completes —
> because they happen right inside Slack.

**Long description:**
> Nami is performance management that lives in Slack. Instead of nagging your team
> to log into yet another HR tool, Nami runs 360° reviews, goal and OKR check-ins,
> pulse surveys, and continuous feedback as friendly DM conversations with a bot —
> with a full web dashboard at namihr.com for managers and HR.
>
> Why teams switch to Nami:
> • **Higher completion.** Reviews happen in the DM thread employees already read,
>   not behind a separate login. Nami nudges only the people who haven't finished.
> • **Everything included, one price.** 360° reviews, OKRs, pulse surveys & eNPS,
>   8 pre-built competency frameworks, 9-box calibration, analytics, and an audit
>   log — $5/user/month, free for teams of 10 or fewer.
> • **Set up in minutes.** Install with Slack OAuth, import your team, pick a
>   template, launch your first cycle. No implementation project.
> • **Private by design.** Upward feedback is hidden from managers until they
>   submit their own review; survey responses are anonymous and aggregated —
>   enforced at the database layer.
>
> Built for people-ops, HR, and managers at 10–500 person companies who live in
> Slack.

**Categories:** HR / Team Culture (primary), Productivity
**Support URL:** https://namihr.com/support
**Privacy policy:** https://namihr.com/privacy
**Terms:** https://namihr.com/terms
**Security:** https://namihr.com/security
**Pricing:** https://namihr.com/pricing

---

## OAuth scopes + justification (Slack requires a reason per scope)

These are the scopes the app currently requests (from `llms-full.txt` /
`slack-oauth`). Verify against the live app manifest before submitting.

| Scope | Why Nami needs it |
|---|---|
| `commands` | Slash commands (`/kudos`, and `/nami pause` once shipped). |
| `chat:write` | Send review prompts, check-ins, survey questions, and reminders as DMs. |
| `im:write` | Open the DM channel with each employee to deliver their review/survey. |
| `im:history` | Read the user's replies *within Nami's own DM thread* to advance the guided flow. |
| `im:read` | Detect the Nami DM channel for each user. |
| `app_mentions:read` | Respond when a user @-mentions the bot. |
| `users:read` | Map Slack users to employees; show names/avatars in the dashboard. |
| `users:read.email` | Match Slack accounts to imported team rosters (CSV uses email). |

Lead with data-minimization in the review notes: Nami reads only its own DM
threads, never general channel content; no message content is used for ads or
model training (see Privacy + `llms-full.txt`).

---

## Screenshots / assets you need to capture (Slack requires these)

Slack wants 3–5 screenshots (1600×1000 recommended) + an app icon. Capture:
1. A review prompt as a Slack DM from the Nami bot.
2. The App Home / Home Tab.
3. The dashboard overview (workspace health) — `namihr.com/dashboard`.
4. A competency matrix / 9-box calibration grid.
5. Analytics (completion rates / heatmap).

Icon: `public/nami-logo.svg` exists — export a 512×512 PNG on a solid background.

---

## Review-readiness checklist

- [ ] `/nami pause` per-user opt-out shipped (NEW-8) — **blocker**
- [ ] Privacy, Terms, Support, Security URLs live and accurate ✓ (already deployed)
- [ ] Scope list matches the manifest and each has a justification (above)
- [ ] Screenshots captured (list above)
- [ ] App icon 512×512 PNG
- [ ] Install flow works from a fresh workspace end-to-end (the critical path —
      test with a real click, per the Slack-outage post-mortem)
- [ ] Data-handling answers ready (where data lives: EU/Ireland eu-west-1; no
      training on customer data; DM-only message access)
