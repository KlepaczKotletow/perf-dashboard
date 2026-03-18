import { getUserWorkspace } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, UserRole } from "@/lib/roles";
import { User, Mail } from "lucide-react";

export default async function ProfilePage() {
  const workspace = await getUserWorkspace();
  if (!workspace) redirect("/");

  const initials = workspace.name
    ? workspace.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : workspace.email?.[0]?.toUpperCase() || "?";

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Your personal account details.</p>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-xl font-medium text-primary">{initials}</span>
        </div>
        <div>
          <p className="font-medium text-lg">{workspace.name || "Not set"}</p>
          <Badge variant="outline" className="text-xs capitalize mt-1">
            {ROLE_LABELS[workspace.role as UserRole] || workspace.role}
          </Badge>
        </div>
      </div>

      {/* Details */}
      <Card>
        <CardContent className="divide-y divide-border p-0">
          <div className="flex items-center gap-3 px-5 py-3.5">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Full name</p>
              <p className="text-sm font-medium truncate">{workspace.name || "Not set"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-5 py-3.5">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium truncate">{workspace.email || "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Profile details are synced from your Slack workspace. Contact your admin to make changes.
      </p>
    </div>
  );
}
