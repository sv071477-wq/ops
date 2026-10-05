import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FacultyUtilizationView } from "./FacultyUtilizationView";
import { TrainingSession } from "@/lib/api";

const COLUMN_STORAGE_KEY = "ops.table.faculty-utilization.columns";

function makeSession(overrides: Partial<TrainingSession> = {}): TrainingSession {
  return {
    id: "row-1",
    batch_id: "BATCH_001",
    training_session_id: "session-001",
    faculty_name: "Dr Asha Menon",
    date_of_training: "2026-03-05",
    start_time: "10:00:00",
    end_time: "13:00:00",
    topic: "Async patterns",
    no_of_hours: 3,
    venue: "Bengaluru Campus",
    location_city: "Bengaluru",
    mode_of_delivery: "InPerson",
    status: "Completed",
    feedback_submitted: true,
    feedback_rating: 4,
    outcome_reason: "Delivered",
    outcome_at: "2026-03-05T14:00:00Z",
    outcome_by: "lead-01",
    vertical: "Engineering",
    program_type_id: "pt-77",
    faculty_type_name: "Adjunct",
    created_at: "2026-02-01T00:00:00Z",
    updated_at: "2026-02-02T00:00:00Z",
    client: "Northwind",
    category: "Bootcamp",
    batch_code: "BC-001",
    coordinator: "Ravi",
    module_feedback: "Strong session",
    ...overrides,
  } as TrainingSession;
}

function renderView(props: Partial<React.ComponentProps<typeof FacultyUtilizationView>> = {}) {
  render(<FacultyUtilizationView data={[]} isLoading={false} error={null} {...props} />);
}

function headerCells(): HTMLElement[] {
  return screen.getAllByRole("columnheader");
}

function firstBodyRow(): HTMLElement {
  const bodies = document.querySelectorAll("tbody");
  const row = bodies[0].querySelector("tr");
  if (!row) throw new Error("no body row rendered");
  return row as HTMLElement;
}

function bodyCellCount(): number {
  return firstBodyRow().querySelectorAll("td").length;
}

describe("FacultyUtilizationView column visibility", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders every declared column and hides the raw ids and audit trail by default", async () => {
    const user = userEvent.setup();
    renderView({ data: [makeSession()] });

    await user.click(screen.getByRole("button", { name: /Columns/ }));

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(27);
    expect(screen.getByRole("checkbox", { name: "Training Session ID" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Outcome Reason" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Faculty Full Name" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Topic" })).toBeChecked();
  });

  it("keeps header and body cells 1:1 when a visible column is switched off", async () => {
    const user = userEvent.setup();
    renderView({ data: [makeSession()] });

    expect(headerCells()).toHaveLength(15);
    expect(bodyCellCount()).toBe(15);

    await user.click(screen.getByRole("button", { name: /Columns/ }));
    await user.click(screen.getByRole("checkbox", { name: "Topic" }));

    expect(headerCells()).toHaveLength(14);
    expect(screen.queryByRole("columnheader", { name: /Topic/ })).toBeNull();
    expect(bodyCellCount()).toBe(14);
  });

  it("keeps header and body cells 1:1 when a default-hidden column is switched on", async () => {
    const user = userEvent.setup();
    renderView({ data: [makeSession()] });

    expect(screen.queryByRole("columnheader", { name: /Training Session ID/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: /Columns/ }));
    await user.click(screen.getByRole("checkbox", { name: "Training Session ID" }));

    expect(screen.getByRole("columnheader", { name: /Training Session ID/ })).toBeTruthy();
    expect(headerCells()).toHaveLength(16);
    expect(bodyCellCount()).toBe(16);
  });

  it("restores all 27 columns after Show all columns", async () => {
    const user = userEvent.setup();
    renderView({ data: [makeSession()] });

    await user.click(screen.getByRole("button", { name: /Columns/ }));
    await user.click(screen.getByRole("button", { name: /Show all columns/ }));

    expect(headerCells()).toHaveLength(27);
    expect(bodyCellCount()).toBe(27);
    expect(screen.getByRole("columnheader", { name: /Outcome Reason/ })).toBeTruthy();
  });

  it("persists the chosen layout under the view's own storage key", async () => {
    const user = userEvent.setup();
    renderView({ data: [makeSession()] });

    await user.click(screen.getByRole("button", { name: /Columns/ }));
    await user.click(screen.getByRole("checkbox", { name: "Topic" }));

    const stored: string[] = JSON.parse(window.localStorage.getItem(COLUMN_STORAGE_KEY) ?? "[]");
    expect(stored).toContain("topic");
    expect(stored).toContain("outcomeReason");
  });
});

describe("FacultyUtilizationView sorting", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("sorts ISO training dates chronologically instead of comparing the rendered strings", async () => {
    const user = userEvent.setup();
    // `formatDate` renders these as "28-04-2026" and "03-05-2026", so any
    // comparator that reads the formatted text puts MAY first in ascending
    // order. Only an ISO-aware comparison gets APR first.
    const earlier = makeSession({ id: "row-earlier", date_of_training: "2026-04-28", batch_code: "APR" });
    const later = makeSession({ id: "row-later", date_of_training: "2026-05-03", batch_code: "MAY" });
    renderView({ data: [later, earlier] });

    const dateHeader = screen.getByRole("columnheader", { name: /Date of Training/ });

    // Newest first is the view's default order.
    expect(dateHeader).toHaveAttribute("aria-sort", "descending");
    expect(within(firstBodyRow()).getByText("MAY")).toBeTruthy();

    // Re-picking the active column in "Sort by" flips the direction.
    const sortSelect = screen.getByLabelText("Sort by");
    await user.selectOptions(sortSelect, "dateOfTraining");
    expect(dateHeader).toHaveAttribute("aria-sort", "ascending");
    expect(within(firstBodyRow()).getByText("APR")).toBeTruthy();

    await user.selectOptions(sortSelect, "dateOfTraining");
    expect(dateHeader).toHaveAttribute("aria-sort", "descending");
    expect(within(firstBodyRow()).getByText("MAY")).toBeTruthy();
  });
});

describe("FacultyUtilizationView states", () => {
  it("renders the error message instead of an empty state", () => {
    renderView({ data: [makeSession()], error: "Utilization service unreachable" });

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Utilization service unreachable")).toBeTruthy();
    expect(screen.queryByText(/No utilization records in the ledger yet/)).toBeNull();
    expect(screen.queryByText(/No records match the current filters/)).toBeNull();
  });

  it("shows the loading state while the ledger is empty and loading", () => {
    renderView({ data: [], isLoading: true });

    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText(/Loading utilization records/)).toBeTruthy();
  });

  it("separates an empty ledger from rows hidden by filters", async () => {
    const user = userEvent.setup();
    render(<FacultyUtilizationView data={[]} isLoading={false} error={null} />);
    expect(screen.getByText("No utilization records in the ledger yet")).toBeTruthy();
    cleanup();

    renderView({ data: [makeSession()] });
    // The bespoke Feedback control is reachable by its label now, not just by
    // its options.
    await user.selectOptions(screen.getByLabelText("Feedback"), "PENDING");

    expect(screen.getByText("No records match the current filters")).toBeTruthy();
    expect(screen.queryByText("No utilization records in the ledger yet")).toBeNull();

    await user.click(screen.getByRole("button", { name: /Clear filters/i }));
    expect(within(firstBodyRow()).getByText("Async patterns")).toBeTruthy();
  });
});