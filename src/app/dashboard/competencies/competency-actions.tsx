"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { MoreHorizontal, Pencil, Trash2, Loader2, AlertCircle } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

const CATEGORY_OPTIONS = [
  { value: "Core", label: "Core" },
  { value: "Technical", label: "Technical" },
  { value: "Leadership", label: "Leadership" },
  { value: "Communication", label: "Communication" },
  { value: "Collaboration", label: "Collaboration" },
  { value: "Problem Solving", label: "Problem Solving" },
];

interface CompetencyActionsProps {
  competency: {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    is_core: boolean;
  };
}

export function CompetencyActions({ competency }: CompetencyActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editName, setEditName] = useState(competency.name);
  const [editDescription, setEditDescription] = useState(competency.description || "");
  const [editCategory, setEditCategory] = useState(competency.category || "");
  const [editIsCore, setEditIsCore] = useState(competency.is_core);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleUpdate() {
    setLoading(true);
    setUpdateError(null);
    try {
      const { error } = await supabase
        .from("competencies")
        .update({
          name: editName.trim(),
          description: editDescription || null,
          category: editCategory || null,
          is_core: editIsCore,
          updated_at: new Date().toISOString(),
        })
        .eq("id", competency.id);

      if (error) throw error;
      router.refresh();
      setShowEditDialog(false);
    } catch (err: any) {
      console.error("Error updating competency:", err);
      setUpdateError(err?.message || "Failed to save changes. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setLoading(true);
    setActionError(null);
    try {
      const { error } = await supabase
        .from("competencies")
        .delete()
        .eq("id", competency.id);

      if (error) throw error;
      router.refresh();
    } catch (err: any) {
      console.error("Error deleting competency:", err);
      setActionError(err?.message || "Failed to delete competency. Please try again.");
    } finally {
      setLoading(false);
      setShowDeleteDialog(false);
    }
  }

  return (
    <>
      {actionError && (
        <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/20 px-3 py-1.5 rounded-md">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {actionError}
        </div>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Competency</DialogTitle>
            <DialogDescription>
              Update the competency details
            </DialogDescription>
          </DialogHeader>
          {updateError && (
        <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/20 px-3 py-2 rounded-md mx-4 mb-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {updateError}
        </div>
      )}
      <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-category">Category</Label>
              <Select value={editCategory} onValueChange={setEditCategory}>
                <SelectTrigger id="edit-category">
                  <SelectValue placeholder="Select a category" />
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
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="How should reviewers evaluate this competency?"
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="edit-is-core"
                checked={editIsCore}
                onCheckedChange={(v) => setEditIsCore(v === true)}
              />
              <Label htmlFor="edit-is-core" className="text-sm text-muted-foreground cursor-pointer">
                Core competency — applies to all roles by default
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={loading || !editName.trim()}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Competency?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{competency.name}&quot; and remove it
              from all job levels and review responses. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
