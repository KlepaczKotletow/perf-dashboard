"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

const CATEGORY_OPTIONS = [
  { value: "Core", label: "Core" },
  { value: "Technical", label: "Technical" },
  { value: "Leadership", label: "Leadership" },
  { value: "Communication", label: "Communication" },
  { value: "Collaboration", label: "Collaboration" },
  { value: "Problem Solving", label: "Problem Solving" },
];

export default function NewCompetencyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("");
  const [customCategory, setCustomCategory] = useState<string>("");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    
    // Use custom category if "custom" is selected, otherwise use the selected category
    const finalCategory = category === "custom" ? customCategory : category;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }

      const { error: insertError } = await supabase
        .from("competencies")
        .insert({
          name,
          description: description || null,
          category: finalCategory || null,
          workspace_id: user.user_metadata?.workspace_id,
        });

      if (insertError) {
        console.error("Insert error:", insertError);
        setError(insertError.message);
        setLoading(false);
        return;
      }

      router.push("/dashboard/competencies");
      router.refresh();
    } catch (err) {
      console.error("Error creating competency:", err);
      setError("Failed to create competency");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/competencies">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">New Competency</h1>
          <p className="text-muted-foreground mt-1">Define a new skill or competency for reviews</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Competency Details</CardTitle>
          <CardDescription>
            Competencies are skills or behaviors that employees are evaluated on during reviews
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Competency Name *</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g., Communication, Problem Solving, Technical Skills"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom Category...</SelectItem>
                </SelectContent>
              </Select>
              {category === "custom" && (
                <Input
                  placeholder="Enter custom category name"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="mt-2"
                />
              )}
              <p className="text-xs text-muted-foreground">
                Group related competencies together
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Describe what this competency means and how it should be evaluated..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Help reviewers understand what to look for when rating this competency
              </p>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-medium mb-2">Rating Scale</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Competencies are rated on a 1-5 scale:
              </p>
              <div className="grid grid-cols-5 gap-2 text-center text-xs">
                <div className="p-2 rounded bg-background">
                  <div className="font-bold">1</div>
                  <div className="text-muted-foreground">Needs Work</div>
                </div>
                <div className="p-2 rounded bg-background">
                  <div className="font-bold">2</div>
                  <div className="text-muted-foreground">Developing</div>
                </div>
                <div className="p-2 rounded bg-background">
                  <div className="font-bold">3</div>
                  <div className="text-muted-foreground">Meets</div>
                </div>
                <div className="p-2 rounded bg-background">
                  <div className="font-bold">4</div>
                  <div className="text-muted-foreground">Exceeds</div>
                </div>
                <div className="p-2 rounded bg-background">
                  <div className="font-bold">5</div>
                  <div className="text-muted-foreground">Outstanding</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" asChild>
                <Link href="/dashboard/competencies">Cancel</Link>
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Competency
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
