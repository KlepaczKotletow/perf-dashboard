"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
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
import { format } from "date-fns";
import { useState } from "react";
import { FunctionImportDialog } from "./function-import-dialog";
import { CycleImportDialog } from "./cycle-import-dialog";

interface Template {
  id: string;
  name: string;
  description: string | null;
  questions: any[] | null;
  content: any | null;
  template_type: string | null;
  is_system: boolean;
  is_default: boolean;
  created_at: string;
  creator?: { slack_name: string | null } | null;
}

// ── Competency Framework Card ──────────────────────────────────────────────

function FrameworkCard({ template }: { template: Template }) {
  const [expanded, setExpanded] = useState(false);
  const content = template.content as {
    competencies: Array<{
      name: string;
      description: string;
      category: string;
      is_core: boolean;
      levels: Record<string, { title: string; indicators: string[] }>;
    }>;
  } | null;

  const competencies = content?.competencies || [];
  const categories = [...new Set(competencies.map((c) => c.category))];

  return (
    <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-foreground">
                {template.name}
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
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="h-9 w-9 rounded-lg bg-violet-50 dark:bg-violet-950/30 flex items-center justify-center">
              <Layers className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 mt-3">
          <span className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">
              {competencies.length}
            </span>{" "}
            competencies
          </span>
          <span className="text-border">|</span>
          <span className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">5</span>{" "}
            levels
          </span>
        </div>

        {/* Category badges */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {categories.map((cat) => (
            <Badge key={cat} variant="secondary" className="text-[10px]">
              {cat}
            </Badge>
          ))}
        </div>
      </div>

      {/* Expandable preview */}
      {expanded && (
        <div className="border-t border-border/50 bg-muted/20 px-5 py-3">
          <div className="space-y-2">
            {competencies.map((comp) => (
              <div key={comp.name} className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-violet-500 mt-1.5 shrink-0" />
                <div>
                  <span className="text-xs font-medium text-foreground">
                    {comp.name}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1.5">
                    {comp.description}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-border/50 px-5 py-2.5 flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? "Hide preview" : "Preview competencies"}
        </button>
        <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
          <Link href={`/dashboard/competencies?import=${template.id}`}>
            Import
          </Link>
        </Button>
      </div>
    </div>
  );
}

// ── Function Template Card ────────────────────────────────────────────────

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

// ── Cycle Profile Card ─────────────────────────────────────────────────────

const CYCLE_TYPE_COLORS: Record<string, string> = {
  annual: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800",
  quarterly: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
  probation: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
  custom: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800",
};

function CycleProfileCard({ template }: { template: Template }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const content = template.content as {
    cycle_type: string;
    suggested_description: string;
    suggested_competency_categories: string[];
    review_template_name: string;
    phase_weights: number[];
  } | null;

  const cycleType = content?.cycle_type || "custom";
  const categories = content?.suggested_competency_categories || [];

  return (
    <>
      <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-foreground">
                  {template.name}
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
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge
                variant="outline"
                className={`text-[10px] capitalize ${CYCLE_TYPE_COLORS[cycleType] || CYCLE_TYPE_COLORS.custom}`}
              >
                {cycleType}
              </Badge>
            </div>
          </div>

          {/* Details */}
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="h-3 w-3" />
              <span>
                Review template:{" "}
                <span className="font-medium text-foreground">
                  {content?.review_template_name || "None"}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Layers className="h-3 w-3" />
              <span>
                Categories:{" "}
                {categories.map((cat, i) => (
                  <span key={cat}>
                    {i > 0 && ", "}
                    <span className="font-medium text-foreground">{cat}</span>
                  </span>
                ))}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border/50 px-5 py-2.5 flex items-center justify-end">
          <Button
            variant="default"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setDialogOpen(true)}
          >
            Use Template
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </div>

      <CycleImportDialog
        template={template}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}

// ── Review Template Row ────────────────────────────────────────────────────

function ReviewTemplateRow({ template }: { template: Template }) {
  return (
    <div className="grid grid-cols-[1fr_80px_140px_120px_160px] items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors group">
      {/* Name + description + badges */}
      <Link href={`/dashboard/templates/${template.id}`} className="min-w-0 block">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
            {template.name}
          </span>
          {template.is_default && (
            <Badge variant="secondary" className="text-[10px] shrink-0">
              Default
            </Badge>
          )}
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
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {template.description}
          </p>
        )}
      </Link>

      {/* Question count */}
      <span className="text-sm text-foreground text-center tabular-nums">
        {Array.isArray(template.questions) ? template.questions.length : 0}
      </span>

      {/* Creator */}
      <span className="text-sm text-muted-foreground truncate">
        {template.creator?.slack_name || "System"}
      </span>

      {/* Date */}
      <span className="text-sm text-muted-foreground">
        {format(new Date(template.created_at), "MMM d, yyyy")}
      </span>

      {/* Use Template button */}
      <div className="flex items-center justify-end">
        <Button variant="default" size="sm" className="h-7 text-xs" asChild>
          <Link href={`/dashboard/cycles/new?reviewTemplate=${template.id}`}>
            Use Template
          </Link>
        </Button>
      </div>
    </div>
  );
}

// ── Main Client Component ──────────────────────────────────────────────────

export default function TemplatesClient({
  templates,
  workspaceId,
}: {
  templates: Template[];
  workspaceId: string;
}) {
  const [search, setSearch] = useState("");

  const searchLower = search.toLowerCase();
  const matchesSearch = (t: any) =>
    !search ||
    t.name?.toLowerCase().includes(searchLower) ||
    t.description?.toLowerCase().includes(searchLower);

  const reviewTemplates = templates.filter(
    (t) => (!t.template_type || t.template_type === "review") && matchesSearch(t)
  );
  const frameworkTemplates = templates.filter(
    (t) => t.template_type === "competency_framework" && matchesSearch(t)
  );
  const cycleProfileTemplates = templates.filter(
    (t) => t.template_type === "cycle_profile" && matchesSearch(t)
  );
  const goalTemplates = templates.filter(
    (t) => t.template_type === "goal_template" && matchesSearch(t)
  );
  const functionTemplates = templates.filter(
    (t) => t.template_type === "function_template" && matchesSearch(t)
  );

  return (
    <Tabs defaultValue="reviews" className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <TabsList>
        <TabsTrigger value="reviews" className="gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          Review Templates
          <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">
            {reviewTemplates.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="functions" className="gap-1.5">
          <Briefcase className="h-3.5 w-3.5" />
          Function Templates
          <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">
            {functionTemplates.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="frameworks" className="gap-1.5">
          <Layers className="h-3.5 w-3.5" />
          Competency Frameworks
          <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">
            {frameworkTemplates.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="cycles" className="gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          Cycle Profiles
          <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">
            {cycleProfileTemplates.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="goal_templates" className="gap-1.5">
          <Target className="h-3.5 w-3.5" />
          Goal Templates
          <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">
            {goalTemplates.length}
          </Badge>
        </TabsTrigger>
      </TabsList>

      {/* ── Review Templates Tab ── */}
      <TabsContent value="reviews">
        {reviewTemplates.length === 0 ? (
          <div className="rounded-lg border border-border/60 bg-card py-16 text-center">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              No review templates yet
            </p>
            <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
              Create your first template to customise review questions for a
              cycle.
            </p>
            <Button size="sm" asChild>
              <Link href="/dashboard/templates/new">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Create Template
              </Link>
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-border/60 bg-card divide-y divide-border/50 overflow-hidden">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_80px_140px_120px_160px] items-center gap-4 px-5 py-2.5 bg-muted/40">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Name
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-center">
                Questions
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Created by
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Created
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">
                Actions
              </span>
            </div>
            {reviewTemplates.map((template) => (
              <ReviewTemplateRow key={template.id} template={template} />
            ))}
          </div>
        )}
      </TabsContent>

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

      {/* ── Competency Frameworks Tab ── */}
      <TabsContent value="frameworks">
        {frameworkTemplates.length === 0 ? (
          <div className="rounded-lg border border-border/60 bg-card py-16 text-center">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Layers className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              No competency frameworks yet
            </p>
            <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
              Competency frameworks define the skills and behaviors your team is
              evaluated on.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {frameworkTemplates.map((template) => (
              <FrameworkCard key={template.id} template={template} />
            ))}
          </div>
        )}
      </TabsContent>

      {/* ── Cycle Profiles Tab ── */}
      <TabsContent value="cycles">
        {cycleProfileTemplates.length === 0 ? (
          <div className="rounded-lg border border-border/60 bg-card py-16 text-center">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              No cycle profiles yet
            </p>
            <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
              Cycle profiles are pre-configured review cycle setups you can use
              as starting points.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {cycleProfileTemplates.map((template) => (
              <CycleProfileCard key={template.id} template={template} />
            ))}
          </div>
        )}
      </TabsContent>

      {/* ── Goal Templates Tab ── */}
      <TabsContent value="goal_templates">
        {goalTemplates.length === 0 ? (
          <div className="rounded-lg border border-border/60 bg-card py-16 text-center">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Target className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              No goal templates yet
            </p>
            <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
              Goal templates provide pre-configured starting points for creating goals.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {goalTemplates.map((tpl) => {
              const content = tpl.content as any;
              return (
                <Card key={tpl.id} className="border-border/60 hover:shadow-md transition-shadow">
                  <CardContent className="pt-5 pb-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{tpl.name}</h3>
                        {tpl.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tpl.description}</p>
                        )}
                      </div>
                      {tpl.is_system && (
                        <Badge variant="outline" className="text-[10px] shrink-0">System</Badge>
                      )}
                    </div>
                    {content && (
                      <div className="space-y-1">
                        {content.title && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Title:</span> {content.title}
                          </p>
                        )}
                        {content.scope && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Scope:</span> {content.scope}
                          </p>
                        )}
                        {content.metric_unit && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Metric:</span> {content.metric_start ?? 0} → {content.metric_target} {content.metric_unit}
                          </p>
                        )}
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" className="text-xs h-7" asChild>
                        <Link href={`/dashboard/templates/${tpl.id}`}>View</Link>
                      </Button>
                      <Button size="sm" variant="default" className="text-xs h-7" asChild>
                        <Link href={`/dashboard/goals/new?templateId=${tpl.id}`}>
                          Use Template
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
