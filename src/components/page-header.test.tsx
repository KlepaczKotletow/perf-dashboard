// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { PageHeader } from "./page-header";

describe("PageHeader", () => {
  it("renders the title and hat chip", () => {
    render(<PageHeader hat="my-work" title="Goals" />);
    expect(screen.getByText("Goals")).toBeInTheDocument();
    expect(screen.getByText("My Work")).toBeInTheDocument();
  });

  it("renders subtitle when provided", () => {
    render(<PageHeader hat="my-team" title="Sarah Chen" subtitle="Review · Q1 2026" />);
    expect(screen.getByText("Sarah Chen")).toBeInTheDocument();
    expect(screen.getByText("Review · Q1 2026")).toBeInTheDocument();
    expect(screen.getByText("My Team")).toBeInTheDocument();
  });

  it("renders the Manage hat label for admin pages", () => {
    render(<PageHeader hat="manage" title="Cycles" />);
    expect(screen.getByText("Manage")).toBeInTheDocument();
  });

  it("renders actions in the header when provided", () => {
    render(
      <PageHeader
        hat="my-work"
        title="Goals"
        actions={<button type="button">Create</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
  });

  it("omits subtitle when not provided", () => {
    const { container } = render(<PageHeader hat="my-work" title="Home" />);
    expect(container.querySelector("[data-subtitle]")).toBeNull();
  });
});
