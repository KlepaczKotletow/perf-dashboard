"use client";

import { useState, useEffect, use } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

interface Level {
  id: string;
  name: string;
  grade: string | null;
  sort_order: number;
}

export default function LevelsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: familyId } = use(params);
  const [levels, setLevels] = useState<Level[]>([]);
  const [familyName, setFamilyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function loadData() {
    const [{ data: family }, { data: lvls }] = await Promise.all([
      supabase.from("job_families").select("name").eq("id", familyId).single(),
      supabase.from("levels").select("*").eq("job_family_id", familyId).order("sort_order"),
    ]);
    setFamilyName(family?.name || "");
    setLevels(lvls || []);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const nextOrder = levels.length > 0 ? Math.max(...levels.map(l => l.sort_order)) + 1 : 0;

    if (editingId) {
      await supabase.from("levels").update({ name, grade: grade || null }).eq("id", editingId);
    } else {
      await supabase.from("levels").insert({
        name,
        grade: grade || null,
        job_family_id: familyId,
        sort_order: nextOrder,
        workspace_id: user.user_metadata?.workspace_id,
      });
    }
    setShowForm(false);
    setEditingId(null);
    setName("");
    setGrade("");
    loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this level?")) return;
    await supabase.from("levels").delete().eq("id", id);
    loadData();
  }

  function startEdit(level: Level) {
    setEditingId(level.id);
    setName(level.name);
    setGrade(level.grade || "");
    setShowForm(true);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/admin/job-families"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground">Levels</h1>
          <p className="text-muted-foreground mt-1">
            {familyName ? `Career levels for ${familyName}` : "Loading..."}
          </p>
        </div>
        <Button onClick={() => { setShowForm(true); setEditingId(null); setName(""); setGrade(""); }}>
          <Plus className="h-4 w-4 mr-2" />
          New Level
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit" : "New"} Level</CardTitle>
            <CardDescription>e.g., Junior Engineer (IC1), Senior Engineer (IC3)</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Level Name *</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Senior Engineer" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grade">Grade Code</Label>
                  <Input id="grade" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g., IC3 or M2" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</Button>
                <Button type="submit">{editingId ? "Save" : "Create"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Career Ladder</CardTitle>
          <CardDescription>Levels are ordered from junior to senior</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-4">Loading...</p>
          ) : levels.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No levels defined yet. Add levels to build the career ladder.</p>
          ) : (
            <div className="space-y-2">
              {levels.map((level, idx) => (
                <div key={level.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-sm w-6">{idx + 1}.</span>
                    <div>
                      <span className="font-medium">{level.name}</span>
                      {level.grade && (
                        <Badge variant="outline" className="ml-2">{level.grade}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(level)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(level.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
