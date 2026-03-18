import { getUserWorkspace } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { isAdminOrAbove } from "@/lib/roles";
import { Card, CardContent } from "@/components/ui/card";
import { Building2 } from "lucide-react";

export default async function SettingsPage() {
  const workspace = await getUserWorkspace();
  if (!workspace || !isAdminOrAbove(workspace.role)) redirect("/dashboard");

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Workspace configuration.</p>
      </div>

      <Card>
        <CardContent className="divide-y divide-border p-0">
          <div className="flex items-center gap-3 px-5 py-3.5">
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Workspace name</p>
              <p className="text-sm font-medium truncate">{workspace.workspaceName || "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        More workspace settings coming soon.
      </p>
    </div>
  );
}
