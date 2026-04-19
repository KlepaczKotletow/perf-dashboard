# Pre-Launch Security Hardening Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the remaining pre-launch security gaps identified in the audit so the app can ship safely.

**Architecture:**
- Defense-in-depth: validate user-controlled inputs at every trust boundary (target paths, OAuth state).
- No external services required for the core fixes — rate limiting is scoped as optional because it requires Upstash provisioning.
- Keep changes surgical and commit per task so any single change can be reverted cleanly.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + Auth + Edge Functions), Vitest, TypeScript.

**Test framework:** Vitest. Tests live beside code in `__tests__/` directories. Run with `npm test`.

---

## Task Order & Dependencies

Phase 1 (independent, low-risk) → Phase 2 (new routes/middleware) → Phase 3 (optional, needs provisioning).

| # | Task | Risk | User action needed? |
|---|------|------|---------------------|
| 1 | Sanitize analytics export error message | low | no |
| 2 | Validate `targetPath` allowlist in `slack-link` | low | no |
| 3 | Remove `namihr.com` fallback from 7 edge functions | low | needs `DASHBOARD_URL` set in Supabase secrets |
| 4 | Add dashboard auth middleware | low | no |
| 5 | Add server-side logout endpoint | low | no |
| 6 | CSRF: store & verify Slack OAuth state | medium | no |
| 7 | Rate limit auth endpoints (OPTIONAL) | medium | needs Upstash account |

---

## Task 1: Sanitize analytics export error message

**Files:**
- Modify: `src/app/api/analytics/export/route.ts:120-125`

**Problem:** `catch` returns raw `err.message` to the client, leaking stack/SQL details.

**Step 1: Write failing test**

Create `src/app/api/analytics/export/__tests__/error-sanitization.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { sanitizeExportError } from "../error-sanitization";

describe("sanitizeExportError", () => {
  it("returns generic message for Error with SQL leak", () => {
    const err = new Error('relation "users" does not exist');
    expect(sanitizeExportError(err)).toBe("Failed to export analytics");
  });
  it("returns generic message for unknown throws", () => {
    expect(sanitizeExportError("boom")).toBe("Failed to export analytics");
  });
});
```

**Step 2:** Run `npm test -- error-sanitization` — expect FAIL (module missing).

**Step 3:** Create `src/app/api/analytics/export/error-sanitization.ts`:

```ts
// Never leak raw error messages to clients — they can expose SQL schema,
// internal paths, or Supabase credentials referenced in stack traces.
export function sanitizeExportError(_err: unknown): string {
  return "Failed to export analytics";
}
```

**Step 4:** Update `route.ts` catch block to use `sanitizeExportError(err)` instead of `err instanceof Error ? err.message : ...`.

**Step 5:** Run `npm test -- error-sanitization` — expect PASS. Run `npx tsc --noEmit` — expect no new errors.

**Step 6:** Commit:
```bash
git add src/app/api/analytics/export/
git commit -m "security: sanitize analytics export errors to prevent info leak"
```

---

## Task 2: Validate `targetPath` allowlist in slack-link

**Files:**
- Modify: `src/app/api/auth/slack-link/route.ts` (around line 86)
- Create: `src/app/api/auth/slack-link/validate-target-path.ts`
- Create: `src/app/api/auth/slack-link/__tests__/validate-target-path.test.ts`

**Problem:** `targetPath` from the redeemed token is concatenated onto `DASHBOARD_URL` without validation. Although minting is server-side only, an attacker with any SQL injection or internal compromise could mint tokens pointing to `//evil.com` or `/../admin`.

**Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { isValidTargetPath } from "../validate-target-path";

describe("isValidTargetPath", () => {
  it.each([
    ["/dashboard", true],
    ["/dashboard/goals", true],
    ["/dashboard/reviews/123", true],
    ["/", false],                        // not a dashboard path
    ["//evil.com", false],               // protocol-relative
    ["/dashboard\\@evil.com", false],    // backslash trick
    ["http://evil.com", false],          // absolute URL
    ["/dashboard/../admin", false],      // path traversal
    ["", false],
    ["dashboard", false],                // missing leading slash
  ])("path %s → %s", (path, expected) => {
    expect(isValidTargetPath(path)).toBe(expected);
  });
});
```

**Step 2:** `npm test -- validate-target-path` → FAIL.

**Step 3:** Implement:

```ts
/**
 * Guard against open-redirect via the `targetPath` stored in
 * `dashboard_link_tokens`. Only allow paths that:
 *   - start with a single `/`
 *   - are scoped under /dashboard
 *   - contain no `..` segments, no backslashes, no control chars
 */
