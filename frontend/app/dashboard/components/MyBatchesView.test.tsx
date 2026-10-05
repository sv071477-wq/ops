import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MyBatchesView } from "./MyBatchesView";
import { Batch } from "@/lib/api";

function makeBatch(overrides: Partial<Batch> = {}): Batch {
  return {
    id: "b-1",
    batch_id: "BATCH_001",
    category: "Bootcamp",
    residential_type: "Residential",
    program_name: "Full Stack Python",
    delivery_mode: "Online",
    training_days: 5,
    total_hours: 40,
    total_enrollments: 30,
    residential_enrollments: 30,
    non_residential_enrollments: 0,
    status: "Approval 1 Pending",
    is_schema_locked: false,
    created_at: "2027-01-01T00:00:00Z",
    updated_at: "2027-01-01T00:00:00Z",
    ...overrides,
  } as Batch;
}

function renderView(props: Partial<React.ComponentProps<typeof MyBatchesView>> = {}) {
  const onOpenBatchDetail = vi.fn();
  const onPageChange = vi.fn();
  const onPageSizeChange = vi.fn();

  render(
    <MyBatchesView
      data={[]}
      isLoading={false}
      error={null}
      onOpenBatchDetail={onOpenBatchDetail}
      page={1}
      pageSize={10}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      {...props}
    />
  );

  return { onOpenBatchDetail, onPageChange, onPageSizeChange };
}

describe("MyBatchesView schedule column", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("flags a batch with no timetable as Not scheduled", () => {
    renderView({ data: [makeBatch({ scheduled_session_count: 0 })] });

    expect(screen.getByText("Not scheduled")).toBeTruthy();
    expect(screen.queryByText(/^\d+ days?$/)).toBeNull();
  });

  it("treats a missing count as unscheduled rather than rendering NaN", () => {
    renderView({ data: [makeBatch()] });

    expect(screen.getByText("Not scheduled")).toBeTruthy();
  });

  it("shows the scheduled day count once a timetable exists", () => {
    renderView({ data: [makeBatch({ scheduled_session_count: 12 })] });

    expect(screen.getByText("12 days")).toBeTruthy();
    expect(screen.queryByText("Not scheduled")).toBeNull();
  });

  it("uses the singular form for a single scheduled day", () => {
    renderView({ data: [makeBatch({ scheduled_session_count: 1 })] });

    expect(screen.getByText("1 day")).toBeTruthy();
  });
});

describe("MyBatchesView row actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens the batch detail for the row whose Manage Schedule was clicked", async () => {
    const user = userEvent.setup();
    const target = makeBatch({ id: "b-target", batch_id: "TARGET_BATCH", scheduled_session_count: 4 });
    const other = makeBatch({ id: "b-other", batch_id: "OTHER_BATCH" });
    const { onOpenBatchDetail } = renderView({ data: [other, target] });

    const buttons = screen.getAllByRole("button", { name: /Manage Schedule/i });
    await user.click(buttons[1]);

    expect(onOpenBatchDetail).toHaveBeenCalledTimes(1);
    expect(onOpenBatchDetail).toHaveBeenCalledWith(target);
  });

  it("opens the batch detail when the row body itself is clicked", async () => {
    const user = userEvent.setup();
    const target = makeBatch({ id: "b-target", batch_id: "TARGET_BATCH" });
    const { onOpenBatchDetail } = renderView({ data: [target] });

    await user.click(screen.getByText("TARGET_BATCH"));

    expect(onOpenBatchDetail).toHaveBeenCalledWith(target);
  });
});

describe("MyBatchesView empty state", () => {
  it("offers Add New Batch when the user can create batches", () => {
    const onCreateBatch = vi.fn();
    renderView({ data: [], canCreateBatch: true, onCreateBatch });

    expect(screen.getByText("No batches assigned to you yet")).toBeTruthy();
    // Once in the panel toolbar and once inside the empty state, matching the
    // admin tables.
    expect(screen.getAllByRole("button", { name: /Add New Batch/i }).length).toBeGreaterThan(0);
  });

  it("omits the create pointer when the user cannot create batches", () => {
    renderView({ data: [], canCreateBatch: false });

    expect(screen.getByText("No batches assigned to you yet")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Add New Batch/i })).toBeNull();
  });
});

describe("MyBatchesView column visibility", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("hides a column the user switched off and shows it again", async () => {
    const user = userEvent.setup();
    renderView({ data: [makeBatch()] });

    expect(screen.getByRole("columnheader", { name: /Training Days/ })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Columns/ }));
    await user.click(screen.getByRole("checkbox", { name: "Training Days" }));

    expect(screen.queryByRole("columnheader", { name: /Training Days/ })).toBeNull();
    expect(screen.getByRole("columnheader", { name: /Batch & Program/ })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Show all columns/ }));
    expect(screen.getByRole("columnheader", { name: /Training Days/ })).toBeTruthy();
  });
});
