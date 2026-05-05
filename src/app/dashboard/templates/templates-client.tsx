"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  FileText,
  ChevronRight,
  Layers,
  Calendar,
  Search,
  X,
  Target,
  Briefcase,
  ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { FunctionImportDialog } from "./function-import-dialog";
import { FrameworkImportDialog } from "./framework-import-dialog";

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Proficiency colors (shared with functions page) ──────────────────────────

const proficiencyColors: Record<number, string> = {
  1: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/40",
  2: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800/40",
  3: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800/40",
  4: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/40",
  5: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/40",
};

// ── Section icon tint per template type ──────────────────────────────────────

const SECTION_TINT: Record<string, { bg: string; fg: string }> = {
  function_template:     { bg: "bg-sky-50 dark:bg-sky-400/10",       fg: "text-sky-600 dark:text-sky-400" },
  review:                { bg: "bg-violet-50 dark:bg-violet-400/10", fg: "text-violet-600 dark:text-violet-400" },
  competency_framework:  { bg: "bg-emerald-50 dark:bg-emerald-400/10", fg: "text-emerald-600 dark:text-emerald-400" },
  cycle_profile:         { bg: "bg-amber-50 dark:bg-amber-400/10",   fg: "text-amber-600 dark:text-amber-400" },
  goal_template:         { bg: "bg-rose-50 dark:bg-rose-400/10",     fg: "text-rose-600 dark:text-rose-400" },
};

// ── Template Row ──────────────────────────────────────────────────────────────