export function isValidTargetPath(path: unknown): path is string {
  if (typeof path !== "string" || path.length === 0) return false;
  if (!path.startsWith("/dashboard")) return false;
  if (path.startsWith("//")) return false;         // protocol-relative
  if (path.includes("\\")) return false;           // backslash / UNC
  if (path.includes("..")) return false;           // traversal
  if (/[\x00-\x1f]/.test(path)) return false;      // control chars
  return true;
}
```

**Step 4:** In `route.ts`, after destructuring `target_path`, reject invalid paths:

```ts
if (!isValidTargetPath(targetPath)) {
  console.error("[slack-link] invalid target path rejected:", targetPath);
  return errorRedirect(DASHBOARD_URL, "invalid_target");
}
```

**Step 5:** `npm test` → PASS. `npx tsc --noEmit` → clean.

**Step 6:** Commit:
```bash
git add src/app/api/auth/slack-link/
git commit -m "security: validate targetPath against allowlist in slack-link redeemer"
```

---

## Task 3: Remove `namihr.com` hardcoded fallback from edge functions

**Files (7 edge functions):**
- `supabase/functions/slack-oauth/index.ts:8`
- `supabase/functions/nami-bot/index.ts:29-30`
- `supabase/functions/slack-events/index.ts:14`
- `supabase/functions/slack-interactivity/index.ts:9`
- `supabase/functions/dashboard-auth/index.ts:8`
- `supabase/functions/send-deadline-reminders/index.ts:6`
- `supabase/functions/cycle-notifications/index.ts:6`

**Problem:** If `DASHBOARD_URL` secret is missing in a non-prod Supabase project, links redirect users to production.

**Step 1:** For each file, replace the fallback pattern. Example:

Before:
```ts
const DASHBOARD_URL = Deno.env.get("DASHBOARD_URL") || "https://namihr.com";
```

After:
```ts
const DASHBOARD_URL = Deno.env.get("DASHBOARD_URL");
if (!DASHBOARD_URL) {
  throw new Error("DASHBOARD_URL secret is not configured for this Supabase project");
}
```

For the two that use `.replace(/\/+$/, "")`, preserve that trailing-slash strip after the null check.

**Step 2:** There are no tests for edge functions currently — manually grep for `namihr.com` to confirm 0 matches remain in `supabase/functions/`:

```bash
grep -r "namihr.com" supabase/functions/
```
Expect: no results.

**Step 3:** Commit:
```bash
git add supabase/functions/
git commit -m "security: remove namihr.com fallback from edge functions, require DASHBOARD_URL secret"
```

**⚠️ User action after deploy:** Set `DASHBOARD_URL` in Supabase → Project Settings → Edge Functions → Secrets.

---

## Task 4: Add dashboard auth middleware

**Files:**
- Create: `src/middleware.ts`

**Problem:** Each dashboard layout calls `getUserWorkspace()` and redirects if null, but a global middleware gives a uniform first-line check and protects any route under `/dashboard` against developer mistakes (forgetting the check in a new layout).

**Step 1:** Create `src/middleware.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";

