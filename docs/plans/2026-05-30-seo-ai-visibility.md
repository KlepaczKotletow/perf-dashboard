# SEO & AI-visibility plan — 2026-05-30

Goal: make **namihr.com** discoverable in classic search (Google/Bing) and in AI
answer engines (ChatGPT, Claude, Perplexity, Google AI Overviews), so the first
customers find and install Nami — which is the prerequisite for Slack's own app
review / verification.

Diagnosis of "hardly any organic visitors": the technical SEO foundation was
already strong (metadata, sitemap, robots with AI-crawler allowlist, llms.txt,
JSON-LD on the home/pricing/support pages). The two real gaps were **(1) almost
no indexable content** — only ~9 thin pages, nothing targeting the queries
buyers actually type — and **(2) the site likely isn't fully in the index yet**
(no Search Console property = Google barely knows it exists). A dead URL
(`app.nami.team`) was also being fed to AI engines via llms.txt.

---

## Part A — What shipped on-site this session (code)

All in the working tree; **not yet deployed** (see "Deploy" at the bottom).

1. **Fixed the dead `app.nami.team` URL → `namihr.com`** everywhere it was cited
   as the live dashboard: landing page (`src/app/page.tsx`), `public/llms.txt`,
   `public/llms-full.txt`. It was `NXDOMAIN` — AI assistants were citing a URL
   that doesn't resolve, and prospects hit a dead end.

2. **Public guides hub** at `/guides` + `/guides/[slug]` — surfaces the 33
   existing help articles (previously auth-walled at `/dashboard/help`, invisible
   to Google) as indexable pages. Each has `TechArticle` + `BreadcrumbList`
   JSON-LD, canonical, OG tags, an "Add to Slack" CTA, and related-guide links.
   Files: `src/app/guides/`, `src/components/marketing/public-mdx-components.tsx`.

3. **Comparison / "alternative" pages** at `/compare` + `/compare/{lattice,
   15five,leapsome,culture-amp}` — target the exact high-intent queries already
   in our keyword list ("Lattice alternative", etc.) and the queries AI engines
   answer for "alternatives to X". Honest side-by-side tables, an explicit "when
   the competitor is the better fit" section, and `FAQPage` + `BreadcrumbList`
   JSON-LD. Data: `src/lib/comparisons.ts`.

4. **Wiring**: all new routes added to `sitemap.ts`; internal links added to the
   landing-page nav + footer (so the highest-authority page passes crawl equity);
   new URLs listed in `llms.txt` / `llms-full.txt` for AI discovery. Shared
   marketing chrome: `src/components/marketing/site-header.tsx`, `site-footer.tsx`.

Net new indexable URLs: **~40** (2 hubs + 33 guides + 1 compare index + 4
comparisons). Verified: `next build` prerenders all of them as static HTML, lint
clean.

---

## Part B — Off-site actions (these are what actually move the needle)

SEO/AI-SEO is mostly off-platform. The items below require your accounts and
can't be automated from the codebase. Ordered by impact ÷ effort.

### P0 — Get indexed. Do this first. (~45 min, today)

Without a Search Console property, Google indexes slowly and you're blind to what
it's doing. This is the single highest-leverage off-site action.

1. **Google Search Console** — https://search.google.com/search-console
   - Add property `namihr.com` (Domain property → add the TXT record to your DNS),
     **or** URL-prefix `https://namihr.com` and verify with the HTML-tag method.
   - If you use the HTML-tag method: the meta tag is **already wired** — set the
     Vercel env var `GOOGLE_SITE_VERIFICATION` to the token value (just the
     content string), redeploy, then click Verify. See
     `src/app/layout.tsx:26` and `:104`.
   - Once verified: **Sitemaps → submit `sitemap.xml`**. Then **URL Inspection →
     Request indexing** for `/`, `/pricing`, `/compare`, `/guides`.

2. **Bing Webmaster Tools** — https://www.bing.com/webmasters
   - Add the site, verify (env var `BING_SITE_VERIFICATION` is already wired —
     `src/app/layout.tsx:27,108`), submit the sitemap.
   - Bing also feeds ChatGPT search, so this doubles as AI-SEO.

