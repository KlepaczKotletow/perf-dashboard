import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { SLACK_BOT_SCOPES } from "@/lib/slack-scopes";

// Smoke test for the Slack install path. Wired to a Vercel cron in
// vercel.json so a regression pages on the next tick instead of waiting
// for an admin to click a broken button.
//
// What it catches (the bugs that prompted this route):
//   - Banner / setup link points somewhere that 302s away from Slack.
//   - slack-reinstall is reachable but missing required scopes.
//   - OAUTH_STATE_SECRET on Supabase is gone / rotated mid-deploy.
//   - slack-reinstall stops producing a signed state.
//
// Returns 200 + a per-check JSON breakdown on green, 503 on any failure.
// Public on purpose — no secret material in the response.

export const dynamic = "force-dynamic";

interface Check {
  name: string;
  ok: boolean;
  detail?: string;
}

async function checkSlackReinstall(supabaseUrl: string): Promise<Check[]> {
  const checks: Check[] = [];
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/slack-reinstall`, {
      redirect: "manual",
      cache: "no-store",
    });
    if (res.status !== 302) {
      checks.push({
        name: "slack-reinstall responds 302",
        ok: false,
        detail: `got ${res.status}`,
      });
      return checks;
    }
    checks.push({ name: "slack-reinstall responds 302", ok: true });

    const loc = res.headers.get("location") || "";
    if (!loc.startsWith("https://slack.com/oauth/v2/authorize")) {
      checks.push({
        name: "slack-reinstall redirects to slack.com",
        ok: false,
        detail: loc.slice(0, 120),
      });
      return checks;
    }
    checks.push({ name: "slack-reinstall redirects to slack.com", ok: true });

    const url = new URL(loc);
    const requested = (url.searchParams.get("scope") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const missing = SLACK_BOT_SCOPES.filter((s) => !requested.includes(s));
    if (missing.length > 0) {
      checks.push({
        name: "slack-reinstall requests all required bot scopes",
        ok: false,
        detail: `missing: ${missing.join(",")}`,
      });
    } else {
      checks.push({
        name: "slack-reinstall requests all required bot scopes",
        ok: true,
      });
    }

    const state = url.searchParams.get("state") || "";
    if (!state.includes(".")) {
      checks.push({
        name: "slack-reinstall produces signed state",
        ok: false,
        detail: state ? "no dot separator" : "empty",
      });
    } else {
      checks.push({
        name: "slack-reinstall produces signed state",
        ok: true,
      });
    }
  } catch (e) {
    checks.push({
      name: "slack-reinstall reachable",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }
  return checks;
}

async function checkOAuthStateProbe(supabaseUrl: string): Promise<Check[]> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/oauth-state-probe`, {
      cache: "no-store",
    });
    const body = (await res.json().catch(() => null)) as
      | { ok?: boolean; reason?: string }
      | null;
    if (res.status !== 200 || !body?.ok) {
      return [
        {
          name: "oauth state sign+verify round-trip",
          ok: false,
          detail: `status=${res.status} ${body?.reason ?? "unknown"}`,
        },
      ];
    }
    return [{ name: "oauth state sign+verify round-trip", ok: true }];
  } catch (e) {
    return [
      {
        name: "oauth-state-probe reachable",
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      },
    ];
  }
}

export async function GET() {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL.trim().replace(/\/+$/, "");

  const [reinstallChecks, probeChecks] = await Promise.all([
    checkSlackReinstall(supabaseUrl),
    checkOAuthStateProbe(supabaseUrl),
  ]);

  const checks = [...reinstallChecks, ...probeChecks];
  const ok = checks.every((c) => c.ok);

  return NextResponse.json(
    { ok, checks, checkedAt: new Date().toISOString() },
    { status: ok ? 200 : 503 },
  );
}
