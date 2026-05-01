// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { EditablePhaseTimeline } from "../editable-phase-timeline";

afterEach(() => cleanup());

describe("<EditablePhaseTimeline>", () => {
  const start = new Date("2026-06-01T00:00:00Z");
  const end = new Date("2026-09-01T00:00:00Z");

  it("renders all six default phase bands", () => {
    render(<EditablePhaseTimeline startDate={start} endDate={end} overrides={[]} onChange={() => {}} />);
    expect(screen.getByText(/Goal/i)).toBeInTheDocument();
    expect(screen.getByText(/Self/i)).toBeInTheDocument();
    expect(screen.getByText(/Peer/i)).toBeInTheDocument();
    expect(screen.getByText(/Manager/i)).toBeInTheDocument();
    expect(screen.getByText(/Calibration/i)).toBeInTheDocument();
    expect(screen.getByText(/Results/i)).toBeInTheDocument();
  });

  it("shows 5 drag handles between 6 phases", () => {
    render(<EditablePhaseTimeline startDate={start} endDate={end} overrides={[]} onChange={() => {}} />);
    expect(screen.getAllByRole("slider")).toHaveLength(5);
  });

  it("renders empty when end <= start", () => {
    const { container } = render(
      <EditablePhaseTimeline startDate={end} endDate={start} overrides={[]} onChange={() => {}} />
    );
    expect(container.querySelector('[role="slider"]')).toBeNull();
  });
});
