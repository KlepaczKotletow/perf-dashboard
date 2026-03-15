import { createServerSupabaseClient } from "@/lib/supabase-server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, FileText, Star, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { notFound } from "next/navigation";
import { TemplateActions } from "./template-actions";

async function getTemplateDetails(id: string) {
  const supabase = await createServerSupabaseClient();
  
  const { data: template, error } = await supabase
    .from("templates")
    .select("*, creator:users!templates_created_by_fkey(slack_name)")
    .eq("id", id)
    .single();

  if (error || !template) return null;

  // Count reviews using this template
  const { count: reviewCount } = await supabase
    .from("review_cycles")
    .select("*", { count: "exact", head: true })
    .eq("template_id", id);

  return { template, reviewCount: reviewCount || 0 };
}

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getTemplateDetails(id);

  if (!data) {
    notFound();
  }

  const { template, reviewCount } = data;
  const questions = Array.isArray(template.questions) ? template.questions : [];

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard/templates">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">
              {template.name}
            </h1>
            {template.is_default && <Badge variant="secondary">Default</Badge>}
          </div>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {template.description || "No description"}
          </p>
        </div>
        <TemplateActions templateId={template.id} isDefault={template.is_default} />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Questions</CardTitle>
            <FileText className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{questions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reviews Using</CardTitle>
            <Star className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reviewCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Created</CardTitle>
            <MessageSquare className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-medium">
              {format(new Date(template.created_at), "MMM d, yyyy")}
            </div>
            <p className="text-xs text-slate-500">
              by {template.creator?.slack_name || "System"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Questions</CardTitle>
          <CardDescription>Review questions in this template</CardDescription>
        </CardHeader>
        <CardContent>
          {questions.length === 0 ? (
            <p className="text-center text-slate-500 py-4">No questions defined</p>
          ) : (
            <div className="space-y-3">
              {questions.map((question: any, index: number) => (
                <div
                  key={question.id || index}
                  className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg"
                >
                  <span className="text-sm font-medium text-slate-400 w-6">
                    {index + 1}.
                  </span>
                  <div className="flex-1">
                    <p className="font-medium">{question.text}</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {question.type === "rating" ? "Rating (1-5)" : "Text"}
                      </Badge>
                      {question.required && (
                        <Badge variant="outline" className="text-xs text-red-600 border-red-200">
                          Required
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
