"use client";

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

export function FooterDropdown({ initials, name, roleLabel, isAdmin }: Props) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
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
