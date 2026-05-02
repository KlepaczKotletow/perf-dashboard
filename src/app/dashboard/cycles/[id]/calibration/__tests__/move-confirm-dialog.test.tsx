// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import {
  MoveConfirmDialog,
  type PendingMove,
} from "../move-confirm-dialog";

afterEach(() => cleanup());

// "Material" move: cross-quadrant (Meets col → Exceeds col). Triggers
// the mandatory-rationale guard.
const samplePending: PendingMove = {
  assignmentId: "a1",
  employeeName: "Alice",
  before: { final_grade: "Meets Expectations", potential: 3 },
  after: { final_grade: "Exceeds Expectations", potential: 4 },
};

// "Non-material" move: same column (Exceeds → Exceeds, just potential up).
// No rationale required.
const sampleNonMaterial: PendingMove = {
  assignmentId: "a2",
  employeeName: "Bob",
  before: { final_grade: "Exceeds Expectations", potential: 3 },
  after: { final_grade: "Exceeds Expectations", potential: 5 },
};

describe("<MoveConfirmDialog>", () => {
  it("renders nothing when pending is null", () => {
    render(
      <MoveConfirmDialog
        pending={null}
        onConfirm={async () => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.queryByText(/Why this change/i)).toBeNull();
  });

  it("shows employee name and before/after grades when pending", () => {
    render(
      <MoveConfirmDialog
        pending={samplePending}
        onConfirm={async () => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText(/Why this change/i)).toBeInTheDocument();
    expect(screen.getByText("Alice:", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Meets Expectations")).toBeInTheDocument();
    expect(screen.getByText("Exceeds Expectations")).toBeInTheDocument();
  });

  it("calls onConfirm with the typed note (trimmed) when Confirm is clicked", () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    // Use a non-material move so the rationale is optional and Confirm is
    // enabled with a short (or empty) note. The trim behavior is the focus.
    render(
      <MoveConfirmDialog
        pending={sampleNonMaterial}
        onConfirm={handler}
        onCancel={async () => {}}
      />,
    );
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "  Strong delivery  " } });
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    expect(handler).toHaveBeenCalledWith("Strong delivery");
  });

  it("disables Confirm on material moves until the rationale is long enough", () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    render(
      <MoveConfirmDialog
        pending={samplePending}
        onConfirm={handler}
        onCancel={async () => {}}
      />,
    );
    const confirmBtn = screen.getByRole("button", { name: /confirm/i });
    // Initially: empty note → Confirm disabled
    expect(confirmBtn).toBeDisabled();
    // Material-move warning should be visible
    expect(screen.getByText(/material change/i)).toBeInTheDocument();
    // Type a short rationale (still under 30 chars) → Confirm stays disabled
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "good job" } });
    expect(confirmBtn).toBeDisabled();
    // Type a long-enough rationale → Confirm enabled, click works
    fireEvent.change(textarea, {
      target: {
        value: "Strong delivery this half plus mentoring two junior engineers",
      },
    });
    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);
    expect(handler).toHaveBeenCalledWith(
      "Strong delivery this half plus mentoring two junior engineers",
    );
  });

  it("allows Confirm without a rationale on non-material moves", () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    render(
      <MoveConfirmDialog
        pending={sampleNonMaterial}
        onConfirm={handler}
        onCancel={async () => {}}
      />,
    );
    expect(screen.queryByText(/material change/i)).toBeNull();
    const confirmBtn = screen.getByRole("button", { name: /confirm/i });
    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);
    expect(handler).toHaveBeenCalledWith("");
  });

  it("shows the error message and stays open when onConfirm rejects", async () => {
    const handler = vi.fn().mockRejectedValue(new Error("Move was skipped"));
    render(
      <MoveConfirmDialog
        pending={sampleNonMaterial}
        onConfirm={handler}
        onCancel={async () => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    // Microtask flush — allow the rejected promise to be caught by the dialog
    await new Promise((r) => setTimeout(r, 0));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Move was skipped/);
    // Dialog still open
    expect(screen.getByText(/Why this change/i)).toBeInTheDocument();
  });

  it("calls onCancel when Cancel is clicked", () => {
    const handler = vi.fn();
    render(
      <MoveConfirmDialog
        pending={samplePending}
        onConfirm={async () => {}}
        onCancel={handler}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(handler).toHaveBeenCalled();
  });
});
