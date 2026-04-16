import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { FeedbackFilter } from "./feedback-filter";
import { Suspense } from "react";
import { MessageSquare } from "lucide-react";
import { isHROrAbove, isManagerOrAbove } from "@/lib/roles";
import { Pagination } from "@/components/ui/pagination";

interface FeedbackFilters {
  type?: string;
  search?: string;
  from?: string;
  to?: string;
  period?: string;
}

/** null means "no restriction" (HR/admin). An array (possibly empty) means "only these IDs". */
interface FeedbackScope {
  userIds: string[] | null;       // restrict continuous_feedback by to_user_id
}

const feedbackTypeConfig: Record<string, { label: string; className: string }> = {
  praise: { label: "Praise", className: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10" },
  constructive: { label: "Constructive", className: "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10" },
  general: { label: "General", className: "text-zinc-600 bg-zinc-100 dark:text-zinc-400 dark:bg-zinc-400/10" },
  improvement: { label: "Improvement", className: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10" },
  question: { label: "Question", className: "text-violet-700 bg-violet-50 dark:text-violet-400 dark:bg-violet-400/10" },
};

async function getScope(
  role: string | undefined,
  currentUserId: string | null,
  workspaceId: string | undefined,
  hasDirectReports?: boolean,
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
  if (isManagerOrAbove(role) || hasDirectReports) {
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

const PAGE_SIZE = 30;

async function getContinuousFeedback(
  filters: FeedbackFilters,
  scope: FeedbackScope,
  workspaceId: string | undefined,
  currentUserId: string | null,
  role: string | undefined,
  hasDirectReports?: boolean,
  page: number = 1,
): Promise<{ data: any[]; total: number }> {
  if (!workspaceId) return { data: [], total: 0 };

  // If scope is an empty array we know there's nothing to return
  if (scope.userIds !== null && scope.userIds.length === 0) return { data: [], total: 0 };

  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from("continuous_feedback")
    .select("*, from_user:users!continuous_feedback_from_user_id_fkey(slack_name), to_user:users!continuous_feedback_to_user_id_fkey(slack_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .eq("workspace_id", workspaceId);

  if (scope.userIds !== null) {
    if (isManagerOrAbove(role) || hasDirectReports) {
      // Managers see:
      //   - feedback they themselves authored (any target in their report scope)
      //   - feedback delivered to one of their reports (shared_with_employee=true)
      // They do NOT see private drafts / unshared notes authored by someone else
      // about their reports. Private feedback is between sender and recipient.
      // Matches Lattice / Leapsome / Culture Amp semantics.
      const ids = scope.userIds.join(",");
      const conditions: string[] = [`from_user_id.in.(${ids})`];
      conditions.push(`and(to_user_id.in.(${ids}),shared_with_employee.eq.true)`);
      if (currentUserId) {
        // Manager's own authored feedback is always visible to them, even if drafted.
        conditions.push(`from_user_id.eq.${currentUserId}`);
      }
      query = query.or(conditions.join(","));
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

  if (filters.from && filters.from !== "all") {
    query = query.eq("from_user_id", filters.from);
  }

  if (filters.to && filters.to !== "all") {
    query = query.eq("to_user_id", filters.to);
  }

  if (filters.period && filters.period !== "all") {
    const now = new Date();
    const periodMap: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, "6m": 180, "1y": 365 };
    const days = periodMap[filters.period];
    if (days) {
      const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("created_at", since);
    }
  }

  // Apply search filter server-side if possible, otherwise client-side post-fetch
  // For now, apply pagination to the base query
  const offset = (page - 1) * PAGE_SIZE;
  query = query.range(offset, offset + PAGE_SIZE - 1);

  const { data, count, error: continuousFeedbackErr } = await query;
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

  return { data: results, total: count || 0 };
}

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; search?: string; from?: string; to?: string; period?: string; page?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const workspace = await getUserWorkspace();
  const role = workspace?.role;
  const currentUserId = workspace?.appUserId ?? null;

  const scope = await getScope(role, currentUserId, workspace?.workspaceId, workspace?.hasDirectReports);

  const isAdmin = isHROrAbove(role);
  const pageDescription = isAdmin
    ? "All kudos across the organisation"
    : (isManagerOrAbove(role) || workspace?.hasDirectReports)
    ? "Kudos for you and your direct reports"
    : "Kudos you've sent and received";

  const workspaceId = workspace?.workspaceId;

  // Fetch users for advanced filter dropdowns (HR/Admin only)
  let userList: { id: string; name: string }[] = [];
  if (isAdmin && workspaceId) {
    const supabase = await createServerSupabaseClient();
    const { data: users } = await supabase
      .from("users")
      .select("id, slack_name")
      .eq("workspace_id", workspaceId)
      .order("slack_name");
    userList = (users || []).map((u: any) => ({ id: u.id, name: u.slack_name || "Unknown" }));
  }

  const { data: continuousFeedback, total: feedbackTotal } = await getContinuousFeedback(params, scope, workspaceId, currentUserId, role, workspace?.hasDirectReports, currentPage);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Kudos</h1>
        <p className="text-sm text-muted-foreground mt-1">{pageDescription}</p>
      </div>

      <Suspense fallback={<div className="h-10" />}>
        <FeedbackFilter showAdvanced={isAdmin} users={userList} />
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
        <>
          {/* ── Desktop table (hidden below lg) ── */}
          <Card className="border-border/60 hidden lg:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5">From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="min-w-[300px]">Message</TableHead>
                    <TableHead className="pr-5 text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {continuousFeedback.map((item: any) => {
                    const typeConf = feedbackTypeConfig[item.feedback_type] || feedbackTypeConfig.general;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="pl-5 font-medium">
                          {item.is_anonymous ? (
                            <span className="text-muted-foreground italic">Anonymous</span>
                          ) : (
                            item.from_user?.slack_name || "Unknown"
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {item.to_user?.slack_name || "Unknown"}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] font-medium ${typeConf.className}`}>
                            {typeConf.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-md">
                          <p className="line-clamp-2 text-sm">{item.message}</p>
                        </TableCell>
                        <TableCell className="pr-5 text-right text-muted-foreground text-xs whitespace-nowrap">
                          {item.created_at
                            ? format(new Date(item.created_at), "MMM d, yyyy")
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* ── Mobile card list (shown below lg) ── */}
          <div className="lg:hidden space-y-2">
            {continuousFeedback.map((item: any) => {
              const typeConf = feedbackTypeConfig[item.feedback_type] || feedbackTypeConfig.general;
              return (
                <div key={item.id} className="p-4 rounded-xl border border-border/60 bg-card space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {item.is_anonymous ? <span className="text-muted-foreground italic">Anonymous</span> : (item.from_user?.slack_name || "Unknown")}
                      <span className="text-muted-foreground font-normal"> → </span>
                      {item.to_user?.slack_name || "Unknown"}
                    </p>
                    <Badge className={`text-[10px] font-medium shrink-0 ${typeConf.className}`}>
                      {typeConf.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.message}</p>
                  <p className="text-xs text-muted-foreground/60">
                    {item.created_at ? format(new Date(item.created_at), "MMM d, yyyy") : "—"}
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}

      {feedbackTotal > 0 && (
        <Pagination
          page={currentPage}
          pageSize={PAGE_SIZE}
          total={feedbackTotal}
          basePath="/dashboard/feedback"
          searchParams={Object.fromEntries(
            Object.entries(params).filter(([k, v]) => k !== "page" && v)
          ) as Record<string, string>}
        />
      )}

    </div>
  );
}
