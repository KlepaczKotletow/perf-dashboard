import { describe, it, expect } from "vitest";
import { resolveLevel, type LevelRef } from "../level-resolution";

const LEVELS: LevelRef[] = [
  { id: "eng-senior", name: "Senior Engineer", familyName: "Engineering" },
  { id: "eng-staff", name: "Staff Engineer", familyName: "Engineering" },
  { id: "des-lead", name: "Lead Designer", familyName: "Design" },
  // "Analyst" deliberately exists in two families — the ambiguity case.
  { id: "data-analyst", name: "Analyst", familyName: "Data & Analytics" },
  { id: "ops-analyst", name: "Analyst", familyName: "Operations" },
];

describe("resolveLevel", () => {
  it("matches on function + level", () => {
    expect(resolveLevel(LEVELS, "Engineering", "Senior Engineer")).toEqual({
      levelId: "eng-senior",
      warning: null,
    });
  });

  it("is case and whitespace insensitive", () => {
    expect(resolveLevel(LEVELS, "  ENGINEERING ", "staff engineer").levelId).toBe("eng-staff");
  });

  it("falls back to level alone when the name is unique", () => {
    expect(resolveLevel(LEVELS, undefined, "Lead Designer").levelId).toBe("des-lead");
  });

  it("refuses to guess when a level name spans two functions", () => {
    const r = resolveLevel(LEVELS, undefined, "Analyst");
    expect(r.levelId).toBeNull();
    expect(r.warning).toMatch(/more than one function/);
  });

  it("still resolves an ambiguous level name once the function disambiguates", () => {
    expect(resolveLevel(LEVELS, "Operations", "Analyst").levelId).toBe("ops-analyst");
    expect(resolveLevel(LEVELS, "Data & Analytics", "Analyst").levelId).toBe("data-analyst");
  });

  it("warns rather than silently dropping an unknown level", () => {
    const r = resolveLevel(LEVELS, "Engineering", "Distinguished Engineer");
    expect(r.levelId).toBeNull();
    expect(r.warning).toMatch(/No level "Distinguished Engineer" under function "Engineering"/);
  });

  it("warns when a function is given with no level", () => {
    const r = resolveLevel(LEVELS, "Engineering", undefined);
    expect(r.levelId).toBeNull();
    expect(r.warning).toMatch(/both are needed/);
  });

  it("stays silent when neither column is present", () => {
    expect(resolveLevel(LEVELS, undefined, undefined)).toEqual({ levelId: null, warning: null });
    expect(resolveLevel(LEVELS, "", "  ")).toEqual({ levelId: null, warning: null });
  });

  it("handles a workspace with no career framework at all", () => {
    const r = resolveLevel([], "Engineering", "Senior Engineer");
    expect(r.levelId).toBeNull();
    expect(r.warning).toMatch(/create it in Functions first/);
  });
});
