"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Plus, Pencil, Trash2, Briefcase, ArrowLeft, Check, X, Loader2, Users,
} from "lucide-react";
import Link from "next/link";

interface Level {
  id: string;
  name: string;
  grade: string | null;
  sort_order: number;
}

interface JobFamily {
  id: string;
  name: string;
  description: string | null;
  levels: Level[];
  member_count: number;
}

export default function JobFamiliesPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [families, setFamilies] = useState<JobFamily[]>([]);
  const [loading, setLoading] = useState(true);

  // New family form
  const [showNewFamily, setShowNewFamily] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState("");
  const [newFamilyDesc, setNewFamilyDesc] = useState("");
  const [savingFamily, setSavingFamily] = useState(false);

  // Inline rename
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Add level state: keyed by family id
  const [addingLevelFor, setAddingLevelFor] = useState<string | null>(null);
  const [newLevelName, setNewLevelName] = useState("");
  const [newLevelGrade, setNewLevelGrade] = useState("");
  const [savingLevel, setSavingLevel] = useState(false);

  async function load() {
    const [{ data: fams }, { data: lvls }, { data: members }] = await Promise.all([
      supabase.from("job_families").select("id, name, description").order("name"),
      supabase.from("levels").select("id, name, grade, sort_order, job_family_id").order("sort_order"),
      supabase.from("users").select("level_id, levels!users_level_id_fkey(job_family_id)"),
    ]);

    const memberCountByFamily: Record<string, number> = {};
    (members || []).forEach((u: any) => {
      const jfId = u.levels?.job_family_id;
      if (jfId) memberCountByFamily[jfId] = (memberCountByFamily[jfId] || 0) + 1;
    });

    const levelsByFamily: Record<string, Level[]> = {};
    (lvls || []).forEach((l: any) => {
      if (!levelsByFamily[l.job_family_id]) levelsByFamily[l.job_family_id] = [];
      levelsByFamily[l.job_family_id].push(l);
    });

    setFamilies(
      (fams || []).map((f: any) => ({
        ...f,
        levels: levelsByFamily[f.id] || [],
        member_count: memberCountByFamily[f.id] || 0,
      }))
    );
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreateFamily(e: React.FormEvent) {
    e.preventDefault();
    if (!newFamilyName.trim()) return;
    setSavingFamily(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("job_families").insert({
      name: newFamilyName.trim(),
      description: newFamilyDesc.trim() || null,
      workspace_id: user?.user_metadata?.workspace_id,
    });
    setNewFamilyName("");
    setNewFamilyDesc("");
    setShowNewFamily(false);
    setSavingFamily(false);
    load();
  }

  async function handleRename(id: string) {
    if (!renameValue.trim()) return;
    await supabase.from("job_families").update({ name: renameValue.trim() }).eq("id", id);
    setRenamingId(null);
    load();
  }

  async function handleDeleteFamily(family: JobFamily) {
    const msg = family.member_count > 0
      ? `Delete "${family.name}"? ${family.member_count} ${family.member_count === 1 ? "person is" : "people are"} assigned to levels in this family — they will lose their level assignment.`
      : `Delete "${family.name}"? Its ${family.levels.length} level${family.levels.length !== 1 ? "s" : ""} will also be deleted.`;
    if (!confirm(msg)) return;
    await supabase.from("job_families").delete().eq("id", family.id);
    load();
  }

  async function handleAddLevel(familyId: string) {
    if (!newLevelName.trim()) return;
    setSavingLevel(true);
    const { data: { user } } = await supabase.auth.getUser();
    const family = families.find(f => f.id === familyId);
    const nextOrder = family && family.levels.length > 0
      ? Math.max(...family.levels.map(l => l.sort_order)) + 1
      : 0;
    await supabase.from("levels").insert({
      name: newLevelName.trim(),
      grade: newLevelGrade.trim() || null,
      job_family_id: familyId,
      sort_order: nextOrder,
      workspace_id: user?.user_metadata?.workspace_id,
    });
    setNewLevelName("");
    setNewLevelGrade("");
    setAddingLevelFor(null);
    setSavingLevel(false);
    load();
  }

  async function handleDeleteLevel(levelId: string, levelName: string) {
    if (!confirm(`Remove level "${levelName}"?`)) return;
    await supabase.from("levels").delete().eq("id", levelId);
    load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/team"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Job Families & Levels</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Define career tracks and seniority levels</p>
        </div>
        <Button
          size="sm"
          onClick={() => { setShowNewFamily(true); setNewFamilyName(""); setNewFamilyDesc(""); }}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          New Job Family
        </Button>
      </div>

      {/* Inline new-family form */}
      {showNewFamily && (
        <Card className="border-primary/30 bg-primary/[0.02]">
          <CardContent className="pt-5">
            <form onSubmit={handleCreateFamily} className="space-y-3">
              <div className="flex gap-3">
                <Input
                  autoFocus
                  placeholder="Family name, e.g. Engineering"
                  value={newFamilyName}
                  onChange={e => setNewFamilyName(e.target.value)}
                  className="flex-1"
                  required
                />
                <Input
                  placeholder="Description (optional)"
                  value={newFamilyDesc}
                  onChange={e => setNewFamilyDesc(e.target.value)}
                  className="flex-1"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewFamily(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={savingFamily || !newFamilyName.trim()}>
                  {savingFamily ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create Family"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {families.length === 0 && !showNewFamily && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Briefcase className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No job families yet</p>
            <p className="text-sm text-muted-foreground mb-5">
              Create your first job family to start building your career framework.
            </p>
            <Button size="sm" onClick={() => setShowNewFamily(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              New Job Family
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Family cards */}
      <div className="space-y-3">
        {families.map(family => (
          <Card key={family.id} className="border-border/60">
            <CardHeader className="pb-3 pt-4 px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {renamingId === family.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        autoFocus
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        className="h-7 text-sm font-semibold"
                        onKeyDown={e => {
                          if (e.key === "Enter") handleRename(family.id);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                      />
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleRename(family.id)}>
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setRenamingId(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-foreground">{family.name}</h3>
                      {family.member_count > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Users className="h-3 w-3" />{family.member_count}
                        </span>
                      )}
                      {family.description && (
                        <span className="text-xs text-muted-foreground">— {family.description}</span>
                      )}
                    </div>
                  )}
                </div>
                {renamingId !== family.id && (
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => { setRenamingId(family.id); setRenameValue(family.name); }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => handleDeleteFamily(family)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive/70 hover:text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="px-5 pb-4 pt-0">
              {/* Level pills */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {family.levels.length === 0 && addingLevelFor !== family.id && (
                  <span className="text-xs text-muted-foreground/60 italic">No levels yet — add one below</span>
                )}
                {family.levels.map(level => (
                  <span
                    key={level.id}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground border border-border/60 group"
                  >
                    {level.name}{level.grade ? ` (${level.grade})` : ""}
                    <button
                      onClick={() => handleDeleteLevel(level.id, level.name)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${level.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>

              {/* Inline add-level form */}
              {addingLevelFor === family.id ? (
                <div className="flex gap-2 items-center flex-wrap">
                  <Input
                    autoFocus
                    placeholder="Level name, e.g. Senior Engineer"
                    value={newLevelName}
                    onChange={e => setNewLevelName(e.target.value)}
                    className="h-7 text-xs flex-1 min-w-[160px]"
                    onKeyDown={e => {
                      if (e.key === "Enter") handleAddLevel(family.id);
                      if (e.key === "Escape") { setAddingLevelFor(null); setNewLevelName(""); setNewLevelGrade(""); }
                    }}
                  />
                  <Input
                    placeholder="Grade (optional)"
                    value={newLevelGrade}
                    onChange={e => setNewLevelGrade(e.target.value)}
                    className="h-7 text-xs w-28"
                    onKeyDown={e => {
                      if (e.key === "Enter") handleAddLevel(family.id);
                      if (e.key === "Escape") { setAddingLevelFor(null); setNewLevelName(""); setNewLevelGrade(""); }
                    }}
                  />
                  <Button
                    size="sm" className="h-7 px-2.5 text-xs"
                    onClick={() => handleAddLevel(family.id)}
                    disabled={savingLevel || !newLevelName.trim()}
                  >
                    {savingLevel ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
                  </Button>
                  <Button
                    variant="ghost" size="sm" className="h-7 px-2.5 text-xs"
                    onClick={() => { setAddingLevelFor(null); setNewLevelName(""); setNewLevelGrade(""); }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => { setAddingLevelFor(family.id); setNewLevelName(""); setNewLevelGrade(""); }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add level
                </button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
