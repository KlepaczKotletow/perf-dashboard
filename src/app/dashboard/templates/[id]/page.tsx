import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { TemplateActions } from "./template-actions";
import { TemplateDetailClient } from "./template-detail-client";

async function getTemplateDetails(id: string, workspaceId: string) {
  const supabase = await createServerSupabaseClient();

  const { data: template, error } = await supabase
    .from("templates")
    .select("*, creator:users!templates_created_by_fkey(slack_name)")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();

  if (error || !template) return null;

  // Count reviews using this template (scoped to workspace)
  const { count: reviewCount } = await supabase
    .from("review_cycles")
    .select("*", { count: "exact", head: true })
    .eq("template_id", id)
    .eq("workspace_id", workspaceId);

  return { template, reviewCount: reviewCount || 0 };
}

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspace = await getUserWorkspace();
  if (!workspace?.workspaceId) {
    notFound();
  }
  const data = await getTemplateDetails(id, workspace.workspaceId);

  if (!data) {
    notFound();
  }

  const { template, reviewCount } = data;

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard/templates">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <TemplateDetailClient
            template={{
              id: template.id,
              name: template.name,
              description: template.description,
              questions: Array.isArray(template.questions) ? template.questions : [],
              is_default: template.is_default,
              is_system: template.is_system ?? false,
              created_at: template.created_at,
              creator: template.creator,
            }}
            reviewCount={reviewCount}
          />
        </div>
        <TemplateActions
          templateId={template.id}
          isDefault={template.is_default}
          isSystem={template.is_system ?? false}
          templateName={template.name}
          templateDescription={template.description}
          templateQuestions={Array.isArray(template.questions) ? template.questions : []}
        />
      </div>
    </div>
  );
}
