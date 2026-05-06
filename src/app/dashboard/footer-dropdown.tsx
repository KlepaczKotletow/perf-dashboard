"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { LogOut, User, Settings, ChevronUp, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  initials: string;
  name: string;
  roleLabel: string;
  isAdmin: boolean;
}

// Static visual of the trigger — used both for SSR (so the layout doesn't
// jump) and as the asChild slot once the real DropdownMenu mounts.
function TriggerVisual({ initials, name, roleLabel }: { initials: string; name: string; roleLabel: string }) {
  return (
    <>
      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <span className="text-xs font-medium text-primary">{initials}</span>
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[13px] font-medium text-sidebar-foreground truncate">{name}</p>
        <Badge
          variant="outline"
          className="text-[10px] h-4 px-1.5 capitalize border-sidebar-border text-sidebar-foreground/50 font-normal"
        >
          {roleLabel}
        </Badge>
      </div>
      <ChevronUp className="h-3.5 w-3.5 text-sidebar-foreground/40 shrink-0 group-data-[state=open]:rotate-180 transition-transform" />
    </>
  );
}

export function FooterDropdown({ initials, name, roleLabel, isAdmin }: Props) {
  const router = useRouter();
  // Defer the Radix DropdownMenu until after mount. Radix uses React.useId()
  // for the trigger button; that id is stable per-mount but Next.js dev
  // overlays / Speed Insights can shift the tree position between SSR and
  // hydration, producing a console-noisy "won't be patched up" warning.
  // Rendering a plain visual on the server and swapping to the interactive
  // menu after mount sidesteps the mismatch without changing what the user
  // sees.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot SSR-hydration flag
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button
        type="button"
        className="flex items-center gap-2.5 w-full px-1 py-1.5 rounded-md hover:bg-sidebar-accent transition-colors group"
        aria-label="Open user menu"
      >
        <TriggerVisual initials={initials} name={name} roleLabel={roleLabel} />
      </button>
    );
  }

  async function handleSignOut() {
    const supabase = createClient();
    // Clear any autosaved review drafts so the next user on this device can't
    // see this user's in-progress ratings. Keys are user-scoped as a first
    // line of defence; clearing on signout is a belt-and-braces step.
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith("review-draft-")) {
          localStorage.removeItem(key);
        }
      }
    } catch { /* ignore — signout is best-effort */ }

    // Server-side logout first: revokes the refresh token globally so a
    // stolen/offline device can't keep using the old session. Then
    // client-side signOut to clear the in-memory session immediately.
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch { /* ignore — fall through to client signout */ }
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2.5 w-full px-1 py-1.5 rounded-md hover:bg-sidebar-accent transition-colors group"
        >
          <TriggerVisual initials={initials} name={name} roleLabel={roleLabel} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align="start" className="w-48 mb-1">
        <DropdownMenuItem onClick={() => router.push("/dashboard/profile")}>
          <User className="h-4 w-4 mr-2" />
          View Profile
        </DropdownMenuItem>

        {isAdmin && (
          <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </DropdownMenuItem>
        )}

        <DropdownMenuItem onClick={() => router.push("/dashboard/help")}>
          <HelpCircle className="h-4 w-4 mr-2" />
          Help Center
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4 mr-2" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
