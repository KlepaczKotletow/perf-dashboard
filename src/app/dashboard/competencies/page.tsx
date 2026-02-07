import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Plus, Target, Lock, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { isManagerOrAbove } from "@/lib/roles";
import { CompetencyActions } from "./competency-actions";

async function getCompetencies() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("competencies")
    .select("*")
    .order("category", { ascending: true })
    .order("name", { ascending: true });
  return data || [];
}

// Group competencies by category
function groupByCategory(competencies: any[]) {
  const grouped: Record<string, any[]> = {};
  competencies.forEach((comp) => {
    const category = comp.category || "Uncategorized";
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(comp);
  });
  return grouped;
}

const categoryColors: Record<string, string> = {
  Core: "bg-primary/20 text-primary",
  Technical: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  Leadership: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  Communication: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  Uncategorized: "bg-muted text-muted-foreground",
};

export default async function CompetenciesPage() {
  const workspace = await getUserWorkspace();
  
  // Role check
  if (!isManagerOrAbove(workspace?.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Lock className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Access Restricted
        </h1>
        <p className="text-muted-foreground mb-6 max-w-md">
          Competency management is only available to managers and administrators.
        </p>
        <Button asChild>
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const competencies = await getCompetencies();
  const grouped = groupByCategory(competencies);
  const categories = Object.keys(grouped).sort();

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Competencies</h1>
          <p className="text-muted-foreground mt-2">Define skills and competencies for reviews</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/competencies/matrix">View Matrix</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/competencies/new">
              <Plus className="h-4 w-4 mr-2" />
              New Competency
            </Link>
          </Button>
        </div>
      </div>

      {competencies.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="mb-4">No competencies defined yet. Create competencies to use in performance reviews.</p>
            <Button asChild>
              <Link href="/dashboard/competencies/new">
                <Plus className="h-4 w-4 mr-2" />
                Create Competency
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {categories.map((category) => (
            <Card key={category}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Badge className={categoryColors[category] || categoryColors.Uncategorized}>
                    {category}
                  </Badge>
                  <CardTitle className="text-lg">{grouped[category].length} Competencies</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {grouped[category].map((comp: any) => (
                    <div 
                      key={comp.id} 
                      className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <h3 className="font-medium">{comp.name}</h3>
                        {comp.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {comp.description}
                          </p>
                        )}
                      </div>
                      <CompetencyActions competency={comp} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Quick Stats */}
      {competencies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center p-4 rounded-lg bg-muted">
                <p className="text-3xl font-bold text-primary">{competencies.length}</p>
                <p className="text-sm text-muted-foreground">Total Competencies</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted">
                <p className="text-3xl font-bold text-primary">{categories.length}</p>
                <p className="text-sm text-muted-foreground">Categories</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted">
                <p className="text-3xl font-bold text-primary">1-5</p>
                <p className="text-sm text-muted-foreground">Rating Scale</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
