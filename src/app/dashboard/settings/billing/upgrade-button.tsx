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

  async function handleClick() {
    setLoading(true);

    try {
      if (isManage && customerId) {
        // Open Stripe billing portal
        const res = await fetch("/api/billing-portal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          alert(data.error || "Failed to open billing portal");
        }
      } else {
        // Redirect to pricing page for new subscriptions
        window.location.href = "/pricing";
      }
    } catch (err) {
      console.error("Error:", err);
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleClick} disabled={loading}>
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <ExternalLink className="h-4 w-4 mr-2" />
      )}
      {isManage ? "Manage Subscription" : "Upgrade Plan"}
    </Button>
  );
}