3. After deploy, spot-check the live structured data with Google's
   **Rich Results Test** (https://search.google.com/test/rich-results) on
   `/`, `/compare/lattice`, and a `/guides/...` page — confirm FAQPage / Article
   render with no errors.

### P1 — Slack App Directory listing (this week — it's the customer + verification channel)

This is the most aligned action with "get first customers so we can verify with
Slack." The Marketplace is where Slack-first buyers discover apps, and the
listing itself is part of Slack's review.

- Lead time is ~2–4 weeks of Slack review — **start now.**
- Prerequisite per the launch-readiness supplement: **NEW-8 (`/nami pause`
  per-user opt-out)** — Slack tends to reject HR bots with no user-level mute.
  Build that before submitting. (See `docs/plans/2026-05-28-launch-readiness-supplement.md`.)
- Assets you already have: privacy policy, terms, security page, support page —
  all live and required for the listing.
- Submit via https://api.slack.com/apps → your app → **Manage Distribution /
  Slack Marketplace**.

### P1 — AI-citation sources (this week — this is how you show up in ChatGPT/Perplexity)

Answer engines lean heavily on third-party listings and review sites when they
answer "what are alternatives to Lattice?" Our own `/compare` pages help, but the
citations come from these:

- **AlternativeTo** (alternativeto.net) — create the Nami entry and tag it as an
  alternative to Lattice / 15Five / Leapsome / Culture Amp. Highest-signal source
  for "X alternative" AI answers, and free.
- **G2** and **Capterra/GetApp/Software Advice** — claim/create the profile.
  These dominate both Google SERPs and AI training data for HR-software queries.
  Seed 3–5 reviews from design-partner customers once you have them.
- **Product Hunt** — plan a launch (see P2). PH pages get cited and rank fast.
- **Slack App Directory** (above) is itself a strong citation source.

### P2 — LinkedIn + launch motion (ongoing — you already have an audience here)

- Post the drafts in **Part C** on a ~2×/week cadence. Mix product, guide
  teasers, and an honest "building in public, looking for design partners" ask.
- Make sure the **LinkedIn company page** links to `namihr.com` and the bio uses
  the words people search ("performance management in Slack", "Slack 360 reviews").
- Repurpose each `/guides` article into a LinkedIn post that links back to the
  guide — this builds the backlinks + referral traffic that compound into SEO.
- **Product Hunt launch**: bundle the comparison pages + guides as proof of depth;
  PH traffic + backlinks give a durable ranking bump.
- Tasteful community presence (r/managers, peopleops/HR communities, relevant
  Slack/Discord groups) — answer real questions, link a guide only when it
  genuinely helps. Don't spam.

---

## Part C — LinkedIn post drafts (ready to use; edit to your voice)

**1. Launch / positioning**
> Performance reviews fail for one boring reason: people don't finish them.
>
> So we built Nami to live where your team already is — Slack. 360° reviews,
> OKRs, pulse surveys, and calibration happen in a DM thread, not behind another
> login nobody remembers.
>
> $5/user/month, everything included. Free for teams of 10 or fewer.
> Add it to Slack in about five minutes 👉 namihr.com
>
> We're onboarding our first design partners now. If your reviews never get
> done on time, I'd love to talk.

**2. Guide teaser (repeat per article)**
> "What's a good objective vs. a key result?" is the question that derails most
> OKR rollouts.
>
> We wrote down how we coach teams through it — short, practical, no fluff:
> namihr.com/guides/goal-setting-okrs
>
> (Part of a new set of guides on running reviews, calibration, and eNPS for
> Slack-first teams.)

**3. Comparison / honest angle**
> People ask us "are you a Lattice alternative?" Honest answer: yes, if your team
> lives in Slack — and no, if you need a full standalone HR suite with learning
> modules.
>
> We wrote the comparison straight, including where the incumbents are the better
> pick: namihr.com/compare/lattice
>
> Performance tools should win on fit, not on hiding the trade-offs.

**4. Design-partner ask**
> We're looking for 5 teams (10–200 people, Slack-first) to run their next review
> cycle on Nami at a heavy discount, with hands-on setup from me.
>
> In return: candid feedback. You get reviews + OKRs + surveys that people
> actually complete, inside Slack.
>
> Comment "in" or DM me. namihr.com

---

## Part D — What "working" looks like (set expectations)

SEO compounds over weeks, not days. Realistic timeline after deploy + GSC submit:

- **Week 1–2:** new pages indexed (watch GSC Coverage). AI engines re-crawl
  `llms.txt` and the comparison pages.
- **Week 3–6:** first impressions on long-tail queries ("how to run calibration",
  "Lattice alternative Slack"). Track in GSC → Performance.
- **Ongoing:** rankings depend on backlinks + reviews (Part B P1/P2). The on-site
  work is necessary but not sufficient — the directory listings and LinkedIn
  links are what build authority.

Spot-check AI-SEO monthly: ask ChatGPT/Claude/Perplexity "what's a Slack-native
performance management tool?" and "alternatives to Lattice for Slack teams" and
see whether Nami is mentioned with the **correct** URL (namihr.com).

Leading indicator that matters most for the business: **Slack installs**, not
pageviews. The `?purpose=guides|compare|guide` param on the Add-to-Slack CTAs
lets you attribute installs to the content that drove them.

---

## Deploy

None of Part A has any effect until it's live. These are content/marketing pages
that don't touch the Slack runtime, auth, or billing — low risk — but follow the
normal path: branch → PR → review the landing-page nav/footer diff → merge to
`main` (Vercel auto-deploys production). After deploy, do Part B P0 immediately.
