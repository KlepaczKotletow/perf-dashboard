import { describe, it, expect } from "vitest";
import {
  shouldDeliverNow,
  snoozeWindowEnd,
  coercePrefs,
  defaultPrefs,
  NotificationPrefs,
} from "../notification-rules";

const realtime: NotificationPrefs = {
  mode: "realtime",
  digest_hour: 9,
  digest_timezone: "UTC",
  snoozed_until: null,
};
const digest: NotificationPrefs = { ...realtime, mode: "digest" };
const criticalOnly: NotificationPrefs = { ...realtime, mode: "critical_only" };

const now = new Date("2026-06-15T13:00:00Z");

describe("shouldDeliverNow", () => {
  it("delivers normal in realtime mode", () => {
    expect(shouldDeliverNow(realtime, "normal", now)).toBe(true);
  });

  it("blocks normal in digest mode (will be rolled up)", () => {
    expect(shouldDeliverNow(digest, "normal", now)).toBe(false);
  });

  it("blocks normal in critical_only mode", () => {
    expect(shouldDeliverNow(criticalOnly, "normal", now)).toBe(false);
  });

  it("blocks normal when snoozed in the future", () => {
    const snoozed: NotificationPrefs = {
      ...realtime,
      snoozed_until: "2026-06-15T15:00:00Z",
    };
    expect(shouldDeliverNow(snoozed, "normal", now)).toBe(false);
  });

  it("delivers normal once snooze has passed", () => {
    const snoozed: NotificationPrefs = {
      ...realtime,
      snoozed_until: "2026-06-15T12:00:00Z",
    };
    expect(shouldDeliverNow(snoozed, "normal", now)).toBe(true);
  });

  it("ignores malformed snoozed_until rather than throwing", () => {
    const snoozed: NotificationPrefs = {
      ...realtime,
      snoozed_until: "not-a-date",
    };
    expect(shouldDeliverNow(snoozed, "normal", now)).toBe(true);
  });

  it("ALWAYS delivers critical regardless of mode", () => {
    expect(shouldDeliverNow(realtime, "critical", now)).toBe(true);
    expect(shouldDeliverNow(digest, "critical", now)).toBe(true);
    expect(shouldDeliverNow(criticalOnly, "critical", now)).toBe(true);
  });

  it("ALWAYS delivers critical even when snoozed", () => {
    const snoozed: NotificationPrefs = {
      ...digest,
      snoozed_until: "2030-01-01T00:00:00Z",
    };
    expect(shouldDeliverNow(snoozed, "critical", now)).toBe(true);
  });
});

describe("snoozeWindowEnd", () => {
  it("returns now + hours", () => {
    const end = snoozeWindowEnd(now, 4);
    expect(end.toISOString()).toBe("2026-06-15T17:00:00.000Z");
  });

  it("handles fractional hours (though we don't use them)", () => {
    const end = snoozeWindowEnd(now, 0.5);
    expect(end.toISOString()).toBe("2026-06-15T13:30:00.000Z");
  });
});

describe("coercePrefs", () => {
  it("returns defaults for null/undefined/junk input", () => {
    const d = defaultPrefs();
    expect(coercePrefs(null)).toEqual(d);
    expect(coercePrefs(undefined)).toEqual(d);
    expect(coercePrefs(42)).toEqual(d);
    expect(coercePrefs("string")).toEqual(d);
  });

  it("preserves valid fields", () => {
    expect(
      coercePrefs({
        mode: "digest",
        digest_hour: 14,
        digest_timezone: "Europe/Warsaw",
        snoozed_until: "2026-06-20T00:00:00Z",
      }),
    ).toEqual({
      mode: "digest",
      digest_hour: 14,
      digest_timezone: "Europe/Warsaw",
      snoozed_until: "2026-06-20T00:00:00Z",
    });
  });

  it("rejects out-of-range digest_hour", () => {
    expect(coercePrefs({ digest_hour: 99 }).digest_hour).toBe(9);
    expect(coercePrefs({ digest_hour: -1 }).digest_hour).toBe(9);
  });

  it("rejects unknown modes", () => {
    expect(coercePrefs({ mode: "loud" }).mode).toBe("realtime");
  });
});
