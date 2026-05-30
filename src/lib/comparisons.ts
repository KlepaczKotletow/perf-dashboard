// Data for the /compare/[competitor] pages.
//
// These are sales pages on our own site, so they lead with the real, defensible
// pain points that drive teams off the incumbent — not a neutral feature matrix.
// Everything here is grounded in widely-known, publicly-described facts about each
// vendor (standalone web app, per-module/quote pricing, no free tier, blank
// frameworks). We still keep an honest "when the competitor is the better fit"
// section for credibility. Competitor specifics carry a "verify for your plan"
// disclaimer on-page because vendor features and pricing change.

// Nami side: "win" = a genuine differentiator (emphasized), "yes" = parity (still
// ours, lightly branded), "no" = an honest gap.
export type NamiStatus = "win" | "yes" | "no";
// Competitor side: "yes" = genuinely has it (de-emphasized), "limited" = has it
// but with a real caveat (fragmented, gated, costly), "no" = doesn't / weaker.
export type RivalStatus = "yes" | "limited" | "no";

export interface ComparisonRow {
  label: string;
  nami: string;
  namiStatus: NamiStatus;
  rival: string;
  rivalStatus: RivalStatus;
}

/** A pain the competitor's customers feel, and how Nami removes it. */
export interface SwitchReason {
  pain: string;
  fix: string;
}

export interface ComparisonFaq {
  q: string;
  a: string;
}

export interface Comparison {
  slug: string;
  name: string;
  metaTitle: string;
  metaDescription: string;
  heroSummary: string;
  positioning: string;
  switchReasons: SwitchReason[];
  rows: ComparisonRow[];
  betterFit: string;
  faqs: ComparisonFaq[];
}

