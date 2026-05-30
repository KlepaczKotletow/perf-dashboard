# Slack App Directory / Marketplace listing — ready-to-submit draft

Companion to [`2026-05-30-seo-ai-visibility.md`](2026-05-30-seo-ai-visibility.md)
and NEW-22 in the launch-readiness supplement. The Marketplace is the highest-
intent discovery channel for a Slack-native product **and** the path to Slack's
own app review — i.e. it serves both halves of the visibility goal. Review takes
~2–4 weeks, so submit early.

**Good news — the usual HR-bot blocker is already handled.** Slack routinely
rejects HR bots employees can't mute. Nami already ships this: snooze buttons
(4h / 24h / until-done) on every reminder DM (`slack-interactivity` ~3622–3683),
plus an App Home panel with digest / critical-only modes and a clear-snooze
control (`slack-events` ~257–325) — all honored by the send path. A literal
`/nami pause` slash command is **optional, not a prerequisite.**

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

The app's **actual** scopes — source of truth: `src/lib/slack-scopes.ts` and
`supabase/functions/_shared/slack-scopes.ts` (kept in lockstep with the
`slack-oauth` validator). Provide a justification for **every** scope; missing
*or unused* scopes are a common rejection cause.

**Bot scopes**

| Scope | Why Nami needs it |
|---|---|
| `commands` | Slash commands (`/kudos`). User mute is also available via DM buttons + App Home. |
| `chat:write` | Send review prompts, check-ins, survey questions, and reminders as DMs. |
| `im:write` | Open the DM channel with each employee to deliver their review/survey. |
| `im:history` | Read the user's replies *within Nami's own DM thread* to advance the guided flow. |
| `im:read` | Detect the Nami DM channel for each user. |
| `app_mentions:read` | Respond when a user @-mentions the bot. |
| `users:read` | Map Slack users to employees; show names/avatars in the dashboard. |
| `users:read.email` | Match Slack accounts to imported team rosters (CSV uses email). |
| `team:read` | Read the workspace name at install to label the workspace in the dashboard (`slack-oauth` stores `team_name`). |
| `channels:read` | ⚠️ **No code found using this** — confirm a real feature needs it, or remove it from the manifest before submitting. |
| `reactions:read` | ⚠️ **No code found using this** (e.g. reaction-based kudos isn't wired) — confirm a real use, or remove it. |

**User scopes** (Sign in with Slack)

| Scope | Why Nami needs it |
|---|---|
| `identity.basic` | Authenticate the signing-in user to the web dashboard (`users.identity` / `openid.connect`). |
| `identity.email` | Match the signed-in user to their employee record by email. |

Lead with data-minimization in the review notes: Nami reads only its own DM
threads, never general channel content; no message content is used for ads or
model training (see Privacy + `llms-full.txt`).

> **Resolve the two ⚠️ scopes before you submit.** `channels:read` and
> `reactions:read` are in the manifest but I found no code using them. Slack
> reviewers push back hard on unused scopes. Either wire the feature that needs
> them or drop them from the Slack app manifest **and** from `slack-scopes.ts`
> (+ the `slack-oauth` validator) first — fewer scopes also means a faster review
> and a less scary install screen for prospects.

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

- [x] Per-user DM opt-out shipped — snooze buttons + App Home modes (already live)
- [x] Privacy, Terms, Support, Security URLs live and accurate (already deployed)
- [ ] **Resolve unused scopes `channels:read` / `reactions:read`** — justify or remove
- [ ] Scope list (11 bot + 2 user) matches the manifest, each justified (table above)
- [ ] Screenshots captured (list above)
- [ ] App icon 512×512 PNG
- [ ] Install flow works from a fresh workspace end-to-end (the critical path —
      test with a real click, per the Slack-outage post-mortem)
- [ ] Data-handling answers ready (where data lives: EU/Ireland eu-west-1; no
      training on customer data; DM-only message access)