/**
 * Coarse first-line auth check for /dashboard/* routes. Pages still call
 * getUserWorkspace() for the workspace-scoped check — this middleware just
 * fails fast for unauthenticated requests.
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => cookies.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        ),
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "?signin=required";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
```

**Step 2:** Verify `@supabase/ssr` is already installed:

```bash
grep '"@supabase/ssr"' package.json
```
If missing, install: `npm install @supabase/ssr`.

**Step 3:** Start dev server and smoke-test:
- Visit `/dashboard` without being logged in → should redirect to `/?signin=required`
- Visit `/dashboard` while logged in → should load

**Step 4:** Commit:
```bash
git add src/middleware.ts package.json package-lock.json
git commit -m "security: add dashboard auth middleware"
```

---

## Task 5: Add server-side logout endpoint

**Files:**
- Create: `src/app/api/auth/logout/route.ts`
- Modify: `src/app/dashboard/footer-dropdown.tsx:25-41` — also call the API route

**Problem:** Logout is client-only via `supabase.auth.signOut()`. That clears local session but doesn't actively revoke server-side refresh tokens. A stolen device that's already offline can keep the old session alive.

**Step 1:** Create the route:

```ts
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => toSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options),
        ),
      },
    },
  );
  // `global` scope revokes the refresh token across all devices. Use
  // `local` if we ever want single-device signout.
  await supabase.auth.signOut({ scope: "global" });
  return NextResponse.json({ ok: true });
}
```

**Step 2:** Update `footer-dropdown.tsx`: before (or in place of) the client-side `signOut()`, `fetch("/api/auth/logout", { method: "POST" })`.

**Step 3:** Smoke-test: sign out and confirm redirect, then try to navigate to `/dashboard` — should redirect to `/?signin=required` (middleware from task 4 will handle this).

**Step 4:** Commit:
```bash
git add src/app/api/auth/logout/ src/app/dashboard/footer-dropdown.tsx
git commit -m "security: add server-side logout endpoint with global scope"
```

---

## Task 6: CSRF — store & verify Slack OAuth state

**Files:**
- Modify: `src/app/page.tsx:17` — store state in httpOnly cookie
- Modify: `supabase/functions/slack-oauth/index.ts:35` — verify state against cookie

**Problem:** `oauthState` is generated on the landing page but never stored, and `slack-oauth` reads it from the query string without any comparison. A malicious page can forge a Slack install callback.

**Approach:** Store the generated state in an httpOnly, SameSite=Lax cookie when the user clicks "Add to Slack". The Slack callback reads the cookie and checks it equals the `state` query param.

**Step 1:** Replace inline `crypto.randomUUID()` generation with a server action or API route that sets the cookie AND returns the state for embedding in the Slack install URL.

Create `src/app/api/auth/slack-oauth-state/route.ts`:

```ts
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export async function GET() {
  const state = `nonce_${randomUUID()}`;
  const response = NextResponse.json({ state });
  response.cookies.set("slack_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600, // 10 minutes — covers a slow Slack OAuth round-trip
    path: "/",
  });
  return response;
}
```

**Step 2:** In `page.tsx`, change the OAuth state generation to fetch from the API route before clicking install (e.g. on mount or on click). Embed the returned state in the Slack URL.

**Step 3:** Modify `slack-oauth/index.ts` around line 35 to read the cookie and compare:

```ts
const returnedState = url.searchParams.get("state");
const cookieHeader = req.headers.get("cookie") ?? "";
const cookieState = /(?:^|;\s*)slack_oauth_state=([^;]+)/.exec(cookieHeader)?.[1];

if (!returnedState || !cookieState || returnedState !== cookieState) {
  return new Response("Invalid OAuth state", { status: 400 });
}
```

**Step 4:** After successful exchange, clear the cookie in the response by setting `Set-Cookie: slack_oauth_state=; Max-Age=0; Path=/`.

**Step 5:** Smoke-test the full Slack OAuth install flow.

**Step 6:** Commit:
```bash
git add src/app/api/auth/slack-oauth-state/ src/app/page.tsx supabase/functions/slack-oauth/
git commit -m "security: verify Slack OAuth state via httpOnly cookie"
```

---

## Task 7 (OPTIONAL): Rate limit auth endpoints

**Files:**
- Create: `src/lib/rate-limit.ts`
- Modify: `src/app/api/auth/slack-link/route.ts`, `src/app/api/auth/logout/route.ts`

**Problem:** Auth endpoints have no rate limiting. Attackers can brute-force tokens or hammer signout.

**Prerequisite (user action):**
1. Create Upstash account at https://upstash.com
2. Create a Redis database (free tier is fine)
3. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
4. Add both to `.env.local` AND Vercel project settings

**Step 1:** Install: `npm install @upstash/ratelimit @upstash/redis`.

**Step 2:** Create `src/lib/rate-limit.ts`:

```ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = process.env.UPSTASH_REDIS_REST_URL
  ? Redis.fromEnv()
  : null;

// Graceful no-op in local dev when Upstash isn't configured. Production
// MUST set these env vars — Vercel env lints will catch missing values.
export const authRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      analytics: true,
      prefix: "rl:auth",
    })
  : null;

export async function checkRateLimit(id: string) {
  if (!authRateLimit) return { success: true, remaining: 99 };
  return authRateLimit.limit(id);
}
```

**Step 3:** Gate the auth endpoints. At the top of each handler:

```ts
const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
const { success } = await checkRateLimit(ip);
if (!success) {
  return NextResponse.json({ error: "Too many requests" }, { status: 429 });
}
```

**Step 4:** Commit:
```bash
git add src/lib/rate-limit.ts src/app/api/auth/ package.json package-lock.json .env.local.example
git commit -m "security: rate limit auth endpoints via Upstash"
```

---

## Final Verification

After all tasks:

1. `npm run lint` → no new errors
2. `npx tsc --noEmit` → no errors
3. `npm test` → all tests pass
4. Manual: load `/dashboard` logged out → redirects to `/?signin=required`
5. Manual: sign out → confirm session invalidated server-side (try navigating back)
6. Manual: Slack install flow with tampered `state` query param → rejects with 400

## Post-Deploy User Actions (dashboard clicks, no code)

- Supabase → Authentication → Email → OTP expiry = 900
- Supabase → Authentication → Password → Enable "Leaked password protection"
- Supabase → Edge Functions → Secrets → set `DASHBOARD_URL`
- Vercel → Environment Variables → add `DASHBOARD_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
