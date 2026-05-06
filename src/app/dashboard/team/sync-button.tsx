"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw, Check } from "lucide-react";
import { createClient } from "@/lib/supabase";

export function SyncButton({ workspaceId }: { workspaceId?: string }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; linked?: number } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  async function handleSync() {
    if (!workspaceId || syncing) return;
    setSyncing(true);
    setResult(null);
    setSyncError(null);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke("sync-members", {
        body: { workspace_id: workspaceId },
      });

      if (error) {
        console.error("Sync error:", error);
        setSyncError("Sync failed. Please try again.");
      } else if (data?.success) {
        setResult({ created: data.created, updated: data.updated, linked: data.linked || 0 });
        // Refresh the page to show new members, then clear the result text
        setTimeout(() => router.refresh(), 1500);
        setTimeout(() => setResult(null), 6000);
      }
    } catch (err) {
      console.error("Sync error:", err);
      setSyncError("Sync failed. Please try again.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        size="sm"
        variant="outline"
        onClick={handleSync}
        disabled={syncing || !workspaceId}
        className="text-xs gap-1.5"
      >
        {syncing ? (
          <>
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Syncing...
          </>
        ) : result ? (
          <>
            <Check className="h-3.5 w-3.5 text-green-500" />
            +{result.created} new, {result.updated} updated{result.linked ? `, ${result.linked} linked` : ""}
          </>
        ) : (
          <>
            <RefreshCw className="h-3.5 w-3.5" />
            Sync from Slack
          </>
        )}
      </Button>
      {syncError && (
        <p className="text-xs text-red-600 dark:text-red-400">{syncError}</p>
      )}
    </div>
  );
}
