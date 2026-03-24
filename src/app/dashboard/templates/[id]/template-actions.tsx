"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MoreVertical, Star, Trash2, Copy } from "lucide-react";
import { createClient } from "@/lib/supabase";

interface TemplateActionsProps {
  templateId: string;
  isDefault: boolean;
  isSystem: boolean;
  templateName: string;
  templateDescription: string | null;
  templateQuestions: any[];
}

export function TemplateActions({
  templateId,
  isDefault,
  isSystem,
  templateName,
  templateDescription,
  templateQuestions,
}: TemplateActionsProps) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  const handleSetDefault = async () => {
    try {
      const supabase = createClient();

      // Get workspace_id for tenant scoping
      const { data: { user } } = await supabase.auth.getUser();
      const wsId = user?.user_metadata?.workspace_id;
      if (!wsId) {
        alert("Workspace not found");
        return;
      }

      // Remove default from templates in THIS workspace only
      await supabase.from("templates").update({ is_default: false }).eq("is_default", true).eq("workspace_id", wsId);

      // Set this template as default
      await supabase.from("templates").update({ is_default: true }).eq("id", templateId).eq("workspace_id", wsId);

      router.refresh();
    } catch (error) {
      console.error("Error setting default:", error);
      alert("Failed to set as default");
    }
  };

  const handleDuplicate = async () => {
    setDuplicating(true);
    try {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      const wsId = user?.user_metadata?.workspace_id;
      const appUserId = user?.user_metadata?.app_user_id;
      if (!wsId) {
        alert("Workspace not found");
        setDuplicating(false);
        return;
      }

      const { data, error } = await supabase
        .from("templates")
        .insert({
          workspace_id: wsId,
          name: `Copy of ${templateName}`,
          description: templateDescription,
          questions: templateQuestions,
          is_system: false,
          is_default: false,
          created_by: appUserId || null,
        })
        .select("id")
        .single();

      if (error) throw error;

      router.push(`/dashboard/templates/${data.id}`);
      router.refresh();
    } catch (error) {
      console.error("Error duplicating template:", error);
      alert("Failed to duplicate template");
    } finally {
      setDuplicating(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const supabase = createClient();

      // Get workspace_id for tenant scoping
      const { data: { user } } = await supabase.auth.getUser();
      const wsId = user?.user_metadata?.workspace_id;
      if (!wsId) {
        alert("Workspace not found");
        setDeleting(false);
        return;
      }

      const { error } = await supabase.from("templates").delete().eq("id", templateId).eq("workspace_id", wsId);

      if (error) throw error;

      router.push("/dashboard/templates");
      router.refresh();
    } catch (error) {
      console.error("Error deleting template:", error);
      alert("Failed to delete template");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!isDefault && (
            <DropdownMenuItem onClick={handleSetDefault}>
              <Star className="h-4 w-4 mr-2" />
              Set as Default
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={handleDuplicate} disabled={duplicating}>
            <Copy className="h-4 w-4 mr-2" />
            {duplicating ? "Duplicating..." : "Duplicate"}
          </DropdownMenuItem>
          {!isSystem && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Template
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
              Reviews already using this template will not be affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
