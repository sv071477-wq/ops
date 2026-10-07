import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FacultyUtilizationView } from "./FacultyUtilizationView";
import { TrainingSession } from "@/lib/api";

const COLUMN_STORAGE_KEY = "ops.table.faculty-utilization.columns.v2";

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

    expect(headerCells()).toHaveLength(12);
    expect(bodyCellCount()).toBe(12);

    await user.click(screen.getByRole("button", { name: /Columns/ }));
    await user.click(screen.getByRole("checkbox", { name: "Topic" }));

    expect(headerCells()).toHaveLength(11);
    expect(screen.queryByRole("columnheader", { name: /Topic/ })).toBeNull();
    expect(bodyCellCount()).toBe(11);
  });

  it("keeps header and body cells 1:1 when a default-hidden column is switched on", async () => {
    const user = userEvent.setup();
    renderView({ data: [makeSession()] });

    expect(screen.queryByRole("columnheader", { name: /Training Session ID/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: /Columns/ }));
    await user.click(screen.getByRole("checkbox", { name: "Training Session ID" }));

    expect(screen.getByRole("columnheader", { name: /Training Session ID/ })).toBeTruthy();
    expect(headerCells()).toHaveLength(13);
    expect(bodyCellCount()).toBe(13);
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
    // Feedback is one of the secondary filters, so it lives behind the toggle.
    await user.click(screen.getByRole("button", { name: /More filters/i }));
    await user.selectOptions(screen.getByLabelText("Feedback"), "PENDING");

    expect(screen.getByText("No records match the current filters")).toBeTruthy();
    expect(screen.queryByText("No utilization records in the ledger yet")).toBeNull();

    await user.click(screen.getByRole("button", { name: /Clear filters/i }));
    expect(within(firstBodyRow()).getByText("Async patterns")).toBeTruthy();
  });
});

