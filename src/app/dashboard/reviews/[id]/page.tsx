import { createServerSupabaseClient } from "@/lib/supabase-server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Star, MessageSquare, User } from "lucide-react";
import { format } from "date-fns";
import { notFound } from "next/navigation";

async function getReviewDetails(id: string) {
  const supabase = await createServerSupabaseClient();
  
  // Get review cycle
  const { data: review, error } = await supabase
    .from("review_cycles")
    .select(`
      *,
      employee:users!review_cycles_employee_id_fkey(id, slack_name, slack_email),
      creator:users!review_cycles_created_by_fkey(id, slack_name)
    `)
    .eq("id", id)
    .single();

  if (error || !review) return null;

  // Get participants with reviewer info
  const { data: participants } = await supabase
    .from("participants")
    .select(`
      *,
      reviewer:users!participants_reviewer_id_fkey(id, slack_name, slack_email)
    `)
    .eq("review_cycle_id", id);

  // Get feedback for this review with participant/reviewer info
  const { data: feedback } = await supabase
    .from("feedback")
    .select(`
      *,
      participant:participants!feedback_participant_id_fkey(
        reviewer:users!participants_reviewer_id_fkey(id, slack_name)
      )
    `)
    .eq("review_cycle_id", id)
    .order("created_at", { ascending: false });

  return { review, participants: participants || [], feedback: feedback || [] };
}

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getReviewDetails(id);

  if (!data) {
    notFound();
  }

  const { review, participants, feedback } = data;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      completed: "secondary",
      pending: "outline",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const getParticipantStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      completed: "bg-green-100 text-green-800",
      declined: "bg-red-100 text-red-800",
    };
    return <Badge className={colors[status] || "bg-gray-100 text-gray-800"}>{status}</Badge>;
  };

  // Calculate average ratings per question
  const ratingsByQuestion: Record<string, { name: string; ratings: number[] }> = {};
  feedback.forEach((f: any) => {
    if (f.rating && f.question_text) {
      if (!ratingsByQuestion[f.question_id]) {
        ratingsByQuestion[f.question_id] = { name: f.question_text, ratings: [] };
      }
      ratingsByQuestion[f.question_id].ratings.push(f.rating);
    }
  });

  const skillSummaries = Object.values(ratingsByQuestion).map(q => ({
    name: q.name,
    avg: (q.ratings.reduce((a, b) => a + b, 0) / q.ratings.length).toFixed(1),
    count: q.ratings.length,
  }));

  const allRatings = feedback.filter((f: any) => f.rating).map((f: any) => f.rating as number);
  const overallAvg = allRatings.length > 0
    ? (allRatings.reduce((a: number, b: number) => a + b, 0) / allRatings.length).toFixed(1)
    : "N/A";

  // Count unique reviewers who completed
  const completedParticipants = participants.filter((p: any) => p.status === "completed").length;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard/reviews">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">
            Review for {(review.employee as any)?.slack_name || "Unknown"}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Created by {(review.creator as any)?.slack_name || "Unknown"}
          </p>
        </div>
        <div className="ml-auto">{getStatusBadge(review.status)}</div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Rating</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallAvg}/5</div>
            <p className="text-xs text-muted-foreground">Avg across all skills</p>
          </CardContent>
        </Card>
        {skillSummaries.slice(0, 2).map((skill) => (
          <Card key={skill.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium truncate">{skill.name}</CardTitle>
              <Star className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{skill.avg}/5</div>
              <p className="text-xs text-muted-foreground">{skill.count} ratings</p>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Responses</CardTitle>
            <MessageSquare className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedParticipants}/{participants.length}</div>
            <p className="text-xs text-muted-foreground">Reviewers completed</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Participants */}
        <Card>
          <CardHeader>
            <CardTitle>Reviewers</CardTitle>
            <CardDescription>People invited to provide feedback</CardDescription>
          </CardHeader>
          <CardContent>
            {participants.length === 0 ? (
              <p className="text-sm text-slate-500">No reviewers assigned</p>
            ) : (
              <div className="space-y-3">
                {participants.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-slate-400" />
                      <div>
                        <span>{p.reviewer?.slack_name || "Unknown"}</span>
                        <span className="text-xs text-muted-foreground ml-2 capitalize">({p.role})</span>
                      </div>
                    </div>
                    {getParticipantStatusBadge(p.status)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Review Info */}
        <Card>
          <CardHeader>
            <CardTitle>Review Details</CardTitle>
            <CardDescription>Timeline and information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Employee</span>
              <span className="text-sm font-medium">{(review.employee as any)?.slack_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Email</span>
              <span className="text-sm">{(review.employee as any)?.slack_email || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Start Date</span>
              <span className="text-sm">
                {review.start_date ? format(new Date(review.start_date), "MMM d, yyyy") : "-"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Due Date</span>
              <span className="text-sm">
                {review.due_date ? format(new Date(review.due_date), "MMM d, yyyy") : "-"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Created</span>
              <span className="text-sm">
                {format(new Date(review.created_at), "MMM d, yyyy")}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feedback */}
      <Card>
        <CardHeader>
          <CardTitle>Feedback Responses</CardTitle>
          <CardDescription>Individual feedback from reviewers</CardDescription>
        </CardHeader>
        <CardContent>
          {feedback.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No feedback submitted yet</p>
          ) : (
            <div className="space-y-6">
              {feedback.map((f: any) => (
                <div key={f.id} className="border-b border-slate-200 dark:border-slate-800 pb-4 last:border-0">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-medium">{f.participant?.reviewer?.slack_name || "Anonymous"}</p>
                      <p className="text-xs text-slate-500">
                        {f.created_at ? format(new Date(f.created_at), "MMM d, yyyy 'at' h:mm a") : "-"}
                      </p>
                    </div>
                    {f.rating && (
                      <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded">
                        {f.question_text}: {f.rating}/5
                      </span>
                    )}
                  </div>
                  {!f.rating && f.response && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">{f.question_text}</p>
                      <p className="text-slate-700 dark:text-slate-300">{f.response}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
