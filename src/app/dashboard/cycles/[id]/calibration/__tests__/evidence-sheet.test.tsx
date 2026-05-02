// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Mock the data fetcher so the component never actually hits Supabase.
vi.mock("../evidence-data", () => ({
  getEmployeeEvidence: vi.fn(async () => ({
    managerResponses: [],
    peerComments: [],
    upwardComments: [],
    recentKudos: [],
    priorGrade: null,
  })),
}));

// Mock createBrowserClient so the component constructs without env vars.
vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn(() => ({})),
}));

import { EvidenceSheet } from "../evidence-sheet";

afterEach(() => cleanup());

describe("<EvidenceSheet>", () => {
  const baseProps = {
    open: true,
    onClose: () => {},
    workspaceId: "ws-1",
    cycleId: "c-1",
    assignments: [
      { id: "a1", employee: { id: "u1", slack_name: "Alice" } },
    ],
  };

  it("renders the sheet with the employee name", async () => {
    render(<EvidenceSheet {...baseProps} assignmentId="a1" />);
    expect(await screen.findByText("Alice")).toBeInTheDocument();
  });

  it("shows the empty state when there's no evidence", async () => {
    render(<EvidenceSheet {...baseProps} assignmentId="a1" />);
    expect(await screen.findByText(/No evidence yet/i)).toBeInTheDocument();
  });
});
