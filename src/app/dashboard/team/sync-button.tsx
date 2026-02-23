"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Check } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

export function SyncButton({ workspaceId }: { workspaceId?: string }) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; linked?: number } | null>(null);

  async function handleSync() {
    if (!workspaceId || syncing) return;
    setSyncing(true);
    setResult(null);

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data, error } = await supabase.functions.invoke("sync-members", {
        body: { workspace_id: workspaceId },
      });

      if (error) {
        console.error("Sync error:", error);
        alert("Sync failed. Please try again.");
      } else if (data?.success) {
        setResult({ created: data.created, updated: data.updated, linked: data.linked || 0 });
        // Refresh the page to show new members
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (err) {
      console.error("Sync error:", err);
      alert("Sync failed. Please try again.");
    } finally {
      setSyncing(false);
    }
  }

  return (
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
  );
}
