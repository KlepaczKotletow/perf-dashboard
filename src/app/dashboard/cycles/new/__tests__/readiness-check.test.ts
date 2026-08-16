import { describe, it, expect } from "vitest";
import { computeReadiness, type ReadinessUser } from "../readiness-check";

const u = (over: Partial<ReadinessUser> & { id: string }): ReadinessUser => ({
  slack_name: over.id,
  slack_email: `${over.id}@example.com`,
  slack_user_id: "U123",
  manager_id: null,
  level_id: "lvl",
  ...over,
});

describe("computeReadiness", () => {
  it("reports nothing when everyone is reachable, managed and levelled", () => {
    // "board" is not a colleague in this workspace, so the CEO counts as
    // structurally senior rather than an accidental omission.
    const users = [u({ id: "ceo", manager_id: "board" }), u({ id: "ic", manager_id: "ceo" })];
    expect(computeReadiness(users, ["ceo", "ic"])).toEqual([]);
  });

  it("does not nag about the top of the selection having no enrolled manager", () => {
    const users = [u({ id: "ceo", manager_id: "board" }), u({ id: "ic", manager_id: "ceo" })];
    const issues = computeReadiness(users, ["ceo", "ic"]);
    expect(issues.some((i) => i.key === "manager-not-enrolled")).toBe(false);
  });

  it("still flags the org root's missing manager — their review can never complete", () => {
    // Expected for a CEO, but the consequence is real: nobody writes that
    // manager review, so the assignment never reaches "completed" and the
    // cycle cannot auto-close. Better surfaced than silent.
    const users = [u({ id: "ceo" }), u({ id: "ic", manager_id: "ceo" })];
    const issues = computeReadiness(users, ["ceo", "ic"]);
    const noMgr = issues.find((i) => i.key === "no-manager");
    expect(noMgr?.people.map((p) => p.id)).toEqual(["ceo"]);
    expect(noMgr?.consequence).toMatch(/most senior person/i);
  });

  it("flags people with no Slack account as blocking", () => {
    const users = [u({ id: "boss" }), u({ id: "ghost", manager_id: "boss", slack_user_id: null })];
    const issues = computeReadiness(users, ["boss", "ghost"]);
    const blocking = issues.find((i) => i.key === "no-slack");
    expect(blocking?.severity).toBe("blocking");
    expect(blocking?.people.map((p) => p.id)).toEqual(["ghost"]);
  });

  it("only considers selected participants, not the whole workspace", () => {
    const users = [u({ id: "boss" }), u({ id: "ghost", manager_id: "boss", slack_user_id: null })];
    // ghost is not in the cycle, so their missing Slack account is irrelevant
    expect(computeReadiness(users, ["boss"]).some((i) => i.key === "no-slack")).toBe(false);
  });

  it("flags a participant with no manager", () => {
    const issues = computeReadiness([u({ id: "orphan" })], ["orphan"]);
    expect(issues.find((i) => i.key === "no-manager")?.people.map((p) => p.id)).toEqual(["orphan"]);
  });

  it("flags an accidentally omitted manager who is a real colleague", () => {
    const users = [u({ id: "boss", manager_id: "board" }), u({ id: "ic", manager_id: "boss" })];
    const issues = computeReadiness(users, ["ic"]); // boss exists but was left out
    expect(issues.find((i) => i.key === "manager-not-enrolled")?.people.map((p) => p.id)).toEqual(["ic"]);
  });

  it("does not flag manager-not-enrolled when the manager is in the cycle", () => {
    const users = [u({ id: "boss" }), u({ id: "ic", manager_id: "boss" })];
    const issues = computeReadiness(users, ["boss", "ic"]);
    expect(issues.some((i) => i.key === "manager-not-enrolled")).toBe(false);
  });

  it("flags a missing competency bracket, treating null and undefined alike", () => {
    const users = [
      u({ id: "boss" }),
      u({ id: "a", manager_id: "boss", level_id: null }),
      { id: "b", slack_name: "b", slack_email: null, slack_user_id: "U9", manager_id: "boss" } as ReadinessUser,
    ];
    const issues = computeReadiness(users, ["boss", "a", "b"]);
    expect(issues.find((i) => i.key === "no-level")?.people.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("orders issues by severity so the blocking one is read first", () => {
    const users = [u({ id: "x", slack_user_id: null, level_id: null })];
    const issues = computeReadiness(users, ["x"]);
    expect(issues[0].severity).toBe("blocking");
    expect(issues.map((i) => i.severity)).toEqual(["blocking", "warning", "info"]);
  });

  it("handles an empty selection", () => {
    expect(computeReadiness([u({ id: "a" })], [])).toEqual([]);
  });

  it("describes the real consequence of a missing Slack account", () => {
    const issues = computeReadiness([u({ id: "g", slack_user_id: null })], ["g"]);
    const text = issues.find((i) => i.key === "no-slack")!.consequence;
    // The wizard used to claim these people "can still complete reviews
    // manually" — they cannot, they can't even sign in.
    expect(text).toMatch(/can't sign in/i);
  });
});
