# Function Template Import — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 8 one-click function templates that create a complete function (job_family + levels + competencies + expected scores) in the user's workspace.

**Architecture:** Static template data defined in `page.tsx`, seeded to the `templates` table per workspace. A new `FunctionTemplateCard` component shows preview + "Use Template" button. A new `FunctionImportDialog` handles duplicate checks and sequential DB inserts (job_family → levels → competencies → level_competencies). No schema changes needed.

**Tech Stack:** Next.js, React, Supabase client SDK, shadcn/ui components, Tailwind CSS

---

### Task 1: Define the 8 SYSTEM_FUNCTION_TEMPLATES constants

**Files:**
- Modify: `src/app/dashboard/templates/page.tsx:82-282` (replace `SYSTEM_COMPETENCY_FRAMEWORKS`)

**Step 1: Replace `SYSTEM_COMPETENCY_FRAMEWORKS` with `SYSTEM_FUNCTION_TEMPLATES`**

Delete lines 82-282 (the entire `SYSTEM_COMPETENCY_FRAMEWORKS` array) and replace with the new `SYSTEM_FUNCTION_TEMPLATES` array. Each template has the shape:

```ts
const SYSTEM_FUNCTION_TEMPLATES = [
  {
    name: "Software Engineering",
    description: "Career framework for software engineers covering coding, architecture, and technical leadership.",
    content: {
      function_name: "Software Engineering",
      function_description: "Career framework for software engineers covering coding, architecture, and technical leadership.",
      levels: [
        { name: "Junior", sort_order: 0 },
        { name: "Mid", sort_order: 1 },
        { name: "Senior", sort_order: 2 },
        { name: "Staff", sort_order: 3 },
        { name: "Principal", sort_order: 4 },
      ],
      competencies: [
        {
          name: "Coding & Quality",
          description: "Writing clean, maintainable, well-tested code with appropriate documentation",
          category: "Technical",
          expected_scores: [1, 2, 3, 4, 5],
        },
        {
          name: "System Design",
          description: "Designing scalable, reliable, and maintainable systems and APIs",
          category: "Technical",
          expected_scores: [1, 2, 3, 4, 5],
        },
        {
          name: "Debugging & Problem Solving",
          description: "Diagnosing and resolving complex technical issues efficiently",
          category: "Technical",
          expected_scores: [1, 2, 3, 4, 5],
        },
        {
          name: "Delivery & Execution",
          description: "Shipping quality work on time and managing project scope effectively",
          category: "Execution",
          expected_scores: [1, 2, 3, 4, 5],
        },
        {
          name: "Communication",
          description: "Expressing ideas clearly and collaborating effectively across teams",
          category: "Leadership",
          expected_scores: [1, 2, 3, 4, 4],
        },
        {
          name: "Mentorship & Leadership",
          description: "Growing others and building team capabilities through guidance and teaching",
          category: "Leadership",
          expected_scores: [1, 1, 2, 3, 4],
        },
      ],
    },
  },
  {
    name: "Product Management",
    description: "Career framework for product managers covering strategy, discovery, execution, and stakeholder management.",
    content: {
      function_name: "Product Management",
      function_description: "Career framework for product managers covering strategy, discovery, execution, and stakeholder management.",
      levels: [
        { name: "Associate PM", sort_order: 0 },
        { name: "PM", sort_order: 1 },
        { name: "Senior PM", sort_order: 2 },
        { name: "Lead PM", sort_order: 3 },
        { name: "Director", sort_order: 4 },
      ],
      competencies: [
        {
          name: "Product Strategy",
          description: "Defining product vision, roadmap, and competitive positioning",
          category: "Strategic",
          expected_scores: [1, 2, 3, 4, 5],
        },
        {
          name: "User Research & Empathy",
          description: "Deeply understanding user needs, pain points, and behaviors through research",
          category: "Strategic",
          expected_scores: [1, 2, 3, 4, 4],
        },
        {
          name: "Data-Driven Decisions",
          description: "Using quantitative and qualitative data to inform product choices",
          category: "Analytical",
          expected_scores: [1, 2, 3, 4, 5],
        },
        {
          name: "Execution & Delivery",
          description: "Shipping products on time with quality through effective project management",
          category: "Execution",
          expected_scores: [1, 2, 3, 4, 4],
        },
        {
          name: "Stakeholder Management",
          description: "Building alignment and managing expectations across the organization",
          category: "Leadership",
          expected_scores: [1, 2, 3, 4, 5],
        },
        {
          name: "Technical Fluency",
          description: "Understanding technology well enough to make informed product decisions",
          category: "Technical",
          expected_scores: [1, 2, 3, 3, 4],
        },
      ],
    },
  },
  {
    name: "Design",
    description: "Career framework for designers covering visual design, UX research, interaction design, and design systems.",
    content: {
      function_name: "Design",
      function_description: "Career framework for designers covering visual design, UX research, interaction design, and design systems.",
      levels: [
        { name: "Junior Designer", sort_order: 0 },
        { name: "Mid Designer", sort_order: 1 },
        { name: "Senior Designer", sort_order: 2 },
        { name: "Lead Designer", sort_order: 3 },
        { name: "Design Director", sort_order: 4 },
      ],
      competencies: [
        {
          name: "Visual & UI Design",
          description: "Creating polished, accessible interfaces with strong typography, color, and layout",
          category: "Craft",
          expected_scores: [1, 2, 3, 4, 4],
        },
        {
          name: "UX Research & Testing",
          description: "Planning and conducting user research to validate design decisions",
          category: "Research",
          expected_scores: [1, 2, 3, 4, 5],
        },
        {
          name: "Interaction Design",
          description: "Designing intuitive user flows, micro-interactions, and navigation patterns",
          category: "Craft",
          expected_scores: [1, 2, 3, 4, 4],
        },
        {
          name: "Design Systems",
          description: "Building and maintaining scalable component libraries and design tokens",
          category: "Technical",
          expected_scores: [1, 2, 3, 4, 5],
        },
        {
          name: "Prototyping & Tools",
          description: "Rapidly creating interactive prototypes to communicate and test ideas",
          category: "Craft",
          expected_scores: [1, 2, 3, 3, 3],
        },
        {
          name: "Design Communication",
          description: "Presenting design rationale and facilitating productive design critiques",
          category: "Leadership",
          expected_scores: [1, 2, 3, 4, 5],
        },
      ],
    },
  },
  {
    name: "Marketing",
    description: "Career framework for marketers covering campaign strategy, content, analytics, and brand management.",
    content: {
      function_name: "Marketing",
      function_description: "Career framework for marketers covering campaign strategy, content, analytics, and brand management.",
      levels: [
        { name: "Coordinator", sort_order: 0 },
        { name: "Specialist", sort_order: 1 },
        { name: "Manager", sort_order: 2 },
        { name: "Senior Manager", sort_order: 3 },
        { name: "Director", sort_order: 4 },
      ],
      competencies: [
        {
          name: "Campaign Strategy",
          description: "Planning and executing multi-channel marketing campaigns aligned to business goals",
          category: "Strategic",
          expected_scores: [1, 2, 3, 4, 5],
        },
        {
          name: "Content & Storytelling",
          description: "Creating compelling content that resonates with target audiences across channels",
          category: "Creative",
          expected_scores: [1, 2, 3, 4, 4],
        },
        {
          name: "Analytics & Attribution",
          description: "Measuring marketing impact, attribution modeling, and data-driven optimization",
          category: "Analytical",
          expected_scores: [1, 2, 3, 4, 5],
        },
        {
          name: "Channel Management",
          description: "Managing and optimizing performance across paid, owned, and earned media channels",
          category: "Execution",
          expected_scores: [1, 2, 3, 4, 4],
        },
        {
          name: "Brand & Positioning",
          description: "Developing and maintaining brand identity, messaging, and competitive positioning",
          category: "Strategic",
          expected_scores: [1, 2, 3, 4, 5],
        },
        {
          name: "Cross-Functional Collaboration",
          description: "Working effectively with sales, product, and other teams to drive business outcomes",
          category: "Leadership",
          expected_scores: [1, 1, 2, 3, 4],
        },
      ],
    },
  },
  {
    name: "Sales",
    description: "Career framework for sales professionals covering prospecting, negotiation, pipeline management, and account growth.",
    content: {
      function_name: "Sales",
      function_description: "Career framework for sales professionals covering prospecting, negotiation, pipeline management, and account growth.",
      levels: [
        { name: "SDR", sort_order: 0 },
        { name: "Account Executive", sort_order: 1 },
        { name: "Senior AE", sort_order: 2 },
        { name: "Lead AE", sort_order: 3 },
        { name: "Sales Director", sort_order: 4 },
      ],
      competencies: [
        {
          name: "Prospecting & Pipeline",
          description: "Building and managing a healthy sales pipeline through outbound and inbound activities",
          category: "Execution",
          expected_scores: [1, 2, 3, 4, 4],
        },
        {
          name: "Discovery & Qualification",
          description: "Uncovering customer needs and qualifying opportunities using structured frameworks",
          category: "Execution",
          expected_scores: [1, 2, 3, 4, 5],
        },
        {
          name: "Negotiation & Closing",
          description: "Structuring proposals, navigating procurement, and closing deals effectively",
          category: "Execution",
          expected_scores: [1, 2, 3, 4, 5],
        },
        {
          name: "Product & Market Knowledge",
          description: "Deep understanding of the product, competitive landscape, and industry trends",
          category: "Strategic",
          expected_scores: [1, 2, 3, 4, 5],
        },
        {
          name: "Account Management",
          description: "Growing existing accounts through renewals, upsells, and strategic relationship building",
          category: "Strategic",
          expected_scores: [1, 2, 3, 4, 4],
        },
        {
          name: "Communication & Influence",
          description: "Presenting solutions persuasively and building trusted advisor relationships",
          category: "Leadership",
          expected_scores: [1, 2, 3, 4, 5],
        },
      ],
    },
  },
  {
    name: "Customer Success",
    description: "Career framework for customer success covering onboarding, retention, escalation management, and customer advocacy.",
    content: {
      function_name: "Customer Success",
      function_description: "Career framework for customer success covering onboarding, retention, escalation management, and customer advocacy.",
      levels: [
        { name: "CS Associate", sort_order: 0 },
        { name: "CSM", sort_order: 1 },
        { name: "Senior CSM", sort_order: 2 },
        { name: "Lead CSM", sort_order: 3 },
        { name: "CS Director", sort_order: 4 },
      ],
      competencies: [
        {
          name: "Onboarding & Adoption",
          description: "Guiding new customers to value through structured onboarding and adoption programs",
          category: "Execution",
          expected_scores: [1, 2, 3, 4, 4],
        },
        {
          name: "Retention & Renewals",
          description: "Driving customer retention through proactive engagement and renewal management",
          category: "Strategic",
          expected_scores: [1, 2, 3, 4, 5],
        },
        {
          name: "Escalation Management",
          description: "Handling customer escalations with urgency, empathy, and effective resolution",
          category: "Execution",
          expected_scores: [1, 2, 3, 4, 5],
        },
        {
          name: "Product Expertise",
          description: "Deep knowledge of the product to guide customers toward best practices and solutions",
          category: "Technical",
          expected_scores: [1, 2, 3, 4, 4],
        },
        {
          name: "Customer Advocacy",
          description: "Representing the voice of the customer internally to influence product and business decisions",
          category: "Strategic",
          expected_scores: [1, 2, 3, 4, 5],
        },
        {
          name: "Relationship Building",
          description: "Building and maintaining trusted, long-term relationships with key stakeholders",
          category: "Leadership",
          expected_scores: [1, 2, 3, 4, 5],
        },
      ],
    },
  },
  {
    name: "Data & Analytics",
    description: "Career framework for data professionals covering data modeling, statistical analysis, visualization, and business insight.",
    content: {
      function_name: "Data & Analytics",
      function_description: "Career framework for data professionals covering data modeling, statistical analysis, visualization, and business insight.",
      levels: [
        { name: "Junior Analyst", sort_order: 0 },
        { name: "Analyst", sort_order: 1 },
        { name: "Senior Analyst", sort_order: 2 },
        { name: "Lead Analyst", sort_order: 3 },
        { name: "Analytics Director", sort_order: 4 },
      ],
      competencies: [
        {
          name: "Data Modeling & SQL",
          description: "Designing data models and writing efficient queries to extract and transform data",
          category: "Technical",
          expected_scores: [1, 2, 3, 4, 4],
        },
        {
          name: "Statistical Analysis",
          description: "Applying statistical methods, hypothesis testing, and experimentation to generate insights",
          category: "Technical",
          expected_scores: [1, 2, 3, 4, 5],
        },
        {
          name: "Data Visualization",
          description: "Creating clear, compelling visualizations and dashboards that drive action",
          category: "Craft",
          expected_scores: [1, 2, 3, 4, 4],
        },
        {
          name: "Business Acumen",
          description: "Translating business questions into analytical frameworks and actionable recommendations",
          category: "Strategic",
          expected_scores: [1, 2, 3, 4, 5],
        },
        {
          name: "Data Engineering",
          description: "Building and maintaining data pipelines, ETL processes, and data quality systems",
          category: "Technical",
          expected_scores: [1, 2, 3, 4, 4],
        },
        {
          name: "Stakeholder Communication",
          description: "Presenting data insights to non-technical audiences and influencing decisions",
          category: "Leadership",
          expected_scores: [1, 1, 2, 3, 4],
        },
      ],
    },
  },
  {
    name: "People & HR",
    description: "Career framework for HR professionals covering talent acquisition, employee relations, L&D, and people operations.",
    content: {
      function_name: "People & HR",
      function_description: "Career framework for HR professionals covering talent acquisition, employee relations, L&D, and people operations.",
      levels: [
        { name: "HR Coordinator", sort_order: 0 },
        { name: "HR Specialist", sort_order: 1 },
        { name: "HR Manager", sort_order: 2 },
        { name: "Senior HR Manager", sort_order: 3 },
        { name: "HR Director", sort_order: 4 },
      ],
      competencies: [
        {
          name: "Talent Acquisition",
          description: "Sourcing, interviewing, and hiring top talent through effective recruitment processes",
          category: "Execution",
          expected_scores: [1, 2, 3, 4, 4],
        },
        {
          name: "Employee Relations",
          description: "Managing employee concerns, conflict resolution, and fostering a positive workplace culture",
          category: "Execution",
          expected_scores: [1, 2, 3, 4, 5],
        },
        {
          name: "Learning & Development",
          description: "Designing and delivering training programs that build organizational capability",
          category: "Strategic",
          expected_scores: [1, 2, 3, 4, 5],
        },
        {
          name: "Compensation & Benefits",
          description: "Managing total rewards programs, benchmarking, and pay equity analysis",
          category: "Technical",
          expected_scores: [1, 2, 3, 4, 4],
        },
        {
          name: "HR Operations & Compliance",
          description: "Ensuring smooth HR operations, policy development, and regulatory compliance",
          category: "Technical",
          expected_scores: [1, 2, 3, 4, 5],
        },
        {
          name: "People Analytics",
          description: "Using workforce data to inform decisions on retention, engagement, and organizational design",
          category: "Analytical",
          expected_scores: [1, 1, 2, 3, 4],
        },
      ],
    },
  },
];
```