function TemplateRow({
  template,
  workspaceId,
  expanded,
  onToggle,
}: {
  template: Template;
  workspaceId: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const templateType = template.template_type || "review";

  // ── Stats text ──

  function getStats(): string {
    if (templateType === "function_template") {
      const c = template.content as any;
      return `${c?.levels?.length || 0} levels · ${c?.competencies?.length || 0} competencies`;
    }
    if (templateType === "review") {
      return `${Array.isArray(template.questions) ? template.questions.length : 0} questions`;
    }
    if (templateType === "competency_framework") {
      const c = template.content as any;
      return `${c?.competencies?.length || 0} competencies`;
    }
    if (templateType === "cycle_profile") {
      const c = template.content as any;
      return (c?.cycle_type || "custom").replace("_", " ");
    }
    if (templateType === "goal_template") {
      const c = template.content as any;
      return c?.scope || "individual";
    }
    return "";
  }

  // ── Action button — every template now has a working "Use template" flow ──

  function renderAction() {
    const btnClasses = "h-8 text-xs font-medium gap-1.5";

    if (templateType === "function_template") {
      return (
        <>
          <Button
            size="sm"
            className={btnClasses}
            onClick={(e) => { e.stopPropagation(); setDialogOpen(true); }}
          >
            Use template <ArrowRight className="h-3 w-3" />
          </Button>
          <FunctionImportDialog
            template={template}
            workspaceId={workspaceId}
            open={dialogOpen}
            onOpenChange={setDialogOpen}
          />
        </>
      );
    }

    if (templateType === "competency_framework") {
      // Was: broken <Link href="/dashboard/competencies?import=..."> — destination
      // never handled the param. Now uses the proper FrameworkImportDialog that
      // inserts competencies + level_competencies and respects duplicates.
      return (
        <>
          <Button
            size="sm"
            className={btnClasses}
            onClick={(e) => { e.stopPropagation(); setDialogOpen(true); }}
          >
            Use template <ArrowRight className="h-3 w-3" />
          </Button>
          <FrameworkImportDialog
            template={{
              ...template,
              description: template.description ?? "",
            }}
            workspaceId={workspaceId}
            open={dialogOpen}
            onOpenChange={setDialogOpen}
          />
        </>
      );
    }

    if (templateType === "cycle_profile") {
      // Was: underpowered CycleImportDialog that created a draft cycle with only
      // name + dates + description. Now redirects to the new-cycle wizard which
      // already handles ?profile=<id> and applies the full profile content
      // (cycle type, description, phase weights, review-template hint).
      return (
        <Button
          size="sm"
          className={btnClasses}
          asChild
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <Link href={`/dashboard/cycles/new?profile=${template.id}`}>
            Use template <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      );
    }

    if (templateType === "review") {
      return (
        <Button
          size="sm"
          className={btnClasses}
          asChild
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <Link href={`/dashboard/cycles/new?reviewTemplate=${template.id}`}>
            Use template <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      );
    }

    if (templateType === "goal_template") {
      return (
        <Button
          size="sm"
          className={btnClasses}
          asChild
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <Link href={`/dashboard/goals/new?templateId=${template.id}`}>
            Use template <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      );
    }

    return null;
  }

  // ── Expanded content (preview) ─────────────────────────────────────────────

  function renderExpanded() {
    if (templateType === "function_template") {
      const c = template.content as any;
      const levels = c?.levels || [];
      const competencies = c?.competencies || [];
      const hasDescriptors = competencies.some(
        (comp: any) => comp.score_descriptors && Object.keys(comp.score_descriptors).length > 0
      );
      return (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground min-w-[180px]">Competency</th>
                  {levels.map((l: any) => (
                    <th key={l.name} className="text-center py-2 px-2 font-medium text-foreground min-w-[64px]">{l.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {competencies.map((comp: any) => (
                  <tr key={comp.name} className="border-b border-border/20 last:border-0">
                    <td className="py-2 pr-4">
                      <span className="font-medium text-foreground">{comp.name}</span>
                      {comp.description && (
                        <p className="text-muted-foreground mt-0.5 leading-relaxed">{comp.description}</p>
                      )}
                    </td>
                    {(comp.expected_scores || []).map((score: number, i: number) => (
                      <td key={i} className="text-center py-2 px-2">
                        <span className={`inline-flex w-6 h-6 items-center justify-center rounded text-[10px] font-bold border ${proficiencyColors[score] || ""}`}>
                          {score}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasDescriptors && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Score Descriptors</p>
              <div className="space-y-3">
                {competencies.filter((comp: any) => comp.score_descriptors).map((comp: any) => (
                  <div key={`sd-${comp.name}`}>
                    <p className="text-xs font-medium text-foreground mb-1.5">{comp.name}</p>
                    <div className="grid gap-1">
                      {Object.entries(comp.score_descriptors as Record<string, string>)
                        .sort(([a], [b]) => Number(a) - Number(b))
                        .map(([score, desc]) => (
                          <div key={score} className="flex items-start gap-2">
                            <span className={`inline-flex w-5 h-5 items-center justify-center rounded text-[9px] font-bold border shrink-0 mt-0.5 ${proficiencyColors[Number(score)] || ""}`}>
                              {score}
                            </span>
                            <span className="text-[11px] text-muted-foreground leading-relaxed">{desc as string}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (templateType === "review") {
      const questions = template.questions || [];
      return (
        <div className="space-y-1.5">
          {questions.map((q: any, i: number) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <Badge variant="outline" className="text-[9px] shrink-0 mt-0.5">
                {q.type === "rating" ? "Rating" : "Text"}
              </Badge>
              <span className="text-muted-foreground">{q.text || q.prompt}</span>
              {q.required && <span className="text-[9px] text-red-500 shrink-0">Required</span>}
            </div>
          ))}
        </div>
      );
    }

    if (templateType === "competency_framework") {
      const c = template.content as any;
      const competencies = c?.competencies || [];
      const categories = [...new Set(competencies.map((comp: any) => comp.category))] as string[];
      return (
        <div className="space-y-3">
          {categories.map((cat) => (
            <div key={cat}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{cat}</p>
              <div className="space-y-1">
                {competencies
                  .filter((comp: any) => comp.category === cat)
                  .map((comp: any) => (
                    <div key={comp.name} className="flex items-start gap-2 text-xs">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <div>
                        <span className="font-medium text-foreground">{comp.name}</span>
                        {comp.description && (
                          <span className="text-muted-foreground ml-1.5">{comp.description}</span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (templateType === "cycle_profile") {
      const c = template.content as any;
      return (
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-muted-foreground">Cycle type:</span>{" "}
            <span className="font-medium text-foreground capitalize">{(c?.cycle_type || "custom").replace("_", " ")}</span>
          </div>
          {c?.review_template_name && (
            <div>
              <span className="text-muted-foreground">Review template:</span>{" "}
              <span className="font-medium text-foreground">{c.review_template_name}</span>
            </div>
          )}
          {c?.suggested_competency_categories?.length > 0 && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Focus areas:</span>{" "}
              <span className="font-medium text-foreground">{c.suggested_competency_categories.join(", ")}</span>
            </div>
          )}
          {c?.suggested_description && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Description:</span>{" "}
              <span className="text-foreground">{c.suggested_description}</span>
            </div>
          )}
        </div>
      );
    }

    if (templateType === "goal_template") {
      const c = template.content as any;
      return (
        <div className="grid grid-cols-2 gap-3 text-xs">
          {c?.title && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Title template:</span>{" "}
              <span className="font-medium text-foreground">{c.title}</span>
            </div>
          )}
          {c?.scope && (
            <div>
              <span className="text-muted-foreground">Scope:</span>{" "}
              <span className="font-medium text-foreground capitalize">{c.scope}</span>
            </div>
          )}
          {c?.metric_unit && (
            <div>
              <span className="text-muted-foreground">Metric:</span>{" "}
              <span className="font-medium text-foreground">{c.metric_start ?? 0} → {c.metric_target} {c.metric_unit}</span>
            </div>
          )}
        </div>
      );
    }

    return null;
  }

  // ── Render ──

  return (
    <>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors group/row"
        onClick={onToggle}
      >
        <ChevronRight
          className={`h-3.5 w-3.5 text-muted-foreground/50 group-hover/row:text-muted-foreground transition-all shrink-0 ${expanded ? "rotate-90" : ""}`}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground">
              {template.name}
            </span>
            {template.is_system && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1.5 shrink-0 border-sky-200 text-sky-700 dark:border-sky-800 dark:text-sky-400"
              >
                System
              </Badge>
            )}
            {template.is_default && (
              <Badge className="text-[10px] h-4 px-1.5 shrink-0 bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400 border border-amber-200/60 dark:border-amber-400/20">
                Default
              </Badge>
            )}
          </div>
          {template.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {template.description}
            </p>
          )}
        </div>

        <span className="text-[11px] text-muted-foreground shrink-0 hidden md:block capitalize tabular-nums">
          {getStats()}
        </span>

        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          {renderAction()}
        </div>
      </div>
      {expanded && (
        <div className="px-5 pb-5 pt-2 border-t border-border/30 bg-muted/10">
          {renderExpanded()}
        </div>
      )}
    </>
  );
}

// ── Template Section ──────────────────────────────────────────────────────────

function TemplateSection({
  title,
  subtitle,
  icon: Icon,
  type,
  templates,
  workspaceId,
  expandedId,
  onToggle,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  type: string;
  templates: Template[];
  workspaceId: string;
  expandedId: string | null;
  onToggle: (id: string) => void;
}) {
  if (templates.length === 0) return null;
  const tint = SECTION_TINT[type] ?? { bg: "bg-muted", fg: "text-muted-foreground" };
  return (
    <section>
      {/* Section header — icon badge + title + subtitle + count */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`h-8 w-8 rounded-lg ${tint.bg} flex items-center justify-center shrink-0`}>
          <Icon className={`h-4 w-4 ${tint.fg}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
              {templates.length}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card divide-y divide-border/60 overflow-hidden">
        {templates.map((t) => (
          <TemplateRow
            key={t.id}
            template={t}
            workspaceId={workspaceId}
            expanded={expandedId === t.id}
            onToggle={() => onToggle(t.id)}
          />
        ))}
      </div>
    </section>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function TemplatesClient({
  templates,
  workspaceId,
}: {
  templates: Template[];
  workspaceId: string;
}) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const searchLower = search.toLowerCase();
  const matchesSearch = (t: Template) =>
    !search ||
    t.name?.toLowerCase().includes(searchLower) ||
    t.description?.toLowerCase().includes(searchLower);

  const functionTemplates = templates.filter((t) => t.template_type === "function_template" && matchesSearch(t));
  const reviewTemplates = templates.filter((t) => (!t.template_type || t.template_type === "review") && matchesSearch(t));
  const frameworkTemplates = templates.filter((t) => t.template_type === "competency_framework" && matchesSearch(t));
  const cycleProfileTemplates = templates.filter((t) => t.template_type === "cycle_profile" && matchesSearch(t));
  const goalTemplates = templates.filter((t) => t.template_type === "goal_template" && matchesSearch(t));

  function handleToggle(id: string) {
    setExpandedId(expandedId === id ? null : id);
  }

  const hasAny =
    functionTemplates.length + reviewTemplates.length + frameworkTemplates.length +
    cycleProfileTemplates.length + goalTemplates.length > 0;

  return (
    <div className="space-y-8">
      {/* Search bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {!hasAny && (
        <div className="rounded-xl border border-dashed border-border/60 py-16 text-center">
          <p className="text-sm font-medium text-foreground mb-1">No templates found</p>
          <p className="text-xs text-muted-foreground">
            {search ? "Try a different search term" : "Templates will appear here once seeded"}
          </p>
        </div>
      )}

      <TemplateSection
        title="Function templates"
        subtitle="Career frameworks with levels + expected competency scores"
        icon={Briefcase}
        type="function_template"
        templates={functionTemplates}
        workspaceId={workspaceId}
        expandedId={expandedId}
        onToggle={handleToggle}
      />
      <TemplateSection
        title="Review templates"
        subtitle="Question sets used when launching a review cycle"
        icon={FileText}
        type="review"
        templates={reviewTemplates}
        workspaceId={workspaceId}
        expandedId={expandedId}
        onToggle={handleToggle}
      />
      <TemplateSection
        title="Competency frameworks"
        subtitle="Pre-built competency libraries you can import wholesale"
        icon={Layers}
        type="competency_framework"
        templates={frameworkTemplates}
        workspaceId={workspaceId}
        expandedId={expandedId}
        onToggle={handleToggle}
      />
      <TemplateSection
        title="Cycle profiles"
        subtitle="Starting points for common review cadences (annual, quarterly, probation)"
        icon={Calendar}
        type="cycle_profile"
        templates={cycleProfileTemplates}
        workspaceId={workspaceId}
        expandedId={expandedId}
        onToggle={handleToggle}
      />
      <TemplateSection
        title="Goal templates"
        subtitle="Seed a new goal with a pre-filled title and metric"
        icon={Target}
        type="goal_template"
        templates={goalTemplates}
        workspaceId={workspaceId}
        expandedId={expandedId}
        onToggle={handleToggle}
      />
    </div>
  );
}
