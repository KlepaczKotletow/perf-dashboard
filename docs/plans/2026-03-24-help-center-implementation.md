# Help Center Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an in-app Help Center at `/dashboard/help` with MDX-powered articles, sidebar navigation, search, and role audience tags.

**Architecture:** MDX files in `/content/help/` parsed at request time with `gray-matter` (frontmatter) and compiled with `next-mdx-remote`. Server components fetch the article index; a client sidebar handles search/filtering. Two custom MDX components: `Callout` and `RoleTag`.

**Tech Stack:** Next.js 16, `next-mdx-remote`, `gray-matter`, Tailwind CSS, Radix UI Sheet, Lucide icons.

**Design doc:** `docs/plans/2026-03-24-help-center-design.md`

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install packages**

Run: `npm install next-mdx-remote gray-matter`

**Step 2: Verify installation**

Run: `npm ls next-mdx-remote gray-matter`
Expected: Both packages listed without errors.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add next-mdx-remote and gray-matter for help center"
```

---

### Task 2: Article Utilities — `getAllArticles()` and `getArticleBySlug()`

**Files:**
- Create: `src/lib/help-articles.ts`

**Step 1: Create the utility file**

```ts
import fs from "fs";
import path from "path";
import matter from "gray-matter";

export interface HelpArticle {
  slug: string;
  title: string;
  description: string;
  category: string;
  audience: string[];
  order: number;
  icon: string;
}

export interface HelpArticleWithContent extends HelpArticle {
  content: string;
}

const CONTENT_DIR = path.join(process.cwd(), "content", "help");

const CATEGORY_ORDER = [
  "Getting Started",
  "Cycles",
  "Reviews",
  "Goals",
  "Team Management",
  "Surveys",
  "Competencies",
  "Calibration",
  "Analytics",
  "Admin & Billing",
  "Troubleshooting",
];

function getMdxFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getMdxFiles(fullPath));
    } else if (entry.name.endsWith(".mdx")) {
      files.push(fullPath);
    }
  }
  return files;
}

export function getAllArticles(): HelpArticle[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];

  const files = getMdxFiles(CONTENT_DIR);

  const articles = files.map((filePath) => {
    const raw = fs.readFileSync(filePath, "utf-8");
    const { data } = matter(raw);
    const slug = path.basename(filePath, ".mdx");

    return {
      slug,
      title: data.title || slug,
      description: data.description || "",
      category: data.category || "Uncategorized",
      audience: data.audience || ["all"],
      order: data.order ?? 99,
      icon: data.icon || "FileText",
    };
  });

  return articles.sort((a, b) => {
    const catA = CATEGORY_ORDER.indexOf(a.category);
    const catB = CATEGORY_ORDER.indexOf(b.category);
    const catSort = (catA === -1 ? 999 : catA) - (catB === -1 ? 999 : catB);
    if (catSort !== 0) return catSort;
    return a.order - b.order;
  });
}

export function getArticleBySlug(slug: string): HelpArticleWithContent | null {
  if (!fs.existsSync(CONTENT_DIR)) return null;

  const files = getMdxFiles(CONTENT_DIR);
  const match = files.find((f) => path.basename(f, ".mdx") === slug);
  if (!match) return null;

  const raw = fs.readFileSync(match, "utf-8");
  const { data, content } = matter(raw);

  return {
    slug,
    title: data.title || slug,
    description: data.description || "",
    category: data.category || "Uncategorized",
    audience: data.audience || ["all"],
    order: data.order ?? 99,
    icon: data.icon || "FileText",
    content,
  };
}