**Step 2: Commit**

```bash
git add src/app/dashboard/templates/page.tsx
git commit -m "feat: define 8 function templates with levels, competencies, and expected scores"
```

---

### Task 2: Update seeding to include function templates

**Files:**
- Modify: `src/app/dashboard/templates/page.tsx:885-949` (the `seedSystemTemplates` function)

**Step 1: Add function template seeding rows**

In the `seedSystemTemplates` function, after the `frameworkRows` block (line ~921), add:

```ts
  // Seed function templates
  const functionRows = SYSTEM_FUNCTION_TEMPLATES
    .filter((t) => !existingNames.has(t.name))
    .map((t) => ({
      workspace_id: workspaceId,
      name: t.name,
      description: t.description,
      content: t.content,
      template_type: "function_template",
      is_system: true,
      is_default: false,
    }));
```

**Step 2: Add `functionRows` to the `allRows` array**

Change line ~945 from:
```ts
  const allRows = [...reviewRows, ...frameworkRows, ...cycleRows, ...goalRows];
```
to:
```ts
  const allRows = [...reviewRows, ...frameworkRows, ...functionRows, ...cycleRows, ...goalRows];
```

**Step 3: Commit**

```bash
git add src/app/dashboard/templates/page.tsx
git commit -m "feat: seed function templates into templates table per workspace"
```

