import { createServerSupabaseClient } from "@/lib/supabase-server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { format } from "date-fns";
import { ReviewsFilter } from "./reviews-filter";
import { Suspense } from "react";

async function getReviews(status?: string, search?: string) {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("review_cycles")
    .select("*, employee:users!review_cycles_employee_id_fkey(slack_name)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data } = await query;
  
  let results = data || [];
  
  // Client-side search filter (would be better with full-text search in production)
  if (search) {
    const searchLower = search.toLowerCase();
    results = results.filter((r: any) => 
      r.employee?.slack_name?.toLowerCase().includes(searchLower)
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
  const reviews = await getReviews(params.status, params.search);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      completed: "secondary",
      pending: "outline",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">Review Cycles</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Manage 360-degree performance reviews</p>
        </div>
      </div>

      <Suspense fallback={<div>Loading filters...</div>}>
        <ReviewsFilter />
      </Suspense>

      <Card>
        <CardHeader>
          <CardTitle>All Reviews</CardTitle>
          <CardDescription>Review cycles and their current status</CardDescription>
        </CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <p className="text-center text-slate-600 dark:text-slate-400 py-8">
              No reviews yet. Start a review cycle from Slack using <code>/review start</code>
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((review) => (
                  <TableRow key={review.id}>
                    <TableCell className="font-medium">
                      {(review.employee as any)?.slack_name || "Unknown"}
                    </TableCell>
                    <TableCell>{getStatusBadge(review.status)}</TableCell>
                    <TableCell>
                      {review.start_date ? format(new Date(review.start_date), "MMM d, yyyy") : "-"}
                    </TableCell>
                    <TableCell>
                      {review.due_date ? format(new Date(review.due_date), "MMM d, yyyy") : "-"}
                    </TableCell>
                    <TableCell>
                      <Link href={`/dashboard/reviews/${review.id}`} className="text-blue-600 hover:underline">
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
