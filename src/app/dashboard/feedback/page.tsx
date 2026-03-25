import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { FeedbackFilter } from "./feedback-filter";
import { Suspense } from "react";
import { MessageSquare, ArrowRight } from "lucide-react";
import { isHROrAbove, isManagerOrAbove } from "@/lib/roles";

interface FeedbackFilters {
  type?: string;
  search?: string;
}

/** null means "no restriction" (HR/admin). An array (possibly empty) means "only these IDs". */
interface FeedbackScope {
  userIds: string[] | null;       // restrict continuous_feedback by to_user_id
}

const feedbackTypeConfig: Record<string, { label: string; className: string }> = {
  praise: { label: "Praise", className: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10" },
  constructive: { label: "Constructive", className: "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10" },
  general: { label: "General", className: "text-zinc-600 bg-zinc-100 dark:text-zinc-400 dark:bg-zinc-400/10" },
};

async function getScope(
  role: string | undefined,
  currentUserId: string | null,
  workspaceId: string | undefined
): Promise<FeedbackScope> {
  // HR / Admin — unrestricted
  if (isHROrAbove(role)) {
    return { userIds: null };
  }

  const supabase = await createServerSupabaseClient();

  if (!currentUserId || !workspaceId) {
    return { userIds: [] };
  }

  // Manager — direct reports + self
  if (isManagerOrAbove(role)) {
    const { data: reports, error: reportsErr } = await supabase
      .from("users")
      .select("id")
      .eq("manager_id", currentUserId)
      .eq("workspace_id", workspaceId);
    if (reportsErr) console.error("Failed to fetch manager reports:", reportsErr.message);

    const allUserIds = [
      currentUserId,
      ...((reports || []).map((r: any) => r.id)),
    ];

    return { userIds: allUserIds };
  }

  // Employee — themselves only
  return { userIds: [currentUserId] };
}

async function getContinuousFeedback(
  filters: FeedbackFilters,
  scope: FeedbackScope,
  workspaceId: string | undefined,
  currentUserId: string | null,
  role: string | undefined,
) {
  // If scope is an empty array we know there's nothing to return
  if (scope.userIds !== null && scope.userIds.length === 0) return [];

  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from("continuous_feedback")
    .select("*, from_user:users!continuous_feedback_from_user_id_fkey(slack_name), to_user:users!continuous_feedback_to_user_id_fkey(slack_name)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (workspaceId) {
    query = query.eq("workspace_id", workspaceId);
  }

  if (scope.userIds !== null) {
    if (isManagerOrAbove(role)) {
      // Managers: see all kudos for their reports (regardless of shared flag) + own sent
      query = query.or(`to_user_id.in.(${scope.userIds.join(",")}),from_user_id.in.(${scope.userIds.join(",")})`);
    } else if (currentUserId) {
      // Employees: see kudos they sent + kudos they received IF shared_with_employee=true
      query = query.or(
        `from_user_id.eq.${currentUserId},and(to_user_id.eq.${currentUserId},shared_with_employee.eq.true)`
      );
    }
  }
  // HR/Admin: scope.userIds === null, no filter applied — sees everything

  if (filters.type && filters.type !== "all") {
    query = query.eq("feedback_type", filters.type);
  }

  const { data, error: continuousFeedbackErr } = await query;
  if (continuousFeedbackErr) console.error("Failed to fetch continuous feedback:", continuousFeedbackErr.message);
  let results = data || [];

  if (filters.search) {
    const s = filters.search.toLowerCase();
    results = results.filter((item: any) =>
      item.from_user?.slack_name?.toLowerCase().includes(s) ||
      item.to_user?.slack_name?.toLowerCase().includes(s) ||
      item.message?.toLowerCase().includes(s)
    );
  }

  return results;
}

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; search?: string }>;
}) {
  const params = await searchParams;
  const workspace = await getUserWorkspace();
  const role = workspace?.role;
  const currentUserId = workspace?.appUserId ?? null;

  const scope = await getScope(role, currentUserId, workspace?.workspaceId);

  const pageDescription = isHROrAbove(role)
    ? "All kudos across the organisation"
    : isManagerOrAbove(role)
    ? "Kudos for you and your direct reports"
    : "Kudos you've sent and received";

  const workspaceId = workspace?.workspaceId;

  const continuousFeedback = await getContinuousFeedback(params, scope, workspaceId, currentUserId, role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Kudos</h1>
        <p className="text-sm text-muted-foreground mt-1">{pageDescription}</p>
      </div>

      <Suspense fallback={<div className="h-10" />}>
        <FeedbackFilter />
      </Suspense>

      {continuousFeedback.length === 0 && (
        <Card className="border-border/60">
          <CardContent className="py-16 text-center">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No kudos yet</p>
            <p className="text-sm text-muted-foreground">
              Use <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/kudos</code> in Slack to send kudos to a teammate.
            </p>
          </CardContent>
        </Card>
      )}

      {continuousFeedback.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Kudos
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {continuousFeedback.length}{continuousFeedback.length === 50 ? " (showing first 50)" : ""}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {continuousFeedback.map((item: any) => {
                const typeConf = feedbackTypeConfig[item.feedback_type] || feedbackTypeConfig.general;

                return (
                  <div key={item.id} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-foreground truncate">
                            {item.is_anonymous ? "Anonymous" : item.from_user?.slack_name || "Unknown"}
                          </span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                          <span className="text-sm font-medium text-foreground truncate">
                            {item.to_user?.slack_name || "Unknown"}
                          </span>
                          <Badge className={`shrink-0 text-[10px] font-medium ${typeConf.className}`}>
                            {typeConf.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {item.message}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground shrink-0">
                        {item.created_at
                          ? format(new Date(item.created_at), "MMM d, yyyy")
                          : "—"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
