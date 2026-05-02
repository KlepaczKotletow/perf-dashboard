// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { NineBoxGrid } from "../nine-box-grid";

afterEach(() => cleanup());

const assignments = [
  { id: "a1", employee: { id: "u1", slack_name: "Alice", department: "Eng" }, final_grade: "Exceptional", potential_rating: 5, overall_rating: 4.5 },
  { id: "a2", employee: { id: "u2", slack_name: "Bob", department: "Eng" }, final_grade: "Meets Expectations", potential_rating: 3, overall_rating: 3 },
  { id: "a3", employee: { id: "u3", slack_name: "Carol", department: "Sales" }, final_grade: null, potential_rating: null, overall_rating: 2 },
];

describe("<NineBoxGrid>", () => {
  it("renders 9 boxes", () => {
    render(<NineBoxGrid assignments={assignments} onChipClick={() => {}} onMove={() => {}} />);
    expect(screen.getAllByTestId(/^box-\d-\d$/)).toHaveLength(9);
  });

  it("renders row and column axis labels", () => {
    render(<NineBoxGrid assignments={assignments} onChipClick={() => {}} onMove={() => {}} />);
    expect(screen.getByText(/High Potential/i)).toBeInTheDocument();
    expect(screen.getByText(/Strong/i)).toBeInTheDocument();
    expect(screen.getByText(/Below/i)).toBeInTheDocument();
  });

  it("places graded chips in their matching box", () => {
    render(<NineBoxGrid assignments={assignments} onChipClick={() => {}} onMove={() => {}} />);
    // Alice: Exceptional + potential 5 → row 2, col 2
    expect(screen.getByTestId("box-2-2")).toHaveTextContent("Alice");
    // Bob: Meets + potential 3 → row 1, col 1
    expect(screen.getByTestId("box-1-1")).toHaveTextContent("Bob");
  });

  it("places ungraded chips in the parking lot", () => {
    render(<NineBoxGrid assignments={assignments} onChipClick={() => {}} onMove={() => {}} />);
    expect(screen.getByTestId("box-parking")).toHaveTextContent("Carol");
  });

  it("calls onChipClick when a chip is clicked", () => {
    const handler = vi.fn();
    render(<NineBoxGrid assignments={assignments} onChipClick={handler} onMove={() => {}} />);
    fireEvent.click(screen.getByText("Alice"));
    expect(handler).toHaveBeenCalledWith("a1");
  });

  it("renders nothing fancy when assignments array is empty", () => {
    render(<NineBoxGrid assignments={[]} onChipClick={() => {}} onMove={() => {}} />);
    // 9 boxes still rendered (empty)
    expect(screen.getAllByTestId(/^box-\d-\d$/)).toHaveLength(9);
    // Parking lot is hidden when empty
    expect(screen.queryByTestId("box-parking")).toBeNull();
  });
});
