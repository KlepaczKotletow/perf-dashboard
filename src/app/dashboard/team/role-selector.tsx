"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase";
import { ROLE_LABELS, UserRole } from "@/lib/roles";

interface RoleSelectorProps {
  userId: string;
  currentRole: string;
  canEdit: boolean;
}

export function RoleSelector({ userId, currentRole, canEdit }: RoleSelectorProps) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);

  const handleRoleChange = async (newRole: string) => {
    if (newRole === currentRole) return;
    
    setUpdating(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("users")
        .update({ role: newRole })
        .eq("id", userId);

      if (error) throw error;
      router.refresh();
    } catch (error) {
      console.error("Error updating role:", error);
      alert("Failed to update role");
    } finally {
      setUpdating(false);
    }
  };

  if (!canEdit) {
    return (
      <span className="text-sm capitalize h-10 w-32 inline-flex items-center px-3">
        {ROLE_LABELS[currentRole as UserRole] || currentRole || "Employee"}
      </span>
    );
  }

  return (
    <Select
      value={currentRole || "user"}
      onValueChange={handleRoleChange}
      disabled={updating}
    >
      <SelectTrigger className="w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="user">{ROLE_LABELS.user}</SelectItem>
        <SelectItem value="manager">{ROLE_LABELS.manager}</SelectItem>
        <SelectItem value="hr">{ROLE_LABELS.hr}</SelectItem>
        <SelectItem value="admin">{ROLE_LABELS.admin}</SelectItem>
      </SelectContent>
    </Select>
  );
}
