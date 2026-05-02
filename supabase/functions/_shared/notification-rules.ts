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
 * Returns the hour-of-day (0-23) in the given IANA timezone, or null if the
 * timezone string isn't recognised by the runtime (defensive — older Deno
 * builds might not have full ICU). Uses Intl.DateTimeFormat with hour12
 * disabled so we get clean 0-23 output.
 */
export function currentHourInTz(now: Date, timeZone: string): number | null {
  try {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "numeric",
      hour12: false,
    });
    const parts = fmt.formatToParts(now);
    const hourPart = parts.find((p) => p.type === "hour");
    if (!hourPart) return null;
    // Some locales output "24" for midnight; coerce that to 0 to keep the
    // 0-23 invariant the digest cron relies on.
    const raw = parseInt(hourPart.value, 10);
    if (Number.isNaN(raw)) return null;
    const h = raw === 24 ? 0 : raw;
    if (h < 0 || h > 23) return null;
    return h;
  } catch {
    return null;
  }
}

/**
 * Is the user due to receive their daily digest right now?
 *
 * Returns true when (a) mode == "digest" and (b) the current local hour in
 * the user's digest_timezone equals their digest_hour. The cron fires every
 * UTC hour; this helper fans out to per-user local-hour matches, which is
 * how we support digest delivery at e.g. 09:00 Europe/Warsaw and 09:00
 * America/Los_Angeles in the same hourly cadence without configuring per-tz
 * crons.
 *
 * Active snooze suppresses the digest — the daily roll-up is "normal"
 * priority and respects user pauses.
 *
 * Pure: takes `now` so unit tests can simulate any UTC moment.
 */
export function isDueForDigest(
  prefs: NotificationPrefs,
  now: Date = new Date(),
): boolean {
  if (prefs.mode !== "digest") return false;
  if (prefs.snoozed_until) {
    const until = new Date(prefs.snoozed_until);
    if (!Number.isNaN(until.getTime()) && until > now) return false;
  }
  const localHour = currentHourInTz(now, prefs.digest_timezone);
  if (localHour === null) return false;
  return localHour === prefs.digest_hour;
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
