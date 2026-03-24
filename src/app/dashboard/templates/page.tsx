import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Plus, FileText, Lock, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { isManagerOrAbove } from "@/lib/roles";

// ── System Templates ──────────────────────────────────────────────────────────

const SYSTEM_TEMPLATES = [
  {
    name: "Annual Performance Review",
    description: "Comprehensive yearly performance evaluation covering leadership, communication, execution, and growth.",
    questions: [
      { id: "sys-1-1", type: "rating", text: "Leadership: Demonstrates initiative and guides others effectively", required: true },
      { id: "sys-1-2", type: "rating", text: "Communication: Expresses ideas clearly and listens actively", required: true },
      { id: "sys-1-3", type: "rating", text: "Execution: Delivers quality work on time and meets objectives", required: true },
      { id: "sys-1-4", type: "rating", text: "Collaboration: Works effectively with team members across the organization", required: true },
      { id: "sys-1-5", type: "rating", text: "Innovation: Proposes creative solutions and embraces new approaches", required: true },
      { id: "sys-1-6", type: "text", text: "What are this person's most significant accomplishments this year?", required: true },
      { id: "sys-1-7", type: "text", text: "What areas should this person focus on for growth?", required: true },
    ],
  },
  {
    name: "Mid-Year Check-in",
    description: "Lightweight mid-year review to assess progress and identify support needs.",
    questions: [
      { id: "sys-2-1", type: "rating", text: "Goal Progress: On track to meet annual goals and objectives", required: true },
      { id: "sys-2-2", type: "rating", text: "Collaboration: Contributes positively to team dynamics", required: true },
      { id: "sys-2-3", type: "rating", text: "Initiative: Proactively identifies and acts on opportunities", required: true },
      { id: "sys-2-4", type: "text", text: "What is going well so far this year?", required: true },
      { id: "sys-2-5", type: "text", text: "What support do you need to succeed in the second half?", required: true },
    ],
  },
  {
    name: "90-Day Probation Review",
    description: "Structured evaluation for new hires completing their probationary period.",
    questions: [
      { id: "sys-3-1", type: "rating", text: "Role Fit: Demonstrates the skills and aptitude required for the role", required: true },
      { id: "sys-3-2", type: "rating", text: "Learning Agility: Quickly absorbs new information and adapts to processes", required: true },
      { id: "sys-3-3", type: "rating", text: "Team Integration: Builds productive relationships with colleagues", required: true },
      { id: "sys-3-4", type: "rating", text: "Work Quality: Produces accurate, thorough work that meets expectations", required: true },
      { id: "sys-3-5", type: "text", text: "How has this person adapted to the team and role?", required: true },
      { id: "sys-3-6", type: "text", text: "Do you recommend continuing employment? Please explain.", required: true },
    ],
  },
  {
    name: "Quarterly Pulse",
    description: "Quick quarterly check-in to gauge engagement, workload, and manager support.",
    questions: [
      { id: "sys-4-1", type: "rating", text: "Engagement: Feels motivated and connected to the team's mission", required: true },
      { id: "sys-4-2", type: "rating", text: "Workload Balance: Has a manageable and sustainable workload", required: true },
      { id: "sys-4-3", type: "rating", text: "Manager Support: Receives adequate guidance and support from their manager", required: true },
      { id: "sys-4-4", type: "text", text: "What should we start, stop, or continue doing as a team?", required: true },
    ],
  },
  {
    name: "Manager Effectiveness",
    description: "Upward feedback template for evaluating manager performance and leadership.",
    questions: [
      { id: "sys-5-1", type: "rating", text: "Clear Communication: Communicates expectations, decisions, and context clearly", required: true },
      { id: "sys-5-2", type: "rating", text: "Provides Feedback: Gives timely, constructive, and actionable feedback", required: true },
      { id: "sys-5-3", type: "rating", text: "Supports Growth: Actively invests in team members' development and career growth", required: true },
      { id: "sys-5-4", type: "rating", text: "Sets Direction: Provides clear priorities and removes blockers for the team", required: true },
      { id: "sys-5-5", type: "text", text: "What does this manager do particularly well?", required: true },
      { id: "sys-5-6", type: "text", text: "How could this manager improve their effectiveness?", required: true },
    ],
  },
  {
    name: "Peer Feedback",
    description: "Peer-to-peer review template focused on collaboration, reliability, and communication.",
    questions: [
      { id: "sys-6-1", type: "rating", text: "Collaboration: Works well with others and contributes to shared goals", required: true },
      { id: "sys-6-2", type: "rating", text: "Reliability: Follows through on commitments and can be counted on", required: true },
      { id: "sys-6-3", type: "rating", text: "Communication: Communicates effectively and keeps others informed", required: true },
      { id: "sys-6-4", type: "text", text: "What is this person's biggest strength as a colleague?", required: true },
      { id: "sys-6-5", type: "text", text: "What is one suggestion you have for this person?", required: true },
    ],
  },
];

async function seedSystemTemplates(workspaceId: string) {
  const supabase = await createServerSupabaseClient();

  // Check if any system templates already exist for this workspace
  const { count } = await supabase
    .from("templates")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("is_system", true);

  if (count && count > 0) return;

  // Insert all system templates
  const rows = SYSTEM_TEMPLATES.map((t) => ({
    workspace_id: workspaceId,
    name: t.name,
    description: t.description,
    questions: t.questions,
    is_system: true,
    is_default: false,
  }));

  await supabase.from("templates").insert(rows);
}

async function getTemplates(workspaceId: string) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("templates")
    .select("*, creator:users!templates_created_by_fkey(slack_name)")
    .eq("workspace_id", workspaceId)
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

  const workspaceId = workspace?.workspaceId;
  if (!workspaceId) {
    return <div className="p-8 text-center text-muted-foreground">Workspace not found.</div>;
  }

  // Seed system templates if they don't exist yet
  await seedSystemTemplates(workspaceId);

  const templates = await getTemplates(workspaceId);

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
              {/* Name + description + badges */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                    {template.name}
                  </span>
                  {template.is_default && (
                    <Badge variant="secondary" className="text-[10px] shrink-0">Default</Badge>
                  )}
                  {template.is_system && (
                    <Badge variant="outline" className="text-[10px] shrink-0 border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-400">System</Badge>
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
