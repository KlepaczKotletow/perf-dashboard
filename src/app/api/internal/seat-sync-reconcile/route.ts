import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-server";
import { signSeatSync } from "@/lib/seat-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = process.env.SEAT_SYNC_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "SEAT_SYNC_SECRET missing" }, { status: 500 });
  }

  const supabase = createServiceRoleClient();
  const { data: subs, error } = await supabase
    .from("subscriptions")
    .select("workspace_id")
    .in("status", ["active", "trialing", "past_due"])
    .not("workspace_id", "is", null);

  if (error || !subs) {
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const results = await Promise.allSettled(
    subs.map(async (s) => {
      const body = JSON.stringify({ workspace_id: s.workspace_id });
      const sig = signSeatSync(s.workspace_id, secret);
      const res = await fetch(`${siteUrl}/api/internal/seat-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Seat-Sync-Signature": sig },
        body,
      });
      return { workspace_id: s.workspace_id, status: res.status };
    }),
  );

  const failed = results
    .map((r, i) => ({ r, workspace_id: subs[i].workspace_id }))
    .filter(({ r }) =>
      r.status === "rejected" ||
      (r.status === "fulfilled" && (r.value.status < 200 || r.value.status >= 300))
    )
    .map(({ workspace_id, r }) => ({
      workspace_id,
      error: r.status === "rejected" ? String(r.reason) : `HTTP ${r.value.status}`,
    }));

  return NextResponse.json({
    total: subs.length,
    successes: results.length - failed.length,
    failures: failed.length,
    failed,
  });
}
