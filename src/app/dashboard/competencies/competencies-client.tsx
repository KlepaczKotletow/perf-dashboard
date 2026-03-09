"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus,
  Search,
  Target,
  X,
  Loader2,
  Filter,
  Grid3X3,
  List,
  Sparkles,
  Info,
  Briefcase,
  Rows3,
  Columns3,
  Wand2,
  Check,
} from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { CompetencyActions } from "./competency-actions";
import { EditableCell } from "./matrix/editable-cell";

// ── Constants ────────────────────────────────────────────────────────────────

const categoryColors: Record<string, string> = {
  Core: "bg-primary/15 text-primary border-primary/20",
  Technical: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800/40",
  Leadership: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800/40",
  Communication: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800/40",
  Collaboration: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/40",
  "Problem Solving": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800/40",
  Uncategorized: "bg-muted text-muted-foreground border-border",
};

const proficiencyColors: Record<number, string> = {
  1: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  2: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  3: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  4: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  5: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
};

const proficiencyLabels: Record<number, string> = {
  1: "Basic",
  2: "Developing",
  3: "Proficient",
  4: "Advanced",
  5: "Expert",
};

const CATEGORY_OPTIONS = [
  { value: "Core", label: "Core" },
  { value: "Technical", label: "Technical" },
  { value: "Leadership", label: "Leadership" },
  { value: "Communication", label: "Communication" },
  { value: "Collaboration", label: "Collaboration" },
  { value: "Problem Solving", label: "Problem Solving" },
];

// ── Types ────────────────────────────────────────────────────────────────────

interface CompetenciesClientProps {
  competencies: any[];
  levels: any[];
  levelCompetencies: any[];
  canEdit: boolean;
  workspaceId: string;
}

// ── Inline Proficiency Picker ────────────────────────────────────────────────

