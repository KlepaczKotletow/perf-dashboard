import { describe, it, expect } from "vitest";
import {
  shouldDeliverNow,
  snoozeWindowEnd,
  coercePrefs,
  defaultPrefs,
  isDueForDigest,
  currentHourInTz,
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

describe("currentHourInTz", () => {
  it("returns 0-23 for a known timezone", () => {
    // 2026-06-15 13:00 UTC = 15:00 Europe/Warsaw (CEST)
    const utc = new Date("2026-06-15T13:00:00Z");
    expect(currentHourInTz(utc, "Europe/Warsaw")).toBe(15);
  });

  it("returns the same hour for UTC ↔ UTC", () => {
    expect(currentHourInTz(new Date("2026-06-15T13:00:00Z"), "UTC")).toBe(13);
    expect(currentHourInTz(new Date("2026-06-15T00:00:00Z"), "UTC")).toBe(0);
  });

  it("handles negative offsets (e.g. America/Los_Angeles)", () => {
    // 2026-06-15 13:00 UTC = 06:00 PDT
    expect(
      currentHourInTz(new Date("2026-06-15T13:00:00Z"), "America/Los_Angeles"),
    ).toBe(6);
  });

  it("returns null for an invalid timezone", () => {
    expect(currentHourInTz(new Date(), "Not/A_Real_Tz")).toBeNull();
  });
});

describe("isDueForDigest", () => {
  const baseDigest: NotificationPrefs = {
    mode: "digest",
    digest_hour: 9,
    digest_timezone: "UTC",
    snoozed_until: null,
  };

  it("fires when local hour matches digest_hour", () => {
    const utc9 = new Date("2026-06-15T09:00:00Z");
    expect(isDueForDigest(baseDigest, utc9)).toBe(true);
  });

  it("does NOT fire on adjacent hours", () => {
    const utc8 = new Date("2026-06-15T08:00:00Z");
    const utc10 = new Date("2026-06-15T10:00:00Z");
    expect(isDueForDigest(baseDigest, utc8)).toBe(false);
    expect(isDueForDigest(baseDigest, utc10)).toBe(false);
  });

  it("respects digest_timezone (Warsaw)", () => {
    const warsawPrefs: NotificationPrefs = {
      ...baseDigest,
      digest_timezone: "Europe/Warsaw",
    };
    // 07:00 UTC = 09:00 CEST (summer)
    const utc7 = new Date("2026-06-15T07:00:00Z");
    expect(isDueForDigest(warsawPrefs, utc7)).toBe(true);
    // 09:00 UTC = 11:00 CEST → not the digest hour
    const utc9 = new Date("2026-06-15T09:00:00Z");
    expect(isDueForDigest(warsawPrefs, utc9)).toBe(false);
  });

  it("does NOT fire for non-digest modes", () => {
    const realtime: NotificationPrefs = { ...baseDigest, mode: "realtime" };
    const criticalOnly: NotificationPrefs = { ...baseDigest, mode: "critical_only" };
    const utc9 = new Date("2026-06-15T09:00:00Z");
    expect(isDueForDigest(realtime, utc9)).toBe(false);
    expect(isDueForDigest(criticalOnly, utc9)).toBe(false);
  });

  it("does NOT fire when actively snoozed", () => {
    const snoozed: NotificationPrefs = {
      ...baseDigest,
      snoozed_until: "2026-06-15T15:00:00Z",
    };
    const utc9 = new Date("2026-06-15T09:00:00Z");
    expect(isDueForDigest(snoozed, utc9)).toBe(false);
  });

  it("DOES fire after a past snooze has expired", () => {
    const snoozed: NotificationPrefs = {
      ...baseDigest,
      snoozed_until: "2026-06-14T09:00:00Z",
    };
    const utc9 = new Date("2026-06-15T09:00:00Z");
    expect(isDueForDigest(snoozed, utc9)).toBe(true);
  });

  it("does NOT fire when timezone is invalid (defensive)", () => {
    const broken: NotificationPrefs = { ...baseDigest, digest_timezone: "Bad/Zone" };
    const utc9 = new Date("2026-06-15T09:00:00Z");
    expect(isDueForDigest(broken, utc9)).toBe(false);
  });
});
