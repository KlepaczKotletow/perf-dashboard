import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Plus, FileText, Lock, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { isManagerOrAbove } from "@/lib/roles";

async function getTemplates() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("templates")
    .select("*, creator:users!templates_created_by_fkey(slack_name)")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  return data || [];
}

export default async function TemplatesPage() {
  const workspace = await getUserWorkspace();

  if (!isManagerOrAbove(workspace?.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-semibold text-foreground mb-1">Access Restricted</h1>
        <p className="text-sm text-muted-foreground mb-5 max-w-xs">
          Template management is available to managers and admins.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const templates = await getTemplates();

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage review question templates</p>
        </div>
        <Button size="sm" asChild>
          <Link href="/dashboard/templates/new">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Template
          </Link>
        </Button>
      </div>

      {/* ── List ── */}
      {templates.length === 0 ? (
        <div className="rounded-lg border border-border/60 bg-card py-16 text-center">
          <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">No templates yet</p>
          <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
            Create your first template to customise review questions for a cycle.
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
          <div className="grid grid-cols-[1fr_80px_140px_120px_40px] items-center gap-4 px-5 py-2.5 bg-muted/40">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-center">Questions</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Created by</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Created</span>
            <span />
          </div>

          {templates.map((template: any) => (
            <Link
              key={template.id}
              href={`/dashboard/templates/${template.id}`}
              className="grid grid-cols-[1fr_80px_140px_120px_40px] items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors group"
            >
              {/* Name + description + default badge */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                    {template.name}
                  </span>
                  {template.is_default && (
                    <Badge variant="secondary" className="text-[10px] shrink-0">Default</Badge>
                  )}
                </div>
                {template.description && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{template.description}</p>
                )}
              </div>

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

              {/* Arrow */}
              <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors justify-self-end" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