function InlinePicker({
  onSelect,
  onClose,
  showClear,
}: {
  onSelect: (v: number | null) => void;
  onClose: () => void;
  showClear?: boolean;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 bg-popover border rounded-lg shadow-lg p-1.5 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onSelect(n)}
            className={`w-7 h-7 rounded-md text-[10px] font-bold transition-all hover:scale-110 ${proficiencyColors[n]}`}
          >
            {n}
          </button>
        ))}
        {showClear && (
          <button
            onClick={() => onSelect(null)}
            className="w-7 h-7 rounded-md text-[10px] font-bold bg-muted text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-all"
            title="Clear all"
          >
            ×
          </button>
        )}
      </div>
    </>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function CompetenciesClient({
  competencies,
  levels,
  levelCompetencies,
  canEdit,
  workspaceId,
}: CompetenciesClientProps) {
  const router = useRouter();

  // Shared filter state (persists between tabs)
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Matrix-specific filter
  const [jobFamilyFilter, setJobFamilyFilter] = useState("all");

  // Inline add state
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addCategory, setAddCategory] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [addIsCore, setAddIsCore] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Bulk action state
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkRowPicker, setBulkRowPicker] = useState<string | null>(null);
  const [bulkColPicker, setBulkColPicker] = useState<string | null>(null);
  const [bulkSuccess, setBulkSuccess] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // ── Derived data ──────────────────────────────────────────────────────────

  const categories = [
    ...new Set(
      competencies.map((c: any) => c.category || "Uncategorized")
    ),
  ].sort();

  // Filtered competencies (shared between list + matrix)
  const filtered = competencies.filter((c: any) => {
    const matchesSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.description || "").toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" ||
      (c.category || "Uncategorized") === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Job families from levels
  const jobFamilies = [
    ...new Set(
      levels
        .map((l: any) => (l.job_family as any)?.name)
        .filter(Boolean)
    ),
  ].sort() as string[];

  // Filtered levels by job family
  const filteredLevels =
    jobFamilyFilter === "all"
      ? levels
      : levels.filter(
          (l: any) => (l.job_family as any)?.name === jobFamilyFilter
        );

  // Matrix lookup
  const matrixLookup: Record<string, { expected_level: number; id: string }> =
    {};
  levelCompetencies.forEach((lc: any) => {
    matrixLookup[`${lc.level_id}-${lc.competency_id}`] = {
      expected_level: lc.expected_level,
      id: lc.id,
    };
  });

  // Categories present in filtered competencies
  const matrixCategories = [
    ...new Set(filtered.map((c: any) => c.category || "Uncategorized")),
  ].sort();

  // Coverage stats
  const totalCells = filtered.length * filteredLevels.length;
  const filledCells = filtered.reduce((count: number, c: any) => {
    return (
      count +
      filteredLevels.filter(
        (l: any) => matrixLookup[`${l.id}-${c.id}`]
      ).length
    );
  }, 0);
  const coveragePct = totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0;

  // Per-level coverage
  const levelCoverageMap: Record<string, { filled: number; total: number }> = {};
  filteredLevels.forEach((level: any) => {
    const total = filtered.length;
    const filled = filtered.filter(
      (c: any) => matrixLookup[`${level.id}-${c.id}`]
    ).length;
    levelCoverageMap[level.id] = { filled, total };
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  function resetAddForm() {
    setAddName("");
    setAddCategory("");
    setAddDescription("");
    setAddIsCore(false);
    setAddError(null);
    setShowAdd(false);
  }

  async function handleAdd() {
    if (!addName.trim()) return;
    setAddLoading(true);
    setAddError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setAddError("Not authenticated");
        setAddLoading(false);
        return;
      }

      const { error } = await supabase.from("competencies").insert({
        name: addName.trim(),
        category: addCategory || null,
        description: addDescription.trim() || null,
        is_core: addIsCore,
        workspace_id: user.user_metadata?.workspace_id,
      });

      if (error) {
        setAddError(error.message);
        setAddLoading(false);
        return;
      }

      resetAddForm();
      router.refresh();
    } catch {
      setAddError("Failed to create competency");
      setAddLoading(false);
    }
  }

  function showBulkToast(message: string) {
    setBulkSuccess(message);
    setTimeout(() => setBulkSuccess(null), 3000);
  }

  // Bulk-set entire row (one competency across all visible levels)
  async function bulkSetRow(competencyId: string, proficiency: number | null) {
    setBulkLoading(true);
    setBulkRowPicker(null);
    let count = 0;

    try {
      for (const level of filteredLevels) {
        const key = `${level.id}-${competencyId}`;
        const existing = matrixLookup[key];

        if (proficiency === null) {
          // Clear: delete if exists
          if (existing) {
            await supabase
              .from("level_competencies")
              .delete()
              .eq("id", existing.id);
            delete matrixLookup[key];
            count++;
          }
        } else if (existing) {
          // Update
          await supabase
            .from("level_competencies")
            .update({ expected_level: proficiency })
            .eq("id", existing.id);
          matrixLookup[key] = { ...existing, expected_level: proficiency };
          count++;
        } else {
          // Insert
          const { data } = await supabase
            .from("level_competencies")
            .insert({
              level_id: level.id,
              competency_id: competencyId,
              workspace_id: workspaceId,
              expected_level: proficiency,
            })
            .select("id")
            .single();
          if (data) {
            matrixLookup[key] = { expected_level: proficiency, id: data.id };
          }
          count++;
        }
      }
      showBulkToast(
        proficiency === null
          ? `Cleared ${count} cells`
          : `Set ${count} cells to ${proficiency}`
      );
      router.refresh();
    } catch (err) {
      console.error("Bulk set row error:", err);
    } finally {
      setBulkLoading(false);
    }
  }

  // Bulk-fill column (one level, only empty cells)
  async function bulkFillColumn(levelId: string, proficiency: number) {
    setBulkLoading(true);
    setBulkColPicker(null);
    let count = 0;

    try {
      for (const comp of filtered) {
        const key = `${levelId}-${comp.id}`;
        if (matrixLookup[key]) continue; // Skip already set

        const { data } = await supabase
          .from("level_competencies")
          .insert({
            level_id: levelId,
            competency_id: comp.id,
            workspace_id: workspaceId,
            expected_level: proficiency,
          })
          .select("id")
          .single();
        if (data) {
          matrixLookup[key] = { expected_level: proficiency, id: data.id };
        }
        count++;
      }
      showBulkToast(`Filled ${count} empty cells with ${proficiency}`);
      router.refresh();
    } catch (err) {
      console.error("Bulk fill column error:", err);
    } finally {
      setBulkLoading(false);
    }
  }

  // Auto-assign core competencies at proficiency 3
  async function autoAssignCore() {
    setBulkLoading(true);
    let count = 0;

    try {
      const coreComps = filtered.filter((c: any) => c.is_core);
      for (const comp of coreComps) {
        for (const level of filteredLevels) {
          const key = `${level.id}-${comp.id}`;
          if (matrixLookup[key]) continue; // Already set

          const { data } = await supabase
            .from("level_competencies")
            .insert({
              level_id: level.id,
              competency_id: comp.id,
              workspace_id: workspaceId,
              expected_level: 3,
            })
            .select("id")
            .single();
          if (data) {
            matrixLookup[key] = { expected_level: 3, id: data.id };
          }
          count++;
        }
      }
      showBulkToast(
        count > 0
          ? `Auto-assigned ${count} core competency cells at Proficient (3)`
          : `All core competencies already assigned`
      );
      router.refresh();
    } catch (err) {
      console.error("Auto-assign core error:", err);
    } finally {
      setBulkLoading(false);
    }
  }

  const hasActiveFilters = search || categoryFilter !== "all";
  const hasMatrixFilters = hasActiveFilters || jobFamilyFilter !== "all";
  const coreCount = filtered.filter((c: any) => c.is_core).length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Bulk success toast */}
      {bulkSuccess && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 text-sm animate-in fade-in slide-in-from-top-2">
          <Check className="h-4 w-4" />
          {bulkSuccess}
        </div>
      )}

      {/* Page header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Competencies
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {competencies.length} competenc{competencies.length === 1 ? "y" : "ies"}
            {categories.length > 0 &&
              ` across ${categories.length} categor${categories.length === 1 ? "y" : "ies"}`}
          </p>
        </div>
        {canEdit && (
          <Button
            size="sm"
            onClick={() => setShowAdd(!showAdd)}
            className="gap-1.5"
          >
            {showAdd ? (
              <>
                <X className="h-3.5 w-3.5" />
                Cancel
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                Add Competency
              </>
            )}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="list" className="w-full">
        <TabsList className="h-9">
          <TabsTrigger value="list" className="text-xs gap-1.5 px-3">
            <List className="h-3.5 w-3.5" />
            Competencies
          </TabsTrigger>
          <TabsTrigger value="matrix" className="text-xs gap-1.5 px-3">
            <Grid3X3 className="h-3.5 w-3.5" />
            Matrix
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Competencies List ─────────────────────────────────── */}
        <TabsContent value="list" className="mt-4 space-y-4">
          {/* Inline quick-add form */}
          {showAdd && (
            <div className="border border-primary/20 rounded-lg bg-primary/[0.02] p-4 space-y-3">
              {addError && (
                <div className="bg-destructive/10 text-destructive px-3 py-2 rounded-md text-xs">
                  {addError}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="add-name" className="text-xs">
                    Name *
                  </Label>
                  <Input
                    id="add-name"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    placeholder="e.g., Code Review Excellence"
                    className="h-8 text-sm"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="add-category" className="text-xs">
                    Category
                  </Label>
                  <Select value={addCategory} onValueChange={setAddCategory}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-desc" className="text-xs">
                  Description
                </Label>
                <Textarea
                  id="add-desc"
                  value={addDescription}
                  onChange={(e) => setAddDescription(e.target.value)}
                  placeholder="How should reviewers evaluate this competency?"
                  rows={2}
                  className="text-sm resize-none"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="add-core"
                    checked={addIsCore}
                    onCheckedChange={(v) => setAddIsCore(v === true)}
                  />
                  <Label
                    htmlFor="add-core"
                    className="text-xs text-muted-foreground cursor-pointer"
                  >
                    Core competency (applies to all roles)
                  </Label>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetAddForm}
                    className="text-xs h-7"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleAdd}
                    disabled={addLoading || !addName.trim()}
                    className="text-xs h-7 gap-1"
                  >
                    {addLoading && (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    )}
                    Save
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Filter bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search competencies..."
                className="h-8 text-sm pl-8"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-8 text-sm w-[160px]">
                <Filter className="h-3 w-3 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-8 px-2 text-muted-foreground"
                onClick={() => {
                  setSearch("");
                  setCategoryFilter("all");
                }}
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* Competency rows */}
          {competencies.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-14 text-center">
                <div className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                  <Target className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                  No competencies yet
                </p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Define competencies to use in performance reviews and the
                  proficiency matrix.
                </p>
                {canEdit && (
                  <Button
                    size="sm"
                    className="mt-4 gap-1.5"
                    onClick={() => setShowAdd(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add your first competency
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center">
              <Search className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No competencies match your filters.
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden divide-y divide-border">
              {filtered.map((comp: any) => {
                const cat = comp.category || "Uncategorized";
                // Count how many levels this competency is assigned to
                const assignedCount = levels.filter(
                  (l: any) => matrixLookup[`${l.id}-${comp.id}`]
                ).length;
                return (
                  <div
                    key={comp.id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors group"
                  >
                    {/* Name + description */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">
                          {comp.name}
                        </span>
                        {comp.is_core && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-4 shrink-0 border-primary/30 text-primary"
                          >
                            <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                            Core
                          </Badge>
                        )}
                      </div>
                      {comp.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5 max-w-lg">
                          {comp.description}
                        </p>
                      )}
                    </div>

                    {/* Assigned levels count */}
                    {assignedCount > 0 && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {assignedCount} level{assignedCount !== 1 ? "s" : ""}
                      </span>
                    )}

                    {/* Category badge */}
                    <Badge
                      className={`text-[10px] px-2 py-0.5 shrink-0 font-medium border ${
                        categoryColors[cat] || categoryColors.Uncategorized
                      }`}
                    >
                      {cat}
                    </Badge>

                    {/* Actions */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <CompetencyActions competency={comp} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Filter summary */}
          {filtered.length > 0 && filtered.length !== competencies.length && (
            <p className="text-xs text-muted-foreground text-center pt-1">
              Showing {filtered.length} of {competencies.length} competencies
            </p>
          )}
        </TabsContent>

        {/* ── Tab 2: Matrix ────────────────────────────────────────────── */}
        <TabsContent value="matrix" className="mt-4 space-y-4">
          {levels.length === 0 || competencies.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-14 text-center">
                <div className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                  <Grid3X3 className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                  {levels.length === 0
                    ? "No job levels defined yet"
                    : "No competencies defined yet"}
                </p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  {levels.length === 0
                    ? "Create job families and levels first to build the competency matrix."
                    : "Add competencies above, then map them to expected proficiency levels."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* ── Matrix filter bar ──────────────────────────────────── */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Job family filter */}
                <Select
                  value={jobFamilyFilter}
                  onValueChange={setJobFamilyFilter}
                >
                  <SelectTrigger className="h-8 text-sm w-[180px]">
                    <Briefcase className="h-3 w-3 mr-1.5 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Job Families</SelectItem>
                    {jobFamilies.map((fam) => (
                      <SelectItem key={fam} value={fam}>
                        {fam}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Search */}
                <div className="relative flex-1 max-w-[200px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search..."
                    className="h-8 text-sm pl-8"
                  />
                </div>

                {/* Category filter */}
                <Select
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                >
                  <SelectTrigger className="h-8 text-sm w-[150px]">
                    <Filter className="h-3 w-3 mr-1.5 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {hasMatrixFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-8 px-2 text-muted-foreground"
                    onClick={() => {
                      setSearch("");
                      setCategoryFilter("all");
                      setJobFamilyFilter("all");
                    }}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Coverage stat */}
                <Badge
                  variant="outline"
                  className={`text-[10px] px-2 py-1 font-medium ${
                    coveragePct === 100
                      ? "border-emerald-300 text-emerald-700 dark:text-emerald-400"
                      : coveragePct > 0
                      ? "border-amber-300 text-amber-700 dark:text-amber-400"
                      : "text-muted-foreground"
                  }`}
                >
                  {filledCells}/{totalCells} assigned ({coveragePct}%)
                </Badge>

                {/* Auto-assign core button */}
                {canEdit && coreCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 gap-1.5"
                    onClick={autoAssignCore}
                    disabled={bulkLoading}
                  >
                    {bulkLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Wand2 className="h-3 w-3" />
                    )}
                    Auto-assign core
                  </Button>
                )}
              </div>

              {/* Edit + legend bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                {canEdit && (
                  <div className="flex items-start gap-2 bg-primary/[0.04] border border-primary/15 rounded-lg px-3 py-2">
                    <Info className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Click cells to set proficiency. Use row/column bulk actions for faster setup.
                    </p>
                  </div>
                )}

                {/* Proficiency legend */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground font-medium mr-0.5">
                    Scale:
                  </span>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <Badge
                      key={level}
                      className={`${proficiencyColors[level]} text-[10px] px-1.5 py-0`}
                    >
                      {level} &middot; {proficiencyLabels[level]}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* No results after filtering */}
              {filtered.length === 0 ? (
                <div className="py-10 text-center">
                  <Search className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No competencies match your filters.
                  </p>
                </div>
              ) : filteredLevels.length === 0 ? (
                <div className="py-10 text-center">
                  <Briefcase className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No levels in this job family.
                  </p>
                </div>
              ) : (
                /* Matrix tables grouped by category */
                matrixCategories.map((category) => {
                  const catCompetencies = filtered.filter(
                    (c: any) =>
                      (c.category || "Uncategorized") === category
                  );
                  if (catCompetencies.length === 0) return null;

                  return (
                    <div key={category} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={`text-[10px] px-2 py-0.5 font-medium border ${
                            categoryColors[category] ||
                            categoryColors.Uncategorized
                          }`}
                        >
                          {category}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {catCompetencies.length} competenc
                          {catCompetencies.length === 1 ? "y" : "ies"}
                        </span>
                      </div>

                      <div className="border rounded-lg overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/30">
                              <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground min-w-[180px]">
                                Competency
                              </th>
                              {filteredLevels.map((level: any) => {
                                const cov = levelCoverageMap[level.id];
                                const covPct =
                                  cov && cov.total > 0
                                    ? Math.round(
                                        (cov.filled / cov.total) * 100
                                      )
                                    : 0;
                                return (
                                  <th
                                    key={level.id}
                                    className="text-center py-2 px-2 font-medium min-w-[72px] group/col relative"
                                  >
                                    <div className="text-[10px] text-muted-foreground leading-tight">
                                      {(level.job_family as any)?.name}
                                    </div>
                                    <div className="text-xs">{level.name}</div>
                                    {level.grade && (
                                      <div className="text-[10px] text-muted-foreground">
                                        {level.grade}
                                      </div>
                                    )}
                                    {/* Coverage indicator */}
                                    <div
                                      className={`text-[9px] mt-0.5 font-normal ${
                                        covPct === 100
                                          ? "text-emerald-600 dark:text-emerald-400"
                                          : covPct > 0
                                          ? "text-amber-600 dark:text-amber-400"
                                          : "text-muted-foreground/50"
                                      }`}
                                    >
                                      {cov?.filled}/{cov?.total}
                                    </div>
                                    {/* Bulk fill column button */}
                                    {canEdit && (
                                      <div className="relative">
                                        <button
                                          onClick={() =>
                                            setBulkColPicker(
                                              bulkColPicker === level.id
                                                ? null
                                                : level.id
                                            )
                                          }
                                          disabled={bulkLoading}
                                          className="opacity-0 group-hover/col:opacity-100 transition-opacity mt-0.5 text-[9px] text-primary hover:text-primary/80 font-medium"
                                          title="Fill empty cells in this column"
                                        >
                                          Fill ↓
                                        </button>
                                        {bulkColPicker === level.id && (
                                          <InlinePicker
                                            onSelect={(v) => {
                                              if (v !== null) bulkFillColumn(level.id, v);
                                              setBulkColPicker(null);
                                            }}
                                            onClose={() =>
                                              setBulkColPicker(null)
                                            }
                                          />
                                        )}
                                      </div>
                                    )}
                                  </th>
                                );
                              })}
                              {/* No extra column header needed */}
                            </tr>
                          </thead>
                          <tbody>
                            {catCompetencies.map((comp: any) => {
                              return (
                                <tr
                                  key={comp.id}
                                  className="border-b last:border-0 hover:bg-muted/20 transition-colors group/row"
                                >
                                  <td className="py-2 px-3">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-medium">
                                        {comp.name}
                                      </span>
                                      {comp.is_core && (
                                        <Badge
                                          variant="outline"
                                          className="text-[9px] px-1 py-0 h-3.5 border-primary/30 text-primary"
                                        >
                                          Core
                                        </Badge>
                                      )}
                                      {canEdit && (
                                        <div className="relative ml-1">
                                          <button
                                            onClick={() =>
                                              setBulkRowPicker(
                                                bulkRowPicker === comp.id
                                                  ? null
                                                  : comp.id
                                              )
                                            }
                                            disabled={bulkLoading}
                                            className="opacity-0 group-hover/row:opacity-100 transition-opacity text-[9px] text-primary hover:text-primary/80 font-medium whitespace-nowrap"
                                            title="Set all levels for this competency"
                                          >
                                            Set all →
                                          </button>
                                          {bulkRowPicker === comp.id && (
                                            <InlinePicker
                                              onSelect={(v) =>
                                                bulkSetRow(comp.id, v)
                                              }
                                              onClose={() =>
                                                setBulkRowPicker(null)
                                              }
                                              showClear
                                            />
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  {filteredLevels.map((level: any) => {
                                    const entry =
                                      matrixLookup[
                                        `${level.id}-${comp.id}`
                                      ];
                                    return (
                                      <td
                                        key={level.id}
                                        className="text-center py-1.5 px-2"
                                      >
                                        <EditableCell
                                          levelId={level.id}
                                          competencyId={comp.id}
                                          workspaceId={workspaceId}
                                          initialValue={
                                            entry?.expected_level || null
                                          }
                                          existingId={entry?.id || null}
                                          canEdit={canEdit}
                                        />
                                      </td>
                                    );
                                  })}
                                  {/* "Set all" is now inline in the competency name cell */}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
