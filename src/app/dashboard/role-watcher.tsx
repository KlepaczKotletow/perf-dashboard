"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

/**
 * Subscribes to Supabase Realtime on the current user's row in the `users`
 * table. When the `role` column changes (e.g. admin promotes someone), the
 * Next.js router is refreshed so the layout re-evaluates which tabs to show.
 */
export function RoleWatcher({ appUserId }: { appUserId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`user-role-${appUserId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "users",
          filter: `id=eq.${appUserId}`,
        },
        () => {
          // Any update to the user's row (role, manager_id, etc.) triggers
          // a full re-render of server components so tabs / permissions refresh.
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [appUserId, router]);

  return null;
}
