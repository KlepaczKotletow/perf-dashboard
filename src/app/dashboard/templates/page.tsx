import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Plus, FileText, Lock } from "lucide-react";
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
  
  // Role check - only managers and admins can manage templates
  if (!isManagerOrAbove(workspace?.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Lock className="h-16 w-16 text-slate-400 mb-4" />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-2">
          Access Restricted
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md">
          Template management is only available to managers and administrators.
        </p>
        <Button asChild>
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const templates = await getTemplates();

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">Templates</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Manage review question templates</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/templates/new">
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {templates.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-slate-600 dark:text-slate-400">
              <FileText className="h-12 w-12 mx-auto mb-4 text-slate-400" />
              <p className="mb-4">No templates yet. Create your first template to customize review questions.</p>
              <Button asChild>
                <Link href="/dashboard/templates/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Template
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          templates.map((template: any) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  {template.is_default && <Badge variant="secondary">Default</Badge>}
                </div>
                <CardDescription className="line-clamp-2">
                  {template.description || "No description"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Questions</span>
                    <span className="font-medium">
                      {Array.isArray(template.questions) ? template.questions.length : 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Created by</span>
                    <span>{template.creator?.slack_name || "System"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Created</span>
                    <span>{format(new Date(template.created_at), "MMM d, yyyy")}</span>
                  </div>
                  <div className="pt-2">
                    <Button variant="outline" className="w-full" asChild>
                      <Link href={`/dashboard/templates/${template.id}`}>View & Edit</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