export function getArticlesGroupedByCategory(): { category: string; articles: HelpArticle[] }[] {
  const articles = getAllArticles();
  const grouped: Map<string, HelpArticle[]> = new Map();

  for (const article of articles) {
    const list = grouped.get(article.category) || [];
    list.push(article);
    grouped.set(article.category, list);
  }

  // Return in category order
  return CATEGORY_ORDER
    .filter((cat) => grouped.has(cat))
    .map((cat) => ({ category: cat, articles: grouped.get(cat)! }));
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit src/lib/help-articles.ts 2>&1 | head -20`
Expected: No errors (or only unrelated existing errors).

**Step 3: Commit**

```bash
git add src/lib/help-articles.ts
git commit -m "feat(help): add article parsing utilities with gray-matter"
```

---

### Task 3: Custom MDX Components — `Callout` and `RoleTag`

**Files:**
- Create: `src/components/help/callout.tsx`
- Create: `src/components/help/role-tag.tsx`
- Create: `src/components/help/mdx-components.tsx`

**Step 1: Create Callout component**

`src/components/help/callout.tsx`:
```tsx
import { Info, AlertTriangle, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

const VARIANTS = {
  info: {
    icon: Info,
    bg: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  tip: {
    icon: Lightbulb,
    bg: "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800",
    iconColor: "text-green-600 dark:text-green-400",
  },
} as const;

interface CalloutProps {
  type?: keyof typeof VARIANTS;
  children: React.ReactNode;
}

export function Callout({ type = "info", children }: CalloutProps) {
  const v = VARIANTS[type];
  const Icon = v.icon;

  return (
    <div className={cn("my-4 rounded-lg border p-4 flex gap-3", v.bg)}>
      <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", v.iconColor)} />
      <div className="text-sm leading-relaxed [&>p]:m-0">{children}</div>
    </div>
  );
}
```

**Step 2: Create RoleTag component**

`src/components/help/role-tag.tsx`:
```tsx
import { cn } from "@/lib/utils";

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  hr: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  manager: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  all: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

interface RoleTagProps {
  role: string;
}

export function RoleTag({ role }: RoleTagProps) {
  const color = ROLE_COLORS[role.toLowerCase()] || ROLE_COLORS.all;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize", color)}>
      {role}
    </span>
  );
}
```

**Step 3: Create MDX components map**

`src/components/help/mdx-components.tsx`:
```tsx
import type { MDXComponents } from "mdx/types";
import { Callout } from "./callout";
import { RoleTag } from "./role-tag";

export const helpMdxComponents: MDXComponents = {
  Callout,
  RoleTag,
  // Style standard HTML elements for consistent article look
  h1: (props) => <h1 className="text-2xl font-bold tracking-tight mt-8 mb-4 first:mt-0" {...props} />,
  h2: (props) => <h2 className="text-xl font-semibold tracking-tight mt-8 mb-3" {...props} />,
  h3: (props) => <h3 className="text-lg font-semibold mt-6 mb-2" {...props} />,
  p: (props) => <p className="leading-7 mb-4" {...props} />,
  ul: (props) => <ul className="list-disc pl-6 mb-4 space-y-1" {...props} />,
  ol: (props) => <ol className="list-decimal pl-6 mb-4 space-y-1" {...props} />,
  li: (props) => <li className="leading-7" {...props} />,
  strong: (props) => <strong className="font-semibold" {...props} />,
  a: (props) => <a className="text-primary underline underline-offset-4 hover:text-primary/80" {...props} />,
  table: (props) => (
    <div className="my-4 overflow-x-auto rounded-lg border">
      <table className="w-full text-sm" {...props} />
    </div>
  ),
  th: (props) => <th className="border-b px-4 py-2 text-left font-medium bg-muted/50" {...props} />,
  td: (props) => <td className="border-b px-4 py-2" {...props} />,
  hr: () => <hr className="my-8 border-border" />,
};
```

**Step 4: Commit**

```bash
git add src/components/help/
git commit -m "feat(help): add Callout, RoleTag, and MDX component map"
```

---

### Task 4: Help Sidebar Component (Client)

**Files:**
- Create: `src/components/help/help-sidebar.tsx`

**Step 1: Create the sidebar component**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { RoleTag } from "./role-tag";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import type { HelpArticle } from "@/lib/help-articles";

interface HelpSidebarProps {
  grouped: { category: string; articles: HelpArticle[] }[];
}

function SidebarContent({ grouped, query, pathname }: HelpSidebarProps & { query: string; pathname: string }) {
  const lowerQuery = query.toLowerCase();

  const filtered = grouped
    .map((group) => ({
      ...group,
      articles: group.articles.filter(
        (a) =>
          !query ||
          a.title.toLowerCase().includes(lowerQuery) ||
          a.description.toLowerCase().includes(lowerQuery)
      ),
    }))
    .filter((group) => group.articles.length > 0);

  if (filtered.length === 0) {
    return <p className="px-3 py-6 text-sm text-muted-foreground text-center">No articles found.</p>;
  }

  return (
    <nav className="space-y-4">
      {filtered.map((group) => (
        <div key={group.category}>
          <h3 className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {group.category}
          </h3>
          <ul className="space-y-0.5">
            {group.articles.map((article) => {
              const href = `/dashboard/help/${article.slug}`;
              const isActive = pathname === href;
              return (
                <li key={article.slug}>
                  <Link
                    href={href}
                    className={cn(
                      "block px-3 py-1.5 rounded-md text-[13px] transition-colors",
                      isActive
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    )}
                  >
                    {article.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function HelpSidebar({ grouped }: HelpSidebarProps) {
  const [query, setQuery] = useState("");
  const pathname = usePathname();

  const sidebar = (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search articles..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-8 rounded-md border bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Article list */}
      <div className="flex-1 overflow-y-auto py-3">
        <SidebarContent grouped={grouped} query={query} pathname={pathname} />
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile: Sheet trigger + drawer */}
      <div className="lg:hidden flex items-center gap-2 border-b px-4 py-2">
        <Sheet>
          <SheetTrigger asChild>
            <button className="p-1.5 rounded-md hover:bg-accent transition-colors" aria-label="Open help navigation">
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            {sidebar}
          </SheetContent>
        </Sheet>
        <span className="text-sm font-medium">Help Center</span>
      </div>

      {/* Desktop: fixed sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 border-r h-full">
        {sidebar}
      </aside>
    </>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/help/help-sidebar.tsx
git commit -m "feat(help): add HelpSidebar with search and mobile sheet"
```

---

### Task 5: Help Layout and Route Pages

**Files:**
- Create: `src/app/dashboard/help/layout.tsx`
- Create: `src/app/dashboard/help/page.tsx`
- Create: `src/app/dashboard/help/[slug]/page.tsx`

**Step 1: Create the help layout**

`src/app/dashboard/help/layout.tsx`:
```tsx
import { getArticlesGroupedByCategory } from "@/lib/help-articles";
import { HelpSidebar } from "@/components/help/help-sidebar";

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  const grouped = getArticlesGroupedByCategory();

  return (
    <div className="flex flex-col lg:flex-row -mx-4 lg:-mx-8 -my-6 lg:-my-8 min-h-[calc(100vh-3.5rem)] lg:min-h-screen">
      <HelpSidebar grouped={grouped} />
      <main className="flex-1 overflow-y-auto px-6 lg:px-10 py-6 lg:py-8">
        {children}
      </main>
    </div>
  );
}
```

**Step 2: Create the landing page (redirects to first article)**

`src/app/dashboard/help/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { getAllArticles } from "@/lib/help-articles";

export default function HelpPage() {
  const articles = getAllArticles();

  if (articles.length > 0) {
    redirect(`/dashboard/help/${articles[0].slug}`);
  }

  return (
    <div className="flex items-center justify-center h-full text-muted-foreground">
      <p>No help articles available yet.</p>
    </div>
  );
}
```

**Step 3: Create the article page**

`src/app/dashboard/help/[slug]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import { getArticleBySlug, getAllArticles } from "@/lib/help-articles";
import { helpMdxComponents } from "@/components/help/mdx-components";
import { RoleTag } from "@/components/help/role-tag";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllArticles().map((a) => ({ slug: a.slug }));
}

export default async function HelpArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) notFound();

  const { content } = await compileMDX({
    source: article.content,
    components: helpMdxComponents,
  });

  return (
    <article className="max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {article.audience.map((role) => (
            <RoleTag key={role} role={role} />
          ))}
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{article.title}</h1>
        {article.description && (
          <p className="mt-1 text-muted-foreground">{article.description}</p>
        )}
      </div>

      <hr className="mb-6 border-border" />

      {/* MDX content */}
      <div className="prose-sm">{content}</div>
    </article>
  );
}
```

**Step 4: Commit**

```bash
git add src/app/dashboard/help/
git commit -m "feat(help): add help layout, landing page, and article route"
```

---

### Task 6: Add Entry Points — Footer Dropdown & Sidebar Nav

**Files:**
- Modify: `src/app/dashboard/footer-dropdown.tsx:5,66-68`
- Modify: `src/app/dashboard/layout.tsx:3,124-140`

**Step 1: Add Help Center to footer dropdown**

In `src/app/dashboard/footer-dropdown.tsx`:

1. Add `HelpCircle` to the lucide import (line 5):
   ```ts
   import { LogOut, User, Settings, ChevronUp, HelpCircle } from "lucide-react";
   ```

2. Add the Help Center menu item before the separator (between line 66 and 68 — after the Settings conditional, before `<DropdownMenuSeparator />`):
   ```tsx
        <DropdownMenuItem onClick={() => router.push("/dashboard/help")}>
          <HelpCircle className="h-4 w-4 mr-2" />
          Help Center
        </DropdownMenuItem>

        <DropdownMenuSeparator />
   ```
   (This replaces the existing `<DropdownMenuSeparator />` on line 68.)

**Step 2: Add Help link at bottom of sidebar nav**

In `src/app/dashboard/layout.tsx`:

1. Add `HelpCircle` to the lucide import (line 3):
   ```ts
   import {
     LayoutDashboard,
     FileText,
     Users,
     MessageSquare,
     BarChart3,
     CalendarClock,
     CreditCard,
     Briefcase,
     ClipboardCheck,
     ClipboardList,
     UsersRound,
     ListChecks,
     Flag,
     SlidersHorizontal,
     Settings2,
     HelpCircle,
   } from "lucide-react";
   ```

2. After the `filteredSections.map(...)` block in the `<nav>` (around line 139, before the closing `</nav>`), add a divider and help link:
   ```tsx
            <div className="my-2 mx-2 h-px bg-sidebar-border/60" />
            <NavLink
              href="/dashboard/help"
              label="Help"
              icon={<HelpCircle className="h-4 w-4 shrink-0" />}
            />
   ```

**Step 3: Verify the build compiles**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds (help pages may warn about no content yet, that's fine).

**Step 4: Commit**

```bash
git add src/app/dashboard/footer-dropdown.tsx src/app/dashboard/layout.tsx
git commit -m "feat(help): add Help Center entry points in sidebar and user dropdown"
```

---

### Task 7: Create First Seed Article (Smoke Test)

**Files:**
- Create: `content/help/getting-started/first-15-minutes.mdx`

**Step 1: Create content directory and seed article**

Run: `mkdir -p content/help/getting-started`

`content/help/getting-started/first-15-minutes.mdx`:
```mdx
---
title: "Getting Started: Your First 15 Minutes"
description: "Everything you need to know after signing in to Perf for the first time"
category: "Getting Started"
audience: ["all"]
order: 1
icon: "Rocket"
---

Welcome to Perf! This guide walks you through what to expect after signing in with Slack and how to get the most out of the platform from day one.

## What is Perf?

Perf is a Slack-native performance management platform. Instead of filling out forms in a separate tool, you complete reviews, give feedback, and track goals directly in Slack through our AI assistant **Nami**.

## Your Dashboard

After signing in, you land on the **Dashboard Overview**. Here you'll find:

- **Pending reviews** you need to complete
- **Recent feedback** you've received
- **Active goals** and their progress
- **Upcoming deadlines** for current review cycles

## How Nami Works

Nami is your AI assistant that lives in Slack. When a review cycle starts or a survey is launched, Nami sends you a direct message with everything you need:

1. Nami sends you a DM with the review details
2. You click **"Let's go"** to start
3. Nami walks you through each question one at a time
4. When you're done, your responses are saved automatically

<Callout type="tip">
If you're not ready when Nami messages you, click **"Remind me later"** and you'll get a follow-up the next day.
</Callout>

## Key Sections

| Section | What it's for |
|---------|--------------|
| **Performance** | Complete self-reviews and see your review history |
| **Feedback** | View all feedback received (reviews + continuous) |
| **Goals** | Create and track your personal, team, and company goals |
| **Reviews** | Managers: see all review assignments and their status |

## What to Do First

If you're a **regular employee**, there's nothing to set up. Just wait for Nami to reach out when a review cycle starts, or head to **Goals** to create your first goal.

If you're a **manager**, check out the [My Team Dashboard](/dashboard/my-team) to see your direct reports and their review status.

If you're an **admin**, head to the [Workspace Setup Guide](/dashboard/help/workspace-setup) to configure your organization.

<Callout type="info">
Your profile details (name, email, avatar) are automatically synced from Slack. You don't need to set anything up manually.
</Callout>
```

**Step 2: Verify the app builds and the article renders**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds, help route is generated.

**Step 3: Commit**

```bash
git add content/
git commit -m "feat(help): add first seed article — Getting Started: Your First 15 Minutes"
```

---

### Task 8: Write Remaining Tier 1 Articles (6 articles)

**Files:**
- Create: `content/help/team/workspace-setup.mdx`
- Create: `content/help/reviews/self-review.mdx`
- Create: `content/help/reviews/manager-review.mdx`
- Create: `content/help/cycles/creating-a-cycle.mdx`
- Create: `content/help/getting-started/roles-permissions.mdx`
- Create: `content/help/team/managing-users.mdx`

**Step 1:** Create each article with proper frontmatter and comprehensive content covering the workflows described in the design doc. Each article should be 200-400 words, use markdown headings/lists/tables, and include `<Callout>` and `<RoleTag>` where relevant.

Run: `mkdir -p content/help/{reviews,cycles,team}`

Write each MDX file with the appropriate frontmatter:

- `workspace-setup.mdx`: category "Team Management", audience ["admin"], order 1
- `self-review.mdx`: category "Reviews", audience ["all"], order 1
- `manager-review.mdx`: category "Reviews", audience ["manager"], order 2
- `creating-a-cycle.mdx`: category "Cycles", audience ["hr", "admin"], order 1
- `roles-permissions.mdx`: category "Getting Started", audience ["admin"], order 3
- `managing-users.mdx`: category "Team Management", audience ["admin"], order 2

**Step 2: Verify build**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds with all 7 articles.

**Step 3: Commit**

```bash
git add content/help/
git commit -m "feat(help): add Tier 1 articles — setup, reviews, cycles, roles, team management"
```

---

### Task 9: Write Tier 2 Articles (7 articles)

**Files:**
- Create: `content/help/getting-started/nami-bot.mdx` — category "Getting Started", audience ["all"], order 2
- Create: `content/help/reviews/upward-feedback.mdx` — category "Reviews", audience ["all"], order 3
- Create: `content/help/cycles/lifecycle-explained.mdx` — category "Cycles", audience ["all"], order 3
- Create: `content/help/admin/templates.mdx` — category "Admin & Billing", audience ["hr", "admin"], order 1. Note: rename from design — better fit under organization topics. Actually keep it in a new dir:
- Create: `content/help/templates/using-and-creating.mdx` — category "Templates" (add to CATEGORY_ORDER between Surveys and Competencies)...

Actually, simpler: keep the original categories from the design doc. Place template article under cycles or create a templates subfolder. Let's use:

- Create: `content/help/getting-started/nami-bot.mdx` — "Getting Started", ["all"], order 2
- Create: `content/help/reviews/upward-feedback.mdx` — "Reviews", ["all"], order 3
- Create: `content/help/reviews/viewing-feedback.mdx` — "Reviews", ["all"], order 4
- Create: `content/help/cycles/lifecycle-explained.mdx` — "Cycles", ["all"], order 2
- Create: `content/help/cycles/templates.mdx` — "Cycles", ["hr", "admin"], order 3
- Create: `content/help/calibration/running-calibration.mdx` — "Calibration", ["hr", "admin"], order 1
- Create: `content/help/competencies/frameworks.mdx` — "Competencies", ["hr", "admin"], order 1

**Step 1:** Create directories and write each article (200-400 words each).

Run: `mkdir -p content/help/{calibration,competencies,templates}`

**Step 2: Verify build**

Run: `npm run build 2>&1 | tail -20`

**Step 3: Commit**

```bash
git add content/help/
git commit -m "feat(help): add Tier 2 articles — Nami, upward feedback, lifecycle, templates, calibration, competencies"
```

---

### Task 10: Write Tier 3-5 Articles (19 articles)

**Files:** Create remaining MDX files across all category directories:
- `content/help/goals/goal-setting-okrs.mdx` — "Goals", ["all"], order 1
- `content/help/team/my-team-dashboard.mdx` — "Team Management", ["manager"], order 3
- `content/help/surveys/creating-surveys.mdx` — "Surveys", ["hr", "admin"], order 1
- `content/help/analytics/understanding-analytics.mdx` — "Analytics", ["hr", "admin", "manager"], order 1
- `content/help/admin/departments-levels.mdx` — "Admin & Billing", ["admin"], order 1
- `content/help/cycles/deadline-reminders.mdx` — "Cycles", ["all"], order 4
- `content/help/reviews/continuous-feedback.mdx` — "Reviews", ["all"], order 5
- `content/help/admin/billing-plans.mdx` — "Admin & Billing", ["admin"], order 2
- `content/help/competencies/matrix-heatmap.mdx` — "Competencies", ["hr", "admin", "manager"], order 2
- `content/help/team/bulk-csv-import.mdx` — "Team Management", ["admin"], order 4
- `content/help/cycles/cycle-phases.mdx` — "Cycles", ["hr", "admin"], order 5
- `content/help/reviews/peer-review.mdx` — "Reviews", ["hr", "admin", "manager"], order 6
- `content/help/troubleshooting/faq.mdx` — "Troubleshooting", ["all"], order 1
- `content/help/admin/security-privacy.mdx` — "Admin & Billing", ["all"], order 3
- `content/help/surveys/enps-best-practices.mdx` — "Surveys", ["hr", "admin"], order 2
- `content/help/admin/rating-scale.mdx` — "Admin & Billing", ["admin"], order 4
- `content/help/cycles/first-cycle-playbook.mdx` — "Cycles", ["hr", "admin"], order 6
- `content/help/team/onboarding-mid-cycle.mdx` — "Team Management", ["hr", "admin"], order 5
- `content/help/calibration/year-end-playbook.mdx` — "Calibration", ["hr", "admin"], order 2

**Step 1:** Create directories and write each article. These can be shorter (150-300 words) for Tier 4-5 articles.

Run: `mkdir -p content/help/{goals,surveys,analytics,admin,troubleshooting}`

**Step 2: Verify build**

Run: `npm run build 2>&1 | tail -20`

**Step 3: Commit**

```bash
git add content/help/
git commit -m "feat(help): add Tier 3-5 articles — goals, surveys, analytics, admin, troubleshooting"
```

---

### Task 11: Final Verification & Polish

**Step 1: Run full build**

Run: `npm run build`
Expected: Clean build, all help routes generated.

**Step 2: Run dev server and manually verify**

Run: `npm run dev`

Verify:
- `/dashboard/help` redirects to first article
- Sidebar shows all categories with correct ordering
- Search filters articles by title/description
- Role tags display correctly on articles
- Callout components render with correct colors
- Mobile: sidebar opens as Sheet drawer
- Footer dropdown shows "Help Center" item
- Sidebar nav shows "Help" link at bottom

**Step 3: Run existing tests to ensure no regressions**

Run: `npm run test`
Expected: All existing tests pass.

**Step 4: Final commit if any polish needed**

```bash
git add -A
git commit -m "feat(help): polish and finalize help center"
```
