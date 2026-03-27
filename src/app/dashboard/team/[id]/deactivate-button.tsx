"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { UserX, UserCheck, Loader2 } from "lucide-react";

interface Props {
  userId: string;
  workspaceId: string;
  isDeactivated: boolean;
}

export function DeactivateButton({ userId, workspaceId, isDeactivated }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  );

  async function handleAction() {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setLoading(true);
    const newStatus = isDeactivated ? "active" : "deactivated";
    await supabase
      .from("users")
      .update({ employee_status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .eq("workspace_id", workspaceId);

    setLoading(false);
    setConfirming(false);
    router.refresh();
  }

  if (isDeactivated) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
        disabled={loading}
        onClick={handleAction}
      >
        {loading ? (
          <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
        ) : (
          <UserCheck className="h-3 w-3 mr-1.5" />
        )}
        {confirming ? "Confirm reactivate?" : "Reactivate"}
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
      disabled={loading}
      onClick={handleAction}
      onBlur={() => setConfirming(false)}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
      ) : (
        <UserX className="h-3 w-3 mr-1.5" />
      )}
      {confirming ? "Confirm deactivate?" : "Deactivate"}
    </Button>
  );
}