---

### Task 3: Create the FunctionImportDialog component

**Files:**
- Create: `src/app/dashboard/templates/function-import-dialog.tsx`

**Step 1: Create the dialog component**

This dialog handles:
1. Displaying the function preview (levels × competencies matrix with expected scores)
2. Checking for duplicate function names in the workspace
3. Sequential DB inserts: job_family → levels → competencies → level_competencies
4. Redirecting to `/dashboard/admin/functions` on success

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Briefcase,
  Layers,
  Target,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FunctionTemplateLevel {
  name: string;
  sort_order: number;
}

interface FunctionTemplateCompetency {
  name: string;
  description: string;
  category: string;
  expected_scores: number[];
}

interface FunctionTemplateContent {
  function_name: string;
  function_description: string;
  levels: FunctionTemplateLevel[];
  competencies: FunctionTemplateCompetency[];
}

interface FunctionImportDialogProps {
  template: {
    id: string;
    name: string;
    description: string;
    content: any;
  };
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Score color helper ────────────────────────────────────────────────────────

const scoreColors: Record<number, string> = {
  1: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  2: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  3: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  4: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  5: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

// ── Main dialog ───────────────────────────────────────────────────────────────

export function FunctionImportDialog({
  template,
  workspaceId,
  open,
  onOpenChange,
}: FunctionImportDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<boolean | null>(null);
  const [checked, setChecked] = useState(false);

  const content = template.content as FunctionTemplateContent | undefined;
  const levels = content?.levels ?? [];
  const competencies = content?.competencies ?? [];

  // ── Duplicate check ───────────────────────────────────────────────────────

  async function checkDuplicate() {
    setError(null);
    try {
      const supabase = createClient();
      const { data: existing, error: fetchError } = await supabase
        .from("job_families")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("name", content?.function_name ?? "")
        .limit(1);

      if (fetchError) throw fetchError;
      setDuplicate((existing?.length ?? 0) > 0);
      setChecked(true);
    } catch (err: any) {
      console.error("Error checking duplicate:", err);
      setError("Failed to check for existing functions. Please try again.");
    }
  }

  // ── Import logic ──────────────────────────────────────────────────────────

  async function handleImport(useCopySuffix = false) {
    if (!content) return;
    setImporting(true);
    setError(null);

    try {
      const supabase = createClient();
      const functionName = useCopySuffix
        ? `${content.function_name} (Copy)`
        : content.function_name;

      // 1. Create job_family
      const { data: jobFamily, error: jfError } = await supabase
        .from("job_families")
        .insert({
          workspace_id: workspaceId,
          name: functionName,
          description: content.function_description,
        })
        .select("id")
        .single();

      if (jfError) throw jfError;
      const jobFamilyId = jobFamily.id;

      // 2. Create levels
      const levelRows = content.levels.map((l) => ({
        workspace_id: workspaceId,
        job_family_id: jobFamilyId,
        name: l.name,
        sort_order: l.sort_order,
      }));

      const { data: insertedLevels, error: lvlError } = await supabase
        .from("levels")
        .insert(levelRows)
        .select("id, sort_order");

      if (lvlError) throw lvlError;

      // Sort by sort_order so indices match content.levels
      const sortedLevels = (insertedLevels || []).sort(
        (a: any, b: any) => a.sort_order - b.sort_order
      );

      // 3. Create competencies
      const compRows = content.competencies.map((c) => ({
        workspace_id: workspaceId,
        job_family_id: jobFamilyId,
        name: c.name,
        description: c.description,
        category: c.category,
        is_core: false,
      }));

      const { data: insertedComps, error: compError } = await supabase
        .from("competencies")
        .insert(compRows)
        .select("id, name");

      if (compError) throw compError;

      // 4. Create level_competencies (expected scores matrix)
      const levelCompRows: any[] = [];
      for (const comp of insertedComps || []) {
        // Find the template competency to get expected_scores
        const templateComp = content.competencies.find(
          (c) => c.name === comp.name
        );
        if (!templateComp) continue;

        for (let i = 0; i < sortedLevels.length; i++) {
          const score = templateComp.expected_scores[i];
          if (score != null) {
            levelCompRows.push({
              workspace_id: workspaceId,
              level_id: sortedLevels[i].id,
              competency_id: comp.id,
              expected_level: score,
            });
          }
        }
      }

      if (levelCompRows.length > 0) {
        const { error: lcError } = await supabase
          .from("level_competencies")
          .insert(levelCompRows);
        if (lcError) throw lcError;
      }

      toast({
        title: "Function created",
        description: `"${functionName}" with ${levels.length} levels and ${competencies.length} skills has been added to your workspace.`,
      });

      onOpenChange(false);
      router.push("/dashboard/admin/functions");
      router.refresh();
    } catch (err: any) {
      console.error("Error importing function template:", err);
      setError(
        err?.message || "Failed to create function. Please try again."
      );
    } finally {
      setImporting(false);
    }
  }

  // ── Reset state when dialog closes ────────────────────────────────────────

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setDuplicate(null);
      setChecked(false);
      setError(null);
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            {content?.function_name ?? template.name}
          </DialogTitle>
          <DialogDescription>{template.description}</DialogDescription>
        </DialogHeader>

        {/* ── Stats row ── */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground py-1">
          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            {levels.length} levels
          </div>
          <div className="flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5" />
            {competencies.length} competencies
          </div>
        </div>

        {/* ── Matrix preview ── */}
        <div className="flex-1 min-h-0 overflow-auto -mx-6 px-6">
          <div className="border border-border/60 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/40">
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-[200px]">
                    Competency
                  </th>
                  {levels.map((level) => (
                    <th
                      key={level.sort_order}
                      className="text-center px-2 py-2 font-semibold text-muted-foreground"
                    >
                      {level.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {competencies.map((comp) => (
                  <tr key={comp.name} className="hover:bg-muted/20">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {comp.name}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[9px] shrink-0"
                        >
                          {comp.category}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mt-0.5 line-clamp-1">
                        {comp.description}
                      </p>
                    </td>
                    {comp.expected_scores.map((score, i) => (
                      <td key={i} className="text-center px-2 py-2.5">
                        <span
                          className={`inline-flex items-center justify-center h-6 w-6 rounded-md text-[11px] font-bold ${
                            scoreColors[score] || ""
                          }`}
                        >
                          {score}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Duplicate warning ── */}
        {checked && duplicate && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  A function named &quot;{content?.function_name}&quot; already exists
                </p>
                <p className="text-amber-700 dark:text-amber-400/80 text-xs mt-0.5">
                  You can create it with a different name or cancel.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 ml-6">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => handleImport(true)}
                disabled={importing}
              >
                {importing && (
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                )}
                Create as &quot;{content?.function_name} (Copy)&quot;
              </Button>
            </div>
          </div>
        )}

        {/* ── Ready state ── */}
        {checked && !duplicate && !error && (
          <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg px-4 py-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Ready to create &quot;{content?.function_name}&quot; with{" "}
            {levels.length} levels and {competencies.length} skills.
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/20 rounded-lg px-4 py-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* ── Footer actions ── */}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>

          {!checked ? (
            <Button onClick={checkDuplicate}>
              <Briefcase className="h-4 w-4 mr-2" />
              Use Template
            </Button>
          ) : !duplicate ? (
            <Button onClick={() => handleImport(false)} disabled={importing}>
              {importing && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {importing ? "Creating..." : "Create Function"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/dashboard/templates/function-import-dialog.tsx
git commit -m "feat: add FunctionImportDialog for one-click function creation from templates"
```

---

### Task 4: Add FunctionTemplateCard and update the templates client

**Files:**
- Modify: `src/app/dashboard/templates/templates-client.tsx`

**Step 1: Add the FunctionImportDialog import at the top of the file**

After the existing imports (around line 20), add:

```tsx
import { FunctionImportDialog } from "./function-import-dialog";
```

**Step 2: Add `workspaceId` to the component props**

Change the `TemplatesClient` component signature (line ~300) to accept `workspaceId`:

```tsx
export default function TemplatesClient({
  templates,
  workspaceId,
}: {
  templates: Template[];
  workspaceId: string;
}) {
```

**Step 3: Add FunctionTemplateCard component**

Add this new component after `FrameworkCard` (around line 146):

```tsx
function FunctionTemplateCard({
  template,
  workspaceId,
}: {
  template: Template;
  workspaceId: string;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const content = template.content as {
    function_name: string;
    function_description: string;
    levels: Array<{ name: string; sort_order: number }>;
    competencies: Array<{
      name: string;
      description: string;
      category: string;
      expected_scores: number[];
    }>;
  } | null;

  const levels = content?.levels || [];
  const competencies = content?.competencies || [];
  const categories = [...new Set(competencies.map((c) => c.category))];

  return (
    <>
      <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-foreground">
                  {content?.function_name || template.name}
                </span>
                {template.is_system && (
                  <Badge
                    variant="outline"
                    className="text-[10px] shrink-0 border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-400"
                  >
                    System
                  </Badge>
                )}
              </div>
              {template.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {template.description}
                </p>
              )}
            </div>
            <div className="h-9 w-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center shrink-0">
              <Briefcase className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 mt-3">
            <span className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">
                {levels.length}
              </span>{" "}
              levels
            </span>
            <span className="text-border">|</span>
            <span className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">
                {competencies.length}
              </span>{" "}
              skills
            </span>
          </div>

          {/* Level names */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {levels.map((l) => (
              <Badge key={l.sort_order} variant="secondary" className="text-[10px]">
                {l.name}
              </Badge>
            ))}
          </div>

          {/* Category badges */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {categories.map((cat) => (
              <Badge key={cat} variant="outline" className="text-[10px]">
                {cat}
              </Badge>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border/50 px-5 py-2.5 flex items-center justify-end">
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => setDialogOpen(true)}
          >
            Use Template
          </Button>
        </div>
      </div>

      <FunctionImportDialog
        template={template}
        workspaceId={workspaceId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
```

**Step 4: Add the `Briefcase` icon import**

In the lucide-react import (around line 13), add `Briefcase`:

```tsx
import {
  FileText,
  Plus,
  ChevronRight,
  Layers,
  Calendar,
  ArrowRight,
  Search,
  X,
  Target,
  Briefcase,
} from "lucide-react";
```

**Step 5: Add function template filtering and tab**

In the `TemplatesClient` component body (after line ~323 where `goalTemplates` is defined), add:

```tsx
  const functionTemplates = templates.filter(
    (t) => t.template_type === "function_template" && matchesSearch(t)
  );
```

Then add a new `TabsTrigger` inside the `TabsList` (after the "Competency Frameworks" trigger, around line 361):

```tsx
        <TabsTrigger value="functions" className="gap-1.5">
          <Briefcase className="h-3.5 w-3.5" />
          Function Templates
          <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">
            {functionTemplates.length}
          </Badge>
        </TabsTrigger>
```

And add the corresponding `TabsContent` (after the frameworks tab content, around line 445):

```tsx
      {/* ── Function Templates Tab ── */}
      <TabsContent value="functions">
        {functionTemplates.length === 0 ? (
          <div className="rounded-lg border border-border/60 bg-card py-16 text-center">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Briefcase className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              No function templates yet
            </p>
            <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
              Function templates let you create a complete competency matrix with one click.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {functionTemplates.map((template) => (
              <FunctionTemplateCard
                key={template.id}
                template={template}
                workspaceId={workspaceId}
              />
            ))}
          </div>
        )}
      </TabsContent>
```

**Step 6: Commit**

```bash
git add src/app/dashboard/templates/templates-client.tsx
git commit -m "feat: add Function Templates tab with FunctionTemplateCard and import dialog"
```

---

### Task 5: Pass workspaceId from server page to client

**Files:**
- Modify: `src/app/dashboard/templates/page.tsx:1015` (the TemplatesClient usage)

**Step 1: Pass workspaceId prop**

Change line 1015 from:
```tsx
      <TemplatesClient templates={templates} />
```
to:
```tsx
      <TemplatesClient templates={templates} workspaceId={workspaceId} />
```

**Step 2: Update the page description text**

Change line 1003 from:
```tsx
            Review templates, competency frameworks, cycle profiles, and goal templates
```
to:
```tsx
            Review templates, function templates, competency frameworks, cycle profiles, and goal templates
```

**Step 3: Commit**

```bash
git add src/app/dashboard/templates/page.tsx
git commit -m "feat: pass workspaceId to TemplatesClient for function template import"
```

---

### Task 6: Verify the full flow works

**Step 1: Start the dev server**

Run: `npm run dev`

**Step 2: Navigate to Templates page**

Go to `/dashboard/templates` and verify:
- New "Function Templates" tab appears
- 8 template cards display with correct names, level counts, skill counts, and badges
- Cards show level names as badges

**Step 3: Test the import flow**

- Click "Use Template" on "Software Engineering"
- Verify the dialog shows the matrix preview with colored score badges
- Click "Use Template" button in the dialog
- Verify the green "Ready to create" message appears
- Click "Create Function"
- Verify redirect to `/dashboard/admin/functions`
- Verify "Software Engineering" function exists with 5 levels, 6 skills, and all expected scores filled in

**Step 4: Test duplicate handling**

- Go back to Templates and try importing "Software Engineering" again
- Verify the amber "already exists" warning appears
- Verify the "Create as Copy" option works

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: address any issues found during verification"
```

---

### Task 7: Clean up old framework import (optional)

**Files:**
- Delete: `src/app/dashboard/templates/framework-import-dialog.tsx`
- Modify: `src/app/dashboard/templates/templates-client.tsx` (remove FrameworkCard if no longer referenced)

**Step 1: Check if FrameworkCard or framework-import-dialog are still used**

Search for any imports or references to `framework-import-dialog` or `FrameworkCard` in the codebase.

**Step 2: If unused, remove the old file and component**

Only remove if there are zero references outside of the templates client itself.

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: remove unused framework-import-dialog in favor of function templates"
```
