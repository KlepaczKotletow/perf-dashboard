import { createServerSupabaseClient } from "@/lib/supabase-server";
import { ReviewsFilter } from "./reviews-filter";
import { ReviewsContent } from "./reviews-content";
import { Suspense } from "react";

async function getReviewAssignments(status?: string, search?: string) {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("review_assignments")
    .select(`
      id, status, overall_rating, created_at, updated_at, assignment_type,
      employee:users!review_assignments_employee_id_fkey(id, slack_name, job_title, department),
      manager:users!review_assignments_manager_id_fkey(id, slack_name),
      reviewer:users!review_assignments_reviewer_id_fkey(id, slack_name),
      cycle:performance_cycles!review_assignments_cycle_id_fkey(id, name, status, start_date, end_date)
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data } = await query;
  let results = (data || []) as any[];

  if (search) {
    const s = search.toLowerCase();
    results = results.filter((r: any) =>
      r.employee?.slack_name?.toLowerCase().includes(s) ||
      r.manager?.slack_name?.toLowerCase().includes(s) ||
      (r.cycle as any)?.name?.toLowerCase().includes(s)
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

  // Group by cycle, then by assignment_type within each cycle
  const cycleMap = new Map<string, { cycle: any; standard: any[]; upward: any[] }>();
  for (const a of assignments) {
    const cycle = a.cycle as any;
    const cid = cycle?.id ?? "__none__";
    if (!cycleMap.has(cid)) {
      cycleMap.set(cid, { cycle, standard: [], upward: [] });
    }
    const group = cycleMap.get(cid)!;
    if (a.assignment_type === "upward") group.upward.push(a);
    else group.standard.push(a);
  }
  const cycles = Array.from(cycleMap.values());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Review Assignments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          All performance review assignments grouped by cycle
        </p>
      </div>

      <Suspense fallback={<div>Loading filters...</div>}>
        <ReviewsFilter />
      </Suspense>

      <ReviewsContent cycles={cycles} />
    </div>
  );
}
