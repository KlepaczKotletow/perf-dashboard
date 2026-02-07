"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Briefcase, ArrowLeft, Layers } from "lucide-react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

interface JobFamily {
  id: string;
  name: string;
  description: string | null;
  levels: { id: string; name: string; grade: string | null; sort_order: number }[];
}

export default function JobFamiliesPage() {
  const [families, setFamilies] = useState<JobFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function loadFamilies() {
    const { data } = await supabase
      .from("job_families")
      .select("*, levels(id, name, grade, sort_order)")
      .order("name");
    setFamilies(data || []);
    setLoading(false);
  }

  useEffect(() => { loadFamilies(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editingId) {
      await supabase.from("job_families").update({ name, description: description || null }).eq("id", editingId);
    } else {
      await supabase.from("job_families").insert({
        name,
        description: description || null,
        workspace_id: user.user_metadata?.workspace_id,
      });
    }
    setShowForm(false);
    setEditingId(null);
    setName("");
    setDescription("");
    loadFamilies();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this job family? Levels within it will be unlinked.")) return;
    await supabase.from("job_families").delete().eq("id", id);
    loadFamilies();
  }

  function startEdit(family: JobFamily) {
    setEditingId(family.id);
    setName(family.name);
    setDescription(family.description || "");
    setShowForm(true);
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/team"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground">Job Families & Levels</h1>
          <p className="text-muted-foreground mt-1">Define career tracks and seniority levels</p>
        </div>
        <Button onClick={() => { setShowForm(true); setEditingId(null); setName(""); setDescription(""); }}>
          <Plus className="h-4 w-4 mr-2" />
          New Job Family
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit" : "New"} Job Family</CardTitle>
            <CardDescription>e.g., Engineering, Design, Product, Sales</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Engineering" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe this job family..." rows={2} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</Button>
                <Button type="submit">{editingId ? "Save Changes" : "Create"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-muted-foreground text-center py-8">Loading...</p>
      ) : families.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p>No job families defined yet. Create one to start building your career framework.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {families.map((family) => (
            <Card key={family.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5 text-primary" />
                      {family.name}
                    </CardTitle>
                    {family.description && (
                      <CardDescription className="mt-1">{family.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(family)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(family.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Levels ({family.levels?.length || 0})</span>
                </div>
                {family.levels && family.levels.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {family.levels
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((level) => (
                        <Badge key={level.id} variant="secondary">
                          {level.name}{level.grade ? ` (${level.grade})` : ""}
                        </Badge>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No levels defined yet</p>
                )}
                <div className="mt-3">
                  <Link href={`/dashboard/admin/job-families/${family.id}/levels`} className="text-sm text-primary hover:underline">
                    Manage Levels →
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
