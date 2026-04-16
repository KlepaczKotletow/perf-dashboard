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

## Unused indexes — defer cleanup until production traffic confirms

The Supabase advisor reports ~19 indexes as "never used":

```
idx_conversation_states_active, idx_conversation_states_assignment_id,
notification_log_workspace_idx, idx_subscriptions_stripe_customer,
idx_subscriptions_stripe_subscription, idx_subscriptions_setup_token,
idx_goals_employee, idx_cycle_questions_competency_id,
idx_performance_cycles_created_by, idx_users_manager_id, idx_users_level_id,
idx_competencies_job_family_id, idx_survey_responses_participant_id,
idx_review_assignments_calibrated_by, idx_surveys_workspace_id,
idx_competencies_category, idx_role_competencies_role,
idx_role_competencies_competency, idx_cycles_nami_pending,
idx_surveys_nami_pending, idx_assignments_incomplete,
idx_performance_cycles_workspace_status, idx_users_workspace_role,
idx_score_descriptors_competency
```

Most of these cover queries the app genuinely issues (e.g. `users.manager_id`
for direct-reports lookups, `review_assignments.cycle_id+status` partial for
completion tracking). The "unused" verdict is an artefact of low production
traffic so far, not evidence the indexes are dead.

**Review cadence:** after the first month of real customer traffic, rerun
the advisor. Drop only indexes that are *both* flagged AND have no matching
query pattern in `src/` or `supabase/functions/`. Use
`pg_stat_user_indexes.idx_scan` as the confirming signal — an index with
`idx_scan = 0` after sustained traffic is genuinely dead.

Rough pair-with script:

```sql
SELECT relname, indexrelname, idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public' AND idx_scan = 0
ORDER BY relname;
```

Drop with `DROP INDEX IF EXISTS <name>;` and monitor for P95 regressions on
the affected table's typical query shapes.
