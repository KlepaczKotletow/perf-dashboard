import { describe, it, expect } from "vitest";
import { isValidTargetPath } from "../validate-target-path";

describe("isValidTargetPath", () => {
  const cases: Array<[unknown, boolean, string]> = [
    ["/dashboard", true, "bare dashboard"],
    ["/dashboard/goals", true, "nested dashboard path"],
    ["/dashboard/reviews/123", true, "dashboard with id"],
    ["/dashboard?tab=active", true, "dashboard with query"],
    ["/", false, "root is not dashboard"],
    ["//evil.com", false, "protocol-relative URL"],
    ["//evil.com/dashboard", false, "protocol-relative even with dashboard"],
    ["/dashboard\\@evil.com", false, "backslash injection"],
    ["http://evil.com", false, "absolute URL"],
    ["https://evil.com/dashboard", false, "https absolute URL"],
    ["/dashboard/../admin", false, "path traversal"],
    ["/dashboard/..", false, "trailing traversal"],
    ["", false, "empty string"],
    ["dashboard", false, "missing leading slash"],
    ["/dashboard\x00injected", false, "null byte"],
    ["/dashboard\ninjected", false, "newline control char"],
    [null, false, "null input"],
    [undefined, false, "undefined input"],
    [42, false, "number input"],
  ];

  it.each(cases)("%s (%s) → %s", (path, expected) => {
    expect(isValidTargetPath(path)).toBe(expected);
  });
});
