# Supabase Auth — manual settings checklist

These settings live in the Supabase dashboard and cannot be applied via MCP or
migrations. A project admin needs to flip them once.

## Enable leaked-password protection

**Why:** Supabase Auth can check new passwords against HaveIBeenPwned to reject
credentials known to be compromised. Advisor flags this as `auth_leaked_password_protection`.
Best-in-class HR tools (Lattice, Leapsome, Culture Amp) all have this on.

**How:**
1. Open [Auth → Providers → Email](https://supabase.com/dashboard/project/zhfvxfvmdlpdfgxrwtdn/auth/providers?provider=Email)
2. Scroll to "Password security"
3. Toggle **Prevent use of leaked passwords** ON
4. Save.

**Note:** This feature requires Pro Plan or above. Nami's primary auth path is
Slack OAuth, so the email/password path is mostly a fallback — but we should
still harden it.

## Switch Auth DB connections to percentage-based

**Why:** Advisor flags `auth_db_connections_absolute` — the Auth server is
pinned to a 10-connection cap. If you ever upgrade the instance size, Auth
won't benefit from the extra capacity.

**How:** This is managed under the project's compute / scaling settings in
the Supabase dashboard. Switch from "Absolute" to "Percentage" for the Auth
connection allocation.

**Priority:** LOW until the project scales beyond current instance size.
