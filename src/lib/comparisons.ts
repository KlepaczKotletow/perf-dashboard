// Data for the /compare/[competitor] pages. Every claim here is deliberately
// fair and grounded in the same honest framing used in public/llms-full.txt —
// including an explicit "when the competitor is the better fit" for each, which
// builds trust with buyers and reads well to answer engines that reward balance.
//
// Competitor pricing is described qualitatively on purpose: published SaaS
// pricing changes often and several of these vendors quote per-module, so we
// avoid asserting specific competitor dollar figures we can't keep current.

export interface ComparisonAttribute {
  label: string;
  nami: string;
  competitor: string;
}

export interface ComparisonFaq {
  q: string;
  a: string;
}

export interface Comparison {
  slug: string;
  name: string; // display name, e.g. "Lattice"
  metaTitle: string;
  metaDescription: string;
  heroSummary: string;
  positioning: string;
  namiEdge: string[];
  betterFit: string;
  attributes: ComparisonAttribute[];
  faqs: ComparisonFaq[];
}

// Attribute values that are identical across every comparison (the Nami side,
// plus rows where the competitor answer is the same regardless of vendor).
const NAMI = {
  surface: "Native Slack — DM threads + Home Tab, plus a web dashboard",
  reviews: "360°: self, manager, peer, upward",
  goals: "Goals & OKRs with quarterly check-ins and rollups",
  surveys: "Pulse surveys & eNPS included",
  frameworks: "8 ladders, every cell pre-written",
  calibration: "9-box calibration included",
  pricing: "$5/user/month, everything included",
  freeTier: "Free forever for teams of 10 or fewer",
  setup: "~5 minutes via Slack OAuth",
};

