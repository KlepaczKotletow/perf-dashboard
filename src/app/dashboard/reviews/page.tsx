import { createServerSupabaseClient } from "@/lib/supabase-server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { format } from "date-fns";
import { ReviewsFilter } from "./reviews-filter";
import { Suspense } from "react";
import { FileText } from "lucide-react";
import { getAssignmentStatus } from "@/lib/status";

async function getReviewAssignments(status?: string, search?: string) {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("review_assignments")
    .select(`
      id, status, overall_rating, created_at, updated_at,
      employee:users!review_assignments_employee_id_fkey(id, slack_name, job_title, department),
      manager:users!review_assignments_manager_id_fkey(id, slack_name),
      cycle:performance_cycles!review_assignments_cycle_id_fkey(id, name, status, start_date, end_date)
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data } = await query;
  let results = data || [];

  if (search) {
    const s = search.toLowerCase();
    results = results.filter((r: any) =>
      r.employee?.slack_name?.toLowerCase().includes(s) ||
      r.manager?.slack_name?.toLowerCase().includes(s) ||
      r.cycle?.name?.toLowerCase().includes(s)
    );
  }

  return results;
}

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const params = await searchParams;
  const assignments = await getReviewAssignments(params.status, params.search);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Review Assignments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          All performance review assignments from active and past cycles
        </p>
      </div>

      <Suspense fallback={<div>Loading filters...</div>}>
        <ReviewsFilter />
      </Suspense>

      {assignments.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-16 text-center">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No review assignments yet</p>
            <p className="text-sm text-muted-foreground">
              Assignments are created when a performance cycle is launched.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/60">
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Reviewer</TableHead>
                    <TableHead>Cycle</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead className="text-right">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((a: any) => {
                    const config = getAssignmentStatus(a.status);
                    return (
                      <TableRow key={a.id} className="cursor-pointer group">
                        <TableCell>
                          <Link href={`/dashboard/reviews/${a.id}`} className="block group-hover:text-primary transition-colors">
                            <p className="text-sm font-medium">{a.employee?.slack_name || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground">
                              {a.employee?.department || a.employee?.job_title || ""}
                            </p>
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {a.manager?.slack_name || "Unassigned"}
                        </TableCell>
                        <TableCell>
                          {a.cycle ? (
                            <Link
                              href={`/dashboard/cycles/${a.cycle.id}`}
                              className="text-sm hover:text-primary transition-colors"
                            >
                              {a.cycle.name}
                            </Link>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-[11px] font-medium ${config.badge}`}>
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {a.overall_rating ? `${a.overall_rating}/5` : "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {a.updated_at
                            ? format(new Date(a.updated_at), "MMM d, yyyy")
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
