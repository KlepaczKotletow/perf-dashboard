"use client";

// Drop-in replacement for the <a href={addToSlackUrl}> anchors on the landing
// page. Fires the Google Ads "Add to Slack click" conversion immediately
// before navigating to the Supabase slack-reinstall OAuth handoff.
//
// Why a client component:
//   The landing page (src/app/page.tsx) is a Server Component. The conversion
//   event has to fire from the browser, so we isolate the onClick into the
//   smallest possible client island and keep the rest of the page server-
//   rendered.
//
// Why we navigate manually instead of letting the browser follow the href:
//   `gtag('event', ...)` is fire-and-forget but uses sendBeacon under the
//   hood. If we let the browser follow the link synchronously the page can
//   navigate before sendBeacon flushes. We call gtag, then schedule the
//   navigation on next-tick so the network request gets queued first.
//   This matches Google's own "send_to with hit callback" pattern.

import { useCallback, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { conversion } from "@/lib/gtag";

const SUBSCRIBE_SEND_TO = process.env.NEXT_PUBLIC_GADS_CONVERSION_SUBSCRIBE;

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "onClick" | "href"> & {
  href: string;
  children: ReactNode;
};

export function AddToSlackLink({ href, children, ...rest }: Props) {
  const handleClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      // Honor modifier-clicks (cmd/ctrl/shift) — those open in new tabs and
      // don't navigate this window, so we'd double-fire the conversion if we
      // intercepted them. Let the browser handle them normally.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;

      e.preventDefault();
      conversion(SUBSCRIBE_SEND_TO);
      // Defer the navigation so sendBeacon has a tick to flush. 50ms is the
      // industry-standard fallback when you can't use a hitCallback.
      setTimeout(() => {
        window.location.href = href;
      }, 50);
    },
    [href]
  );

  return (
    <a href={href} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