export const COMPARISONS: Comparison[] = [
  {
    slug: "lattice",
    name: "Lattice",
    metaTitle: "Nami vs Lattice — a Slack-native Lattice alternative",
    metaDescription:
      "Looking for a Lattice alternative? Nami runs 360° reviews, OKRs, surveys, and calibration inside Slack at $5/user/month — free for teams of 10 or fewer. Honest side-by-side comparison.",
    heroSummary:
      "Lattice is a broad, standalone people-management suite. Nami delivers the same core performance outcomes — reviews, OKRs, engagement, calibration — inside Slack, at one simple price.",
    positioning:
      "Lattice is a well-known people-management platform covering reviews, goals, engagement, and growth, typically sold to mid-market and enterprise HR teams as a standalone web application with its own login.",
    namiEdge: [
      "Lives in Slack. Reviews, check-ins, and surveys happen in the DM thread employees already read — not behind another login they forget about.",
      "One simple price: $5/user/month with everything included, and free for teams of 10 or fewer. No per-module quote, no add-on tiers.",
      "Set up in about five minutes with Slack OAuth — there is no implementation project or onboarding services engagement.",
      "Competency frameworks ship fully populated with written descriptors, so reviewers aren't guessing what a rating means.",
      "CSV migration from Lattice is supported, and Partner Programme customers get hands-on help moving over.",
    ],
    betterFit:
      "If you need a deep standalone HR suite with advanced growth and development modules, a large implementation/services motion, and heavyweight enterprise procurement features, Lattice is purpose-built for that. Nami is for teams that want high review completion with minimal overhead, right inside Slack.",
    attributes: [
      { label: "Where it runs", nami: NAMI.surface, competitor: "Standalone web app, with Slack notifications" },
      { label: "Performance reviews", nami: NAMI.reviews, competitor: "Yes — full review cycles" },
      { label: "Goals & OKRs", nami: NAMI.goals, competitor: "Yes" },
      { label: "Engagement / pulse surveys", nami: NAMI.surveys, competitor: "Yes (engagement module)" },
      { label: "Competency frameworks", nami: NAMI.frameworks, competitor: "Yes — build your own" },
      { label: "9-box calibration", nami: NAMI.calibration, competitor: "Yes" },
      { label: "Learning / growth paths", nami: "Not a current feature", competitor: "Yes (Grow)" },
      { label: "Pricing", nami: NAMI.pricing, competitor: "Per-module, quoted by sales" },
      { label: "Free tier", nami: NAMI.freeTier, competitor: "Demo / trial" },
      { label: "Time to first cycle", nami: NAMI.setup, competitor: "Implementation & onboarding" },
    ],
    faqs: [
      {
        q: "Is Nami a good Lattice alternative?",
        a: "Yes — for teams whose people live in Slack. Nami covers the core Lattice outcomes (360° reviews, OKR tracking, engagement surveys, competency frameworks, 9-box calibration) but delivers them inside Slack at $5/user/month, with a free tier for teams of 10 or fewer.",
      },
      {
        q: "How does Nami's pricing compare to Lattice?",
        a: "Nami is a single all-inclusive plan at $5/user/month (free under 10 users), with no per-module add-ons. Lattice is typically priced per module and quoted by sales, so the per-seat cost is usually higher once you add the modules a performance program needs.",
      },
      {
        q: "Can I migrate from Lattice to Nami?",
        a: "Yes. You can import your team and reporting structure via CSV (or directly from Slack), and rebuild or paste in your competency ladder. Partner Programme customers get hands-on migration help.",
      },
      {
        q: "What does Lattice do that Nami doesn't?",
        a: "Lattice includes dedicated learning and growth modules and a deeper enterprise services motion. Nami does not offer learning paths today. If those are central to your program, Lattice may fit better.",
      },
    ],
  },
  {
    slug: "15five",
    name: "15Five",
    metaTitle: "Nami vs 15Five — a Slack-native 15Five alternative",
    metaDescription:
      "A 15Five alternative built into Slack. Nami pairs continuous feedback and check-ins with full review cycles, OKRs, and calibration — $5/user/month, free for teams of 10 or fewer.",
    heroSummary:
      "15Five is strong on weekly check-ins and continuous feedback. Nami covers that same loop and adds full review cycles, OKRs, and calibration — all inside Slack.",
    positioning:
      "15Five is best known for weekly check-ins, continuous feedback, and manager enablement, delivered as a standalone web app with Slack notifications.",
    namiEdge: [
      "Continuous feedback and recognition happen natively in Slack via /kudos and DM nudges — not in a separate weekly-form app.",
      "Full performance cycles, OKRs, and 9-box calibration are included in the same $5/user/month plan, not split across tiers.",
      "Competency frameworks ship populated with written level descriptors.",
      "Free forever for teams of 10 or fewer, with a 14-day Pro trial and no credit card to start.",
      "About five minutes to install and launch your first cycle — no onboarding services.",
    ],
    betterFit:
      "If your program is built around 15Five's manager-coaching content, recognition culture features, and you're happy operating in a dedicated app, 15Five is strong there. Nami wins when you want the same continuous-feedback rhythm plus formal review cycles, delivered where the team already works.",
    attributes: [
      { label: "Where it runs", nami: NAMI.surface, competitor: "Standalone web app, with Slack notifications" },
      { label: "Continuous feedback / check-ins", nami: "Yes — /kudos + DM check-ins in Slack", competitor: "Yes — core strength" },
      { label: "Performance reviews", nami: NAMI.reviews, competitor: "Yes — review cycles" },
      { label: "Goals & OKRs", nami: NAMI.goals, competitor: "Yes (Objectives)" },
      { label: "Engagement / pulse surveys", nami: NAMI.surveys, competitor: "Yes (Engagement)" },
      { label: "Competency frameworks", nami: NAMI.frameworks, competitor: "Yes" },
      { label: "9-box calibration", nami: NAMI.calibration, competitor: "Yes" },
      { label: "Pricing", nami: NAMI.pricing, competitor: "Per-module, per-seat tiers" },
      { label: "Free tier", nami: NAMI.freeTier, competitor: "Trial" },
      { label: "Time to first cycle", nami: NAMI.setup, competitor: "Onboarding required" },
    ],
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
      "A Leapsome alternative for Slack-first teams. Nami runs reviews, goals, surveys, and calibration inside Slack at $5/user/month — free for teams of 10 or fewer. Honest comparison.",
    heroSummary:
      "Leapsome bundles reviews, goals, learning, and engagement. Nami focuses on reviews, goals, surveys, and calibration — delivered inside Slack at one simple price.",
    positioning:
      "Leapsome is an all-in-one people-enablement platform combining reviews, goals, learning, and engagement, aimed at growing companies that want a single standalone suite.",
    namiEdge: [
      "Reviews, goals, surveys, and calibration run inside Slack, where completion rates are far higher than in a separate web app.",
      "One transparent price — $5/user/month, everything included, free for teams of 10 or fewer.",
      "Populated competency frameworks out of the box; no blank-rubric setup work.",
      "Database-level visibility rules: managers literally can't see upward feedback before submitting their own review.",
      "Five-minute Slack install instead of a platform rollout.",
    ],
    betterFit:
      "If a built-in learning management system and structured development paths are central to your program, Leapsome includes those and Nami does not (yet). For reviews, goals, surveys, and calibration inside Slack, Nami is the lighter, faster, lower-cost option.",
    attributes: [
      { label: "Where it runs", nami: NAMI.surface, competitor: "Standalone web app, with Slack notifications" },
      { label: "Performance reviews", nami: NAMI.reviews, competitor: "Yes" },
      { label: "Goals & OKRs", nami: NAMI.goals, competitor: "Yes" },
      { label: "Engagement / pulse surveys", nami: NAMI.surveys, competitor: "Yes" },
      { label: "Competency frameworks", nami: NAMI.frameworks, competitor: "Yes" },
      { label: "9-box calibration", nami: NAMI.calibration, competitor: "Yes" },
      { label: "Learning / LMS", nami: "Not a current feature", competitor: "Yes — built-in learning" },
      { label: "Pricing", nami: NAMI.pricing, competitor: "Per-module, quoted by sales" },
      { label: "Free tier", nami: NAMI.freeTier, competitor: "Demo / trial" },
      { label: "Time to first cycle", nami: NAMI.setup, competitor: "Onboarding required" },
    ],
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
      "Culture Amp is engagement-survey-first with performance layered on top. Nami is reviews-and-OKR-first with engagement surveys included — delivered inside Slack.",
    positioning:
      "Culture Amp is an employee-experience platform best known for deep engagement surveys, benchmarking, and people-science analytics, with performance reviews layered on top, aimed at larger organizations.",
    namiEdge: [
      "Reviews and OKRs are the core, not an add-on — and they run inside Slack so they actually get completed.",
      "Pulse surveys and eNPS are included in the same plan; no separate engagement contract.",
      "One simple price: $5/user/month, free for teams of 10 or fewer.",
      "Populated competency frameworks and 9-box calibration out of the box.",
      "Five-minute Slack install, no people-science services engagement required.",
    ],
    betterFit:
      "If your primary need is enterprise-scale engagement research — external benchmarking, longitudinal people-science analytics, and a dedicated research team — Culture Amp is purpose-built for that. If your pain is 'performance reviews never get completed,' Nami wins.",
    attributes: [
      { label: "Where it runs", nami: NAMI.surface, competitor: "Standalone web app, with Slack notifications" },
      { label: "Primary focus", nami: "Reviews & OKRs first", competitor: "Engagement surveys first" },
      { label: "Performance reviews", nami: NAMI.reviews, competitor: "Yes (Perform)" },
      { label: "Goals & OKRs", nami: NAMI.goals, competitor: "Yes" },
      { label: "Engagement / pulse surveys", nami: NAMI.surveys, competitor: "Yes — core strength, with benchmarks" },
      { label: "Competency frameworks", nami: NAMI.frameworks, competitor: "Yes" },
      { label: "9-box calibration", nami: NAMI.calibration, competitor: "Yes" },
      { label: "Pricing", nami: NAMI.pricing, competitor: "Per-module, quoted by sales" },
      { label: "Free tier", nami: NAMI.freeTier, competitor: "Demo / trial" },
      { label: "Time to first cycle", nami: NAMI.setup, competitor: "Onboarding required" },
    ],
    faqs: [
      {
        q: "Is Nami a good Culture Amp alternative?",
        a: "Partially, depending on your priority. If your main pain is getting performance reviews and OKRs completed, Nami's Slack-native approach wins. If you need enterprise-scale engagement research and benchmarking, Culture Amp is stronger there.",
      },
      {
        q: "Does Nami include engagement surveys?",
        a: "Yes — anonymous, aggregated pulse surveys and eNPS are included in Nami's single plan, on whatever cadence you set. Culture Amp goes deeper on benchmarking and people-science analytics.",
      },
      {
        q: "How does pricing compare?",
        a: "Nami is one all-inclusive plan at $5/user/month, free under 10 users. Culture Amp is quoted by sales per module, typically at a higher per-seat cost.",
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
