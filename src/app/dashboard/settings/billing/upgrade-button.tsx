"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink } from "lucide-react";

interface UpgradeButtonProps {
  workspaceId?: string;
  customerId?: string;
  isManage?: boolean;
}

export function UpgradeButton({ workspaceId, customerId, isManage = false }: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false);
  const [buttonError, setButtonError] = useState<string | null>(null);

  async function handleClick() {
    setButtonError(null);
    setLoading(true);

    try {
      if (isManage && customerId) {
        // Open Stripe billing portal
        const res = await fetch("/api/billing-portal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          setButtonError(errData.error || `Request failed (${res.status}). Please try again.`);
          return;
        }
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          setButtonError(data.error || "Failed to open billing portal");
        }
      } else {
        // Redirect to pricing page for new subscriptions
        window.location.href = "/pricing";
      }
    } catch (err) {
      console.error("Error:", err);
      setButtonError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={handleClick} disabled={loading}>
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <ExternalLink className="h-4 w-4 mr-2" />
        )}
        {isManage ? "Manage Subscription" : "Upgrade Plan"}
      </Button>
      {buttonError && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-1">{buttonError}</p>
      )}
    </>
  );
}
