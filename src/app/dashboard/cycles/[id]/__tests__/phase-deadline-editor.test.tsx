// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { PhaseDeadlineEditor } from "../phase-deadline-editor";

afterEach(() => cleanup());

describe("<PhaseDeadlineEditor>", () => {
  const phase = {
    id: "p1",
    name: "Self Assessment",
    phase_type: "self_assessment",
    status: "active" as const,
    start_date: "2026-06-01T00:00:00Z",
    end_date: "2026-07-01T00:00:00Z",
    is_user_customized: false,
  };

  it("shows phase name and current deadline", () => {
    render(<PhaseDeadlineEditor phase={phase} canEdit={true} cycleId="c1" />);
    expect(screen.getByText(/Self Assessment/i)).toBeInTheDocument();
    expect(screen.getByText(/Jul 1/i)).toBeInTheDocument();
  });

  it("hides edit button when canEdit=false", () => {
    render(<PhaseDeadlineEditor phase={phase} canEdit={false} cycleId="c1" />);
    expect(screen.queryByRole("button", { name: /edit/i })).toBeNull();
  });

  it("hides edit button when phase is completed", () => {
    const completedPhase = { ...phase, status: "completed" as const };
    render(<PhaseDeadlineEditor phase={completedPhase} canEdit={true} cycleId="c1" />);
    expect(screen.queryByRole("button", { name: /edit/i })).toBeNull();
  });
});
