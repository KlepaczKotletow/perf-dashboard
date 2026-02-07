import { createServerSupabaseClient } from "@/lib/supabase-server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { FeedbackFilter } from "./feedback-filter";
import { Suspense } from "react";

interface FeedbackFilters {
  source?: string;
  type?: string;
  search?: string;
}

async function getFeedback(filters: FeedbackFilters) {
  const supabase = await createServerSupabaseClient();
  
  let reviewFeedback: any[] = [];
  let continuousFeedback: any[] = [];

  // Get structured feedback from reviews (if not filtered to continuous only)
  if (!filters.source || filters.source === "all" || filters.source === "review") {
    const { data } = await supabase
      .from("feedback")
      .select(`
        id,
        question_id,
        question_text,
        response,
        rating,
        created_at,
        participant:participants!feedback_participant_id_fkey(
          reviewer:users!participants_reviewer_id_fkey(slack_name)
        ),
        review_cycle:review_cycles!feedback_review_cycle_id_fkey(
          employee:users!review_cycles_employee_id_fkey(slack_name)
        )
      `)
      .order("created_at", { ascending: false })
      .limit(50);
    reviewFeedback = data || [];
  }

  // Get continuous feedback (if not filtered to review only)
  if (!filters.source || filters.source === "all" || filters.source === "continuous") {
    let query = supabase
      .from("continuous_feedback")
      .select("*, from_user:users!continuous_feedback_from_user_id_fkey(slack_name), to_user:users!continuous_feedback_to_user_id_fkey(slack_name)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (filters.type && filters.type !== "all") {
      query = query.eq("feedback_type", filters.type);
    }

    const { data } = await query;
    continuousFeedback = data || [];
  }

  // Apply search filter
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    reviewFeedback = reviewFeedback.filter((item: any) =>
      item.participant?.reviewer?.slack_name?.toLowerCase().includes(searchLower) ||
      item.review_cycle?.employee?.slack_name?.toLowerCase().includes(searchLower) ||
      item.response?.toLowerCase().includes(searchLower) ||
      item.question_text?.toLowerCase().includes(searchLower)
    );
    continuousFeedback = continuousFeedback.filter((item: any) =>
      item.from_user?.slack_name?.toLowerCase().includes(searchLower) ||
      item.to_user?.slack_name?.toLowerCase().includes(searchLower) ||
      item.message?.toLowerCase().includes(searchLower)
    );
  }

  return { reviewFeedback, continuousFeedback };
}

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; type?: string; search?: string }>;
}) {
  const params = await searchParams;
  const { reviewFeedback, continuousFeedback } = await getFeedback(params);

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      praise: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      constructive: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      review: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      general: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    };
    return (
      <Badge className={colors[type] || colors.general}>{type}</Badge>
    );
  };

  const hasNoFeedback = reviewFeedback.length === 0 && continuousFeedback.length === 0;

  const showReviewSection = !params.source || params.source === "all" || params.source === "review";
  const showContinuousSection = !params.source || params.source === "all" || params.source === "continuous";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">Feedback Log</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">View all feedback from reviews and continuous feedback</p>
      </div>

      <Suspense fallback={<div>Loading filters...</div>}>
        <FeedbackFilter />
      </Suspense>

      {/* Structured Review Feedback */}
      {showReviewSection && (
      <Card>
        <CardHeader>
          <CardTitle>Review Feedback</CardTitle>
          <CardDescription>Feedback with skill ratings from 360 reviews</CardDescription>
        </CardHeader>
        <CardContent>
          {reviewFeedback.length === 0 ? (
            <p className="text-center text-slate-600 dark:text-slate-400 py-8">
              No review feedback yet. Reviews submitted from Slack will appear here.
            </p>
          ) : (
            <div className="space-y-4">
              {reviewFeedback.map((item: any) => (
                <div key={item.id} className="border-b border-slate-200 dark:border-slate-800 pb-4 last:border-0">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-50">
                        {item.participant?.reviewer?.slack_name || "Unknown"} → {item.review_cycle?.employee?.slack_name || "Unknown"}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {item.created_at ? format(new Date(item.created_at), "MMM d, yyyy 'at' h:mm a") : "-"}
                      </p>
                    </div>
                    {getTypeBadge("review")}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-500 mb-1">{item.question_text}</p>
                  {item.rating ? (
                    <span className="inline-block bg-primary/10 text-primary px-2 py-1 rounded text-sm">
                      Rating: {item.rating}/5
                    </span>
                  ) : (
                    <p className="text-slate-700 dark:text-slate-300 mt-1">{item.response}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Continuous Feedback */}
      {showContinuousSection && (
      <Card>
        <CardHeader>
          <CardTitle>Continuous Feedback</CardTitle>
          <CardDescription>Quick feedback submitted via Slack</CardDescription>
        </CardHeader>
        <CardContent>
          {continuousFeedback.length === 0 ? (
            <p className="text-center text-slate-600 dark:text-slate-400 py-8">
              No continuous feedback yet. Use <code>/feedback @user message</code> in Slack.
            </p>
          ) : (
            <div className="space-y-4">
              {continuousFeedback.map((item: any) => (
                <div key={item.id} className="border-b border-slate-200 dark:border-slate-800 pb-4 last:border-0">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-50">
                        {item.is_anonymous ? "Anonymous" : item.from_user?.slack_name || "Unknown"} → {item.to_user?.slack_name || "Unknown"}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {item.created_at ? format(new Date(item.created_at), "MMM d, yyyy 'at' h:mm a") : "-"}
                      </p>
                    </div>
                    {getTypeBadge(item.feedback_type)}
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 mt-2">{item.message}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}