describe("FacultyUtilizationView filter layout", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  function openMoreFilters(user: ReturnType<typeof userEvent.setup>) {
    return user.click(screen.getByRole("button", { name: /More filters/i }));
  }

  it("keeps the primary toolbar row to the filters that identify a delivery", () => {
    renderView({ data: [makeSession()] });

    // Twelve controls on one row wrapped into three ragged lines. The primary
    // row is now search + four dropdowns + sort + clear.
    expect(screen.getByLabelText("Search")).toBeTruthy();
    for (const label of ["Faculty", "Status", "Mode", "Client"]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
    expect(screen.getByLabelText("Sort by")).toBeTruthy();

    // The rest are not on that row yet. `Vertical` is not on it either and not
    // behind the toggle: no seeder populates it, so a dropdown over it could
    // only ever offer its own "All verticals" placeholder.
    for (const label of ["Faculty Type", "Coordinator", "Category", "City", "Vertical"]) {
      expect(screen.queryByLabelText(label)).toBeNull();
    }
  });

  it("reveals the secondary filters when More filters is opened", async () => {
    const user = userEvent.setup();
    renderView({ data: [makeSession()] });

    const toggle = screen.getByRole("button", { name: /More filters/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await openMoreFilters(user);

    expect(screen.getByRole("button", { name: /More filters/i })).toHaveAttribute("aria-expanded", "true");
    for (const label of ["Faculty Type", "Coordinator", "Category", "City", "Feedback"]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
    expect(screen.getByLabelText("Date From")).toBeTruthy();
    expect(screen.getByLabelText("Date To")).toBeTruthy();
    // Open state really does carry the panel border, so the collapsed-state
    // assertion below is testing the render and not a bad selector.
    expect(document.getElementById("faculty-utilization-more-filters-panel")).toBeTruthy();
    expect(document.querySelector('[style*="border: 1px solid var(--border-subtle)"]')).toBeTruthy();
  });

  it("renders no bordered panel while More filters is collapsed", () => {
    renderView({ data: [makeSession()] });

    // The regression: an always-rendered panel wrapper left an empty bordered
    // box hanging below the toolbar around a lone button.
    expect(screen.getByRole("button", { name: /More filters/i })).toBeTruthy();
    expect(document.getElementById("faculty-utilization-more-filters-panel")).toBeNull();
    expect(screen.queryByLabelText("Feedback")).toBeNull();
    expect(document.querySelector('[style*="border: 1px solid var(--border-subtle)"]')).toBeNull();
  });

  it("hides a filter column that is blank across every row and restores it once a value exists", async () => {
    const user = userEvent.setup();
    const blank = makeSession({ id: "row-blank", category: "", topic: "No category" });
    renderView({ data: [blank] });

    await openMoreFilters(user);
    // `Category` has no values to filter by, so its dropdown would be dead UI.
    expect(screen.queryByLabelText("Category")).toBeNull();

    cleanup();
    renderView({ data: [blank, makeSession({ id: "row-filled", category: "Bootcamp" })] });

    await openMoreFilters(user);
    expect(screen.getByLabelText("Category")).toBeTruthy();
  });

  it("narrows rows by a secondary filter", async () => {
    const user = userEvent.setup();
    const adjunct = makeSession({ id: "row-adjunct", faculty_type_name: "Adjunct", topic: "Async patterns" });
    const internal = makeSession({ id: "row-internal", faculty_type_name: "Internal", topic: "Spark tuning" });
    renderView({ data: [adjunct, internal] });

    await openMoreFilters(user);
    await user.selectOptions(screen.getByLabelText("Faculty Type"), "Internal");

    expect(within(firstBodyRow()).getByText("Spark tuning")).toBeTruthy();
    expect(screen.queryByText("Async patterns")).toBeNull();
  });

  it("counts filters left inside the collapsed panel on the toggle", async () => {
    const user = userEvent.setup();
    renderView({ data: [makeSession()] });

    // A filter applied while expanded stays applied when the panel closes, so
    // the toggle has to keep advertising it.
    await openMoreFilters(user);
    await user.selectOptions(screen.getByLabelText("Coordinator"), "Ravi");
    await user.selectOptions(screen.getByLabelText("Feedback"), "SUBMITTED");

    const toggle = screen.getByRole("button", { name: /More filters/i });
    expect(toggle).toHaveTextContent("2");

    await openMoreFilters(user);
    await user.click(screen.getByRole("button", { name: /Clear/i }));

    expect(screen.getByRole("button", { name: /More filters/i })).toHaveTextContent("More filters");
    expect(screen.getByRole("button", { name: /More filters/i }).textContent).not.toMatch(/\d/);
  });

  it("keeps the training date as the pinned first column", () => {
    renderView({ data: [makeSession()] });

    // `table-pin-first-col` sticks whatever column is physically first, so the
    // anchor has to be the date a reader scans by, not an attribute column.
    const firstHeader = screen.getAllByRole("columnheader")[0];
    expect(firstHeader).toHaveTextContent("Date of Training");
    expect(firstHeader).toHaveAttribute("aria-sort", "descending");
  });

  it("lists the 12 default columns in reading order", () => {
    renderView({ data: [makeSession()] });

    expect(headerCells().map((cell) => cell.textContent)).toEqual([
      "Date of Training",
      "Faculty Full Name",
      "Batch ID",
      "Topic",
      "No. of Hours",
      "Status",
      "Mode of Delivery",
      "Feedback Rating",
      "Client",
      "Category",
      "Coordinator",
      "Location/City",
    ]);
  });

  it("truncates a long cell to one line and keeps the full text in the title", () => {
    const topic = "Async patterns and structured concurrency across a distributed scheduler";
    renderView({ data: [makeSession({ topic })] });

    const cell = within(firstBodyRow()).getByText(topic);
    expect(cell.tagName).toBe("TD");
    expect(cell.getAttribute("title")).toBe(topic);
    expect(cell.style.whiteSpace).toBe("nowrap");
    expect(cell.style.textOverflow).toBe("ellipsis");
    expect(cell.style.overflow).toBe("hidden");
  });

  it("renders an empty cell as a muted placeholder rather than real data", () => {
    renderView({ data: [makeSession({ category: "" })] });

    const cell = within(firstBodyRow()).getByText("—");
    expect(cell.style.color).toBe("var(--text-muted)");
  });

  it("keeps a zero value instead of rendering it as an empty placeholder", () => {
    renderView({ data: [makeSession({ no_of_hours: 0, feedback_rating: 0 })] });

    const row = firstBodyRow();
    expect(within(row).queryByText("—")).toBeNull();
    expect(within(row).getAllByText("0")).toHaveLength(2);
  });

  it("derives the table min-width from the visible column set", async () => {
    const user = userEvent.setup();
    renderView({ data: [makeSession()] });

    const table = document.querySelector("table") as HTMLTableElement;
    const defaultWidth = Number.parseInt(table.style.minWidth, 10);
    // 2400px of minimum forced a horizontal scrollbar on every screen.
    expect(defaultWidth).toBeGreaterThan(0);
    expect(defaultWidth).toBeLessThan(2400);

    await user.click(screen.getByRole("button", { name: /Columns/ }));
    await user.click(screen.getByRole("button", { name: "Show all columns" }));

    expect(Number.parseInt(table.style.minWidth, 10)).toBeGreaterThan(defaultWidth);
  });
});