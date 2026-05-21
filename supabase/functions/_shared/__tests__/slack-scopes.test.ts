// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  SLACK_BOT_SCOPES as NEXT_BOT,
  SLACK_BOT_SCOPE_STRING as NEXT_BOT_STRING,
  SLACK_USER_SCOPES as NEXT_USER,
} from "@/lib/slack-scopes";
import {
  SLACK_BOT_SCOPES as DENO_BOT,
  SLACK_BOT_SCOPE_STRING as DENO_BOT_STRING,
  SLACK_USER_SCOPES as DENO_USER,
} from "../slack-scopes";

// Parity guard: the Next.js and Deno copies of the Slack scope SoT MUST be
// identical. They are two source files because they live in two runtimes
// (Next.js / Deno edge), but every install URL builder in the system reads
// from one of these two — drift between them produces missing_scopes errors
// at the slack-oauth validator (see PR #19, and the dashboard-auth subset
// regression after that).

describe("Slack scope SoT parity (Next.js ↔ Deno)", () => {
  it("bot scope arrays are identical", () => {
    expect([...DENO_BOT]).toEqual([...NEXT_BOT]);
  });

  it("bot scope strings are identical", () => {
    expect(DENO_BOT_STRING).toBe(NEXT_BOT_STRING);
  });

  it("user scopes are identical", () => {
    expect(DENO_USER).toBe(NEXT_USER);
  });
});
