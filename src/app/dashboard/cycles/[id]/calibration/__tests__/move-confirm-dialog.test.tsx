// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import {
  MoveConfirmDialog,
  type PendingMove,
} from "../move-confirm-dialog";

afterEach(() => cleanup());

const samplePending: PendingMove = {
  assignmentId: "a1",
  employeeName: "Alice",
  before: { final_grade: "Meets Expectations", potential: 3 },
  after: { final_grade: "Exceeds Expectations", potential: 4 },
};

describe("<MoveConfirmDialog>", () => {
  it("renders nothing when pending is null", () => {
    render(
      <MoveConfirmDialog
        pending={null}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.queryByText(/Why this change/i)).toBeNull();
  });

  it("shows employee name and before/after grades when pending", () => {
    render(
      <MoveConfirmDialog
        pending={samplePending}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText(/Why this change/i)).toBeInTheDocument();
    expect(screen.getByText("Alice:", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Meets Expectations")).toBeInTheDocument();
    expect(screen.getByText("Exceeds Expectations")).toBeInTheDocument();
  });

  it("calls onConfirm with the typed note (trimmed) when Confirm is clicked", () => {
    const handler = vi.fn();
    render(
      <MoveConfirmDialog
        pending={samplePending}
        onConfirm={handler}
        onCancel={() => {}}
      />,
    );
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "  Strong delivery  " } });
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    expect(handler).toHaveBeenCalledWith("Strong delivery");
  });

  it("calls onCancel when Cancel is clicked", () => {
    const handler = vi.fn();
    render(
      <MoveConfirmDialog
        pending={samplePending}
        onConfirm={() => {}}
        onCancel={handler}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(handler).toHaveBeenCalled();
  });
});