export const COMPARISONS: Comparison[] = [
  {
    slug: "lattice",
    name: "Lattice",
    metaTitle: "Nami vs Lattice — a Slack-native Lattice alternative",
    metaDescription:
      "Switching off Lattice? Nami runs 360° reviews, OKRs, surveys, and calibration inside Slack at $5/user/month — free for teams of 10 or fewer. See why teams switch.",
    heroSummary:
      "Lattice is a broad, standalone HR suite that lives in its own app. Nami delivers the performance outcomes teams actually use — reviews, OKRs, engagement, calibration — inside Slack, at one simple price.",
    positioning:
      "Lattice is a capable people-management platform sold mostly to mid-market and enterprise HR teams. The friction isn't the feature list — it's that it's one more standalone app, priced per module, that employees have to be pulled into.",
    switchReasons: [
      {
        pain: "Reviews and check-ins live in a separate app, so completion stalls — managers spend weeks chasing people to log in.",
        fix: "Nami runs the whole review in the Slack DM employees already read, and nudges only the people who haven't finished — not the whole channel.",
      },
      {
        pain: "Pricing is per-module and quoted by sales, so the bill climbs every time you add engagement, growth, or analytics.",
        fix: "One plan at $5/user/month with reviews, OKRs, surveys, calibration, and analytics all included. Free under 10 people.",
      },
      {
        pain: "Standing it up is a project — implementation, admin training, and change management before anyone runs a cycle.",
        fix: "Install with Slack OAuth and launch your first cycle in about five minutes. No onboarding services.",
      },
      {
        pain: "Competency matrices start blank — someone has to write every level descriptor before a review means anything.",
        fix: "Eight career ladders ship fully written, so reviewers aren't guessing what a rating means.",
      },
    ],
    rows: [
      { label: "Where employees do it", nami: "Inside Slack — DM threads + Home Tab", namiStatus: "win", rival: "Separate web app — another login to remember", rivalStatus: "limited" },
      { label: "Getting reviews completed", nami: "Lands in the Slack DM people already read", namiStatus: "win", rival: "Hinges on chasing people into a separate tool", rivalStatus: "limited" },
      { label: "360° reviews", nami: "Self, manager, peer & upward", namiStatus: "yes", rival: "Yes — full cycles", rivalStatus: "yes" },
      { label: "Goals & OKRs", nami: "Yes, with quarterly check-ins", namiStatus: "yes", rival: "Yes", rivalStatus: "yes" },
      { label: "Competency frameworks", nami: "8 ladders, every level pre-written", namiStatus: "win", rival: "Build-your-own — blank rubrics to fill", rivalStatus: "limited" },
      { label: "Pricing", nami: "$5/user/month, everything included", namiStatus: "win", rival: "Per-module, quoted by sales", rivalStatus: "limited" },
      { label: "Free tier", nami: "Free for teams of 10 or fewer", namiStatus: "win", rival: "No free tier — demo or sales call", rivalStatus: "no" },
      { label: "Time to first cycle", nami: "~5 minutes via Slack OAuth", namiStatus: "win", rival: "Implementation & onboarding", rivalStatus: "limited" },
    ],
    betterFit:
      "If you need a deep standalone HR suite with dedicated learning and growth modules (Lattice Grow), a large implementation/services motion, and heavyweight enterprise procurement features, Lattice is built for that. Nami is for teams that want reviews their people actually complete, without the overhead — inside Slack.",
    faqs: [
      {
        q: "Is Nami a good Lattice alternative?",
        a: "Yes — for teams whose people live in Slack. Nami covers the Lattice outcomes most teams actually use (360° reviews, OKRs, engagement surveys, competency frameworks, 9-box calibration) but delivers them inside Slack at $5/user/month, with a free tier for teams of 10 or fewer.",
      },
      {
        q: "How does Nami's pricing compare to Lattice?",
        a: "Nami is a single all-inclusive plan at $5/user/month (free under 10 users), with no per-module add-ons. Lattice is typically priced per module and quoted by sales, so the per-seat cost usually ends up higher once you add the modules a performance program needs.",
      },
      {
        q: "Can I migrate from Lattice to Nami?",
        a: "Yes. Import your team and reporting structure via CSV (or directly from Slack), and rebuild or paste in your competency ladder. Partner Programme customers get hands-on migration help.",
      },
      {
        q: "What does Lattice do that Nami doesn't?",
        a: "Lattice includes dedicated learning and growth modules and a deeper enterprise services motion. Nami does not offer learning paths today — if that's central to your program, Lattice may fit better.",
      },
    ],
  },
  {
    slug: "15five",
    name: "15Five",
    metaTitle: "Nami vs 15Five — a Slack-native 15Five alternative",
    metaDescription:
      "A 15Five alternative built into Slack. Nami pairs continuous check-ins with full review cycles, OKRs, and calibration in one plan — $5/user/month, free for teams of 10 or fewer.",
    heroSummary:
      "15Five is strong on weekly check-ins — in its own app. Nami runs that same continuous-feedback loop inside Slack, and folds in full review cycles, OKRs, and calibration at one price.",
    positioning:
      "15Five does check-ins and manager enablement well, but it's a separate tool employees have to remember to open, and the full performance stack (formal cycles, OKRs, calibration) tends to sit in higher tiers.",
    switchReasons: [
      {
        pain: "It's one more tab employees forget — weekly check-ins lapse and the data goes stale.",
        fix: "Check-ins and recognition happen in Slack via /kudos and DM prompts, so participation stays high without nagging.",
      },
      {
        pain: "Formal review cycles, OKRs, and calibration sit in higher tiers or paid add-ons.",
        fix: "Reviews, OKRs, surveys, and 9-box calibration are all in the one $5/user plan.",
      },
      {
        pain: "Per-seat tiers get expensive fast as you switch more features on.",
        fix: "One flat price, everything included, and free for teams of 10 or fewer.",
      },
    ],
    rows: [
      { label: "Where employees do it", nami: "Inside Slack — DMs + Home Tab", namiStatus: "win", rival: "Separate web app, with Slack notifications", rivalStatus: "limited" },
      { label: "Weekly check-ins & recognition", nami: "In Slack via /kudos + DM prompts", namiStatus: "win", rival: "Yes — core strength, in-app", rivalStatus: "yes" },
      { label: "Full 360° review cycles", nami: "Included", namiStatus: "win", rival: "Higher tiers / add-on", rivalStatus: "limited" },
      { label: "OKRs & 9-box calibration", nami: "Included", namiStatus: "win", rival: "Objectives yes; calibration varies by tier", rivalStatus: "limited" },
      { label: "Engagement surveys & eNPS", nami: "Included", namiStatus: "yes", rival: "Yes (Engagement)", rivalStatus: "yes" },
      { label: "Pricing", nami: "$5/user/month, all-in", namiStatus: "win", rival: "Per-seat tiers; cost climbs with modules", rivalStatus: "limited" },
      { label: "Free tier", nami: "Free for teams of 10 or fewer", namiStatus: "win", rival: "Trial only", rivalStatus: "no" },
      { label: "Time to first cycle", nami: "~5 minutes via Slack OAuth", namiStatus: "win", rival: "Onboarding required", rivalStatus: "limited" },
    ],
    betterFit:
      "If your program is built around 15Five's manager-coaching content and best-self curriculum, and your team is happy operating in a dedicated app, 15Five is strong there. Nami wins when you want the same continuous-feedback rhythm plus formal cycles — delivered where the team already works, at one price.",
    faqs: [
      {
        q: "Is Nami a good 15Five alternative?",
        a: "Yes, especially for Slack-first teams. Nami delivers continuous feedback and check-ins inside Slack, plus full review cycles, OKRs, surveys, and calibration in one plan at $5/user/month.",
      },
      {
        q: "Does Nami do weekly check-ins like 15Five?",
        a: "Yes — Nami runs check-ins and recognition (/kudos) directly in Slack DMs, and nudges only the people who still have something outstanding rather than the whole channel.",
      },
      {
        q: "How does pricing compare?",
        a: "Nami is a single $5/user/month plan with everything included, free under 10 users. 15Five is priced per seat across tiers, so a full performance + engagement program usually costs more per seat.",
      },
      {
        q: "Can I move my data from 15Five?",
        a: "Yes — import your team and structure via CSV or Slack, and rebuild templates and frameworks from Nami's library. Partner Programme customers get migration help.",
      },
    ],
  },
  {
    slug: "leapsome",
    name: "Leapsome",
    metaTitle: "Nami vs Leapsome — a Slack-native Leapsome alternative",
    metaDescription:
      "A Leapsome alternative for Slack-first teams. Nami runs reviews, goals, surveys, and calibration inside Slack at $5/user/month — free for teams of 10 or fewer. See why teams switch.",
    heroSummary:
      "Leapsome is a broad people-enablement suite to configure and adopt. Nami keeps reviews, goals, surveys, and calibration inside Slack, so there's nothing new for employees to learn.",
    positioning:
      "Leapsome bundles a lot — reviews, goals, learning, engagement — into one standalone platform. For many teams that breadth is also the cost: more to configure, more to roll out, and employees still working in yet another web app.",
    switchReasons: [
      {
        pain: "It's a powerful but heavy suite — lots to configure, and employees still log into yet another web app.",
        fix: "Nami keeps reviews, goals, and surveys in Slack, so there's nothing new for employees to adopt and rollout is near-instant.",
      },
      {
        pain: "Module-and-quote pricing makes the real, all-in cost hard to pin down.",
        fix: "Flat $5/user/month with everything included, and free for teams of 10 or fewer.",
      },
      {
        pain: "Competency frameworks start empty — you build the ladders before reviews mean anything.",
        fix: "Eight career ladders ship fully written out of the box.",
      },
    ],
    rows: [
      { label: "Where employees do it", nami: "Inside Slack — DMs + Home Tab", namiStatus: "win", rival: "Separate web app", rivalStatus: "limited" },
      { label: "Getting reviews completed", nami: "In the Slack DM people already read", namiStatus: "win", rival: "Employees must log into a separate suite", rivalStatus: "limited" },
      { label: "Reviews, goals, surveys, calibration", nami: "All included, in Slack", namiStatus: "win", rival: "Yes — across a broader suite", rivalStatus: "yes" },
      { label: "Competency frameworks", nami: "8 ladders, every level pre-written", namiStatus: "win", rival: "Build-your-own", rivalStatus: "limited" },
      { label: "Rollout effort", nami: "~5 minutes via Slack OAuth", namiStatus: "win", rival: "Platform configuration & adoption", rivalStatus: "limited" },
      { label: "Pricing", nami: "$5/user/month, all-in", namiStatus: "win", rival: "Module-based, quoted by sales", rivalStatus: "limited" },
      { label: "Free tier", nami: "Free for teams of 10 or fewer", namiStatus: "win", rival: "Demo / trial", rivalStatus: "no" },
    ],
    betterFit:
      "If a built-in learning management system and structured development paths are central to your program, Leapsome includes those and Nami does not (yet). For reviews, goals, surveys, and calibration that run inside Slack with near-zero rollout, Nami is the lighter, faster, lower-cost option.",
    faqs: [
      {
        q: "Is Nami a good Leapsome alternative?",
        a: "Yes, for Slack-first teams that want reviews, goals, surveys, and calibration without a heavy rollout. Nami delivers those inside Slack at $5/user/month, free under 10 users.",
      },
      {
        q: "What does Leapsome have that Nami doesn't?",
        a: "Leapsome includes a built-in learning management system and development paths. Nami does not offer learning content today, so if that's core to your program Leapsome may fit better.",
      },
      {
        q: "How does pricing compare?",
        a: "Nami is one all-inclusive plan at $5/user/month (free under 10 users). Leapsome is module-based and quoted by sales, so per-seat cost is typically higher for a comparable performance program.",
      },
      {
        q: "Can I migrate from Leapsome?",
        a: "Yes — import your team and structure via CSV or Slack and rebuild frameworks from Nami's library. Partner Programme customers get hands-on migration help.",
      },
    ],
  },
  {
    slug: "culture-amp",
    name: "Culture Amp",
    metaTitle: "Nami vs Culture Amp — a Slack-native Culture Amp alternative",
    metaDescription:
      "A Culture Amp alternative for teams that want reviews and OKRs first, with engagement included — inside Slack, $5/user/month, free for teams of 10 or fewer.",
    heroSummary:
      "Culture Amp is engagement-survey-first, enterprise-priced, with performance layered on in a separate app. Nami is reviews-and-OKRs-first, inside Slack, with engagement included — right-sized for 10–500 person teams.",
    positioning:
      "Culture Amp is excellent at enterprise engagement research and benchmarking. But performance is layered on top, reviews still happen in a separate platform, and the whole thing is built and priced for large organizations.",
    switchReasons: [
      {
        pain: "Engagement is the core and reviews are layered on — so performance still happens in a separate tool people forget to open.",
        fix: "Reviews and OKRs are Nami's core, and they run in Slack where they actually get completed.",
      },
      {
        pain: "It's built and priced for large enterprises — overkill (and over budget) for a 20–200 person team.",
        fix: "Right-sized and simple: $5/user/month, free under 10 people, live in minutes.",
      },
      {
        pain: "Deep engagement surveys often mean a separate contract and a people-science lift to operate.",
        fix: "Anonymous pulse surveys and eNPS are included in the one plan, on whatever cadence you set.",
      },
    ],
    rows: [
      { label: "Where employees do it", nami: "Inside Slack — DMs + Home Tab", namiStatus: "win", rival: "Separate web app", rivalStatus: "limited" },
      { label: "What it's built around", nami: "Reviews & OKRs first", namiStatus: "win", rival: "Engagement surveys first; performance layered on", rivalStatus: "limited" },
      { label: "Getting reviews completed", nami: "In the Slack DM people already read", namiStatus: "win", rival: "Reviews in a separate platform", rivalStatus: "limited" },
      { label: "Engagement surveys & eNPS", nami: "Included", namiStatus: "yes", rival: "Yes — deep benchmarking", rivalStatus: "yes" },
      { label: "Goals, OKRs & calibration", nami: "Included", namiStatus: "win", rival: "Yes — across modules", rivalStatus: "limited" },
      { label: "Pricing", nami: "$5/user/month, all-in", namiStatus: "win", rival: "Quoted by sales; enterprise-priced", rivalStatus: "limited" },
      { label: "Free tier", nami: "Free for teams of 10 or fewer", namiStatus: "win", rival: "No free tier", rivalStatus: "no" },
      { label: "Right-sized for", nami: "10–500 person teams", namiStatus: "win", rival: "Larger enterprises", rivalStatus: "limited" },
    ],
    betterFit:
      "If your primary need is enterprise-scale engagement research — external benchmarking, longitudinal people-science analytics, and a dedicated research team — Culture Amp is purpose-built for that. If your pain is that performance reviews never get completed, Nami wins.",
    faqs: [
      {
        q: "Is Nami a good Culture Amp alternative?",
        a: "It depends on your priority. If your main pain is getting performance reviews and OKRs completed, Nami's Slack-native approach wins. If you need enterprise-scale engagement research and benchmarking, Culture Amp is stronger there.",
      },
      {
        q: "Does Nami include engagement surveys?",
        a: "Yes — anonymous, aggregated pulse surveys and eNPS are included in Nami's single plan, on whatever cadence you set. Culture Amp goes deeper on benchmarking and people-science analytics.",
      },
      {
        q: "How does pricing compare?",
        a: "Nami is one all-inclusive plan at $5/user/month, free under 10 users. Culture Amp is quoted by sales and priced for enterprise, typically at a meaningfully higher per-seat cost.",
      },
      {
        q: "Can I migrate from Culture Amp?",
        a: "Yes — import your team and structure via CSV or Slack and rebuild frameworks from Nami's library. Partner Programme customers get migration help.",
      },
    ],
  },
];

export function getComparison(slug: string): Comparison | undefined {
  return COMPARISONS.find((c) => c.slug === slug);
}
