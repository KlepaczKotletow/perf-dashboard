// @vitest-environment node
import { describe, it, expect } from "vitest";
import { buildDigest, type DigestSections } from "../nami-blocks";

const empty: DigestSections = {
  pendingReviews: [],
  pendingSelfAssessments: [],
  pendingPeerReviews: [],
  attentionGoals: [],
};

const sample: DigestSections = {
  pendingReviews: [
    { label: "Alice — Q2 Review", due: "2026-08-15T00:00:00Z", url: "https://example/a" },
    { label: "Bob — Q2 Review", due: "2026-08-15T00:00:00Z" },
  ],
  pendingSelfAssessments: [
    { label: "Q2 Performance Review", due: "2026-08-10T00:00:00Z" },
  ],
  pendingPeerReviews: [],
  attentionGoals: [
    { label: "Ship payments v2", url: "https://example/g1" },
  ],
  dashboardUrl: "https://example.dashboard",
};

describe("buildDigest", () => {
  it("returns null when there is nothing pending", () => {
    expect(buildDigest("Filip", empty)).toBeNull();
  });

  it("renders header + greeting + sections + actions when items present", () => {
    const blocks = buildDigest("Filip", sample) as any[];
    expect(blocks).not.toBeNull();
    // First block: header
    expect(blocks[0].type).toBe("header");
    expect(blocks[0].text.text).toMatch(/daily Nami digest/i);
    // Greeting includes the user's name
    expect(JSON.stringify(blocks[1])).toContain("Filip");
    // Reviews section present with both names
    const review = blocks.find(
      (b) => b.type === "section" && JSON.stringify(b).includes("review"),
    );
    expect(review).toBeDefined();
    expect(JSON.stringify(review)).toContain("Alice");
    expect(JSON.stringify(review)).toContain("Bob");
    // Self-assessment section
    expect(JSON.stringify(blocks)).toContain("self-assessment");
    // Goal attention section
    expect(JSON.stringify(blocks)).toContain("Ship payments v2");
    // Footer actions present (dashboard + snooze + switch-to-realtime)
    const actions = blocks.find((b) => b.type === "actions");
    expect(actions).toBeDefined();
    expect(JSON.stringify(actions)).toContain("Open dashboard");
    expect(JSON.stringify(actions)).toContain("Snooze 24h");
    expect(JSON.stringify(actions)).toContain("Switch to realtime");
  });

  it("does NOT include the dashboard button when no dashboardUrl is given", () => {
    const blocks = buildDigest("Filip", { ...sample, dashboardUrl: null }) as any[];
    const actions = blocks.find((b: any) => b.type === "actions");
    expect(JSON.stringify(actions)).not.toContain("Open dashboard");
    // But snooze + realtime stay present.
    expect(JSON.stringify(actions)).toContain("Snooze 24h");
  });

  it("formats due dates as 'due Aug 15'", () => {
    const blocks = buildDigest("Filip", sample) as any[];
    const flat = JSON.stringify(blocks);
    expect(flat).toMatch(/due 15 Aug|due Aug 15|due 10 Aug/i);
  });

  it("caps each section at a sensible upper bound (5 items)", () => {
    const big: DigestSections = {
      ...empty,
      pendingReviews: Array.from({ length: 12 }, (_, i) => ({
        label: `Person ${i + 1} — Review`,
      })),
    };
    const blocks = buildDigest("Filip", big) as any[];
    const flat = JSON.stringify(blocks);
    // Header still says total count (12), but only first 5 names render in the body.
    expect(flat).toContain("12 reviews to write");
    expect(flat).toContain("Person 1");
    expect(flat).toContain("Person 5");
    expect(flat).not.toContain("Person 6");
  });
});
