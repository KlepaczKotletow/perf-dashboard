// Pure rules helper for notification delivery decisions.
//
// `shouldDeliverNow(prefs, priority, now)` returns true when a message should
// be delivered immediately, false when it should be deferred (snoozed) or
// suppressed (digest-mode normal-priority items get rolled up into the daily
// digest instead).
//
// Critical messages always deliver. Normal messages respect:
//   - mode: 'realtime'   → deliver
//   - mode: 'digest'     → defer (digest cron will pick it up)
//   - mode: 'critical_only' → defer (don't ever auto-deliver normal items)
//   - snoozed_until > now → defer regardless of mode
//
// This helper is shared between nami-bot (drain loop / send sites) and any
// future digest cron. Pure — no I/O, no Date.now() (caller passes `now`).

export interface NotificationPrefs {
  mode: "realtime" | "digest" | "critical_only";
  digest_hour: number;
  digest_timezone: string;
  snoozed_until: string | null;
}

export type Priority = "normal" | "critical";

export function shouldDeliverNow(
  prefs: NotificationPrefs,
  priority: Priority,
  now: Date = new Date(),
): boolean {
  // Critical messages always go through. Cycle launch DMs, grade releases,
  // and final escalations should never be delayed by user prefs.
  if (priority === "critical") return true;

  // Active snooze blocks normal messages.
  if (prefs.snoozed_until) {
    const until = new Date(prefs.snoozed_until);
    if (!Number.isNaN(until.getTime()) && until > now) return false;
  }

  // Mode gates the rest.
  if (prefs.mode === "digest") return false;
  if (prefs.mode === "critical_only") return false;

  // realtime
  return true;
}

/** Compute the timestamp at which a snooze of `hours` from `now` would end. */
export function snoozeWindowEnd(now: Date, hours: number): Date {
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

/**
 * Default prefs used when a user row is missing the column or has explicit
 * nulls. Realtime mode preserves pre-Sprint-3 behavior — flipping a workspace
 * to digest is opt-in per user.
 */
export function defaultPrefs(): NotificationPrefs {
  return {
    mode: "realtime",
    digest_hour: 9,
    digest_timezone: "UTC",
    snoozed_until: null,
  };
}

/**
 * Coerce an arbitrary jsonb value (potentially null, partial, or malformed)
 * into a valid NotificationPrefs. Defensive — older user rows might have a
 * partial shape from a pre-migration era.
 */
export function coercePrefs(raw: unknown): NotificationPrefs {
  const fallback = defaultPrefs();
  if (!raw || typeof raw !== "object") return fallback;
  const r = raw as Record<string, unknown>;
  const mode = r.mode === "digest" || r.mode === "critical_only" ? r.mode : "realtime";
  const digest_hour =
    typeof r.digest_hour === "number" && r.digest_hour >= 0 && r.digest_hour <= 23
      ? Math.floor(r.digest_hour)
      : fallback.digest_hour;
  const digest_timezone =
    typeof r.digest_timezone === "string" && r.digest_timezone.length > 0
      ? r.digest_timezone
      : fallback.digest_timezone;
  const snoozed_until =
    typeof r.snoozed_until === "string" ? r.snoozed_until : null;
  return { mode, digest_hour, digest_timezone, snoozed_until };
}
