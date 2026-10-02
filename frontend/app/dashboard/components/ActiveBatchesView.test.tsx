import React from "react";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ActiveBatchesView } from "./ActiveBatchesView";
import type { ActiveBatchesResponse, ActiveSessionItem } from "@/lib/api";

function makeSession(overrides: Partial<ActiveSessionItem> = {}): ActiveSessionItem {
  return {
    id: "s-1",
    batch_id: "BATCH_001",
    batch_name: "Full Stack Python",
    session_type: "scheduled",
    module: "Python Basics",
    session_date: "2026-09-20",
    start_time: "2026-09-20T10:00:00",
    end_time: "2026-09-20T12:30:00",
    duration_hours: 2.5,
    status: "Scheduled",
    mode_of_delivery: "Online",
    ...overrides,
  };
}

function renderView(props: Partial<React.ComponentProps<typeof ActiveBatchesView>> = {}) {
  const onFilterDateChange = vi.fn();
  const onRefresh = vi.fn();

  render(
    <ActiveBatchesView
      filterDate="2026-09-20"
      onFilterDateChange={onFilterDateChange}
      data={null}
      isLoading={false}
      batchPage={1}
      batchPageSize={10}
      onBatchPageChange={vi.fn()}
      onBatchPageSizeChange={vi.fn()}
      sessionPage={1}
      sessionPageSize={15}
      onSessionPageChange={vi.fn()}
      onSessionPageSizeChange={vi.fn()}
      onRefresh={onRefresh}
      {...props}
    />
  );

  return { onFilterDateChange, onRefresh };
}

/** SummaryCard renders label, value and hint as siblings, so the value is the
 *  middle child of the label's parent. The batch table heading repeats some
 *  card labels, hence the multi-match fallback to the first (card) hit. */
function metricValue(label: string): string {
  const labelEl = screen.getAllByText(label)[0];
  return labelEl.parentElement?.children[1]?.textContent?.trim() ?? "";
}

describe("ActiveBatchesView summary metrics", () => {
  it("sums scheduled hours and counts distinct faculty", () => {
    const trainer = "Prof Sharma";
    const data: ActiveBatchesResponse = {
      filter_date: "2026-09-20",
      batches: [],
      sessions: [
        makeSession({ id: "s-1", trainer_name: trainer, duration_hours: 2.5 }),
        makeSession({ id: "s-2", trainer_name: trainer, duration_hours: 1.5 }),
        makeSession({
          id: "s-3",
          session_type: "actual",
          faculty_name: "Dr Rao",
          trainer_name: null,
          duration_hours: 3,
        }),
      ],
      total_batches: 0,
      total_sessions: 3,
      skip: 0,
      limit: 100,
    };

    renderView({ data });

    expect(metricValue("Hours Scheduled")).toBe("4.0 hrs");
    // "Dr Rao" plus the two scheduled rows, which share a trainer name.
    expect(metricValue("Faculty Deployed")).toBe("2");
  });

  it("does not count delivered hours toward the planned total", () => {
    const data: ActiveBatchesResponse = {
      filter_date: "2026-09-20",
      batches: [],
      sessions: [makeSession({ id: "s-1", session_type: "actual", faculty_name: "Dr Rao", duration_hours: 8 })],
      total_batches: 0,
      total_sessions: 1,
      skip: 0,
      limit: 100,
    };

    renderView({ data });

    expect(metricValue("Hours Scheduled")).toBe("0.0 hrs");
  });

  it("shows zeros rather than NaN when there is no data", () => {
    renderView({ data: null });

    expect(metricValue("Hours Scheduled")).toBe("0.0 hrs");
    expect(metricValue("Ongoing Batches")).toBe("0");
    expect(screen.queryByText("Delivery Sites")).toBeNull();
    expect(screen.queryByText("Enrolled Learners")).toBeNull();
  });
});

describe("ActiveBatchesView header controls", () => {
  it("renders the date filter and refresh in the top-right control group", () => {
    const { onRefresh } = renderView();

    const dateInput = screen.getByLabelText("Date") as HTMLInputElement;
    expect(dateInput.value).toBe("2026-09-20");
    expect(screen.getByRole("button", { name: /Refresh/i })).toBeTruthy();
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("reports the picked date and triggers a refresh", async () => {
    const user = userEvent.setup();
    const { onFilterDateChange, onRefresh } = renderView();

    // The input is controlled by the parent, so the pick is fired directly
    // rather than typed character by character.
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-09-21" } });
    expect(onFilterDateChange).toHaveBeenLastCalledWith("2026-09-21");

    await user.click(screen.getByRole("button", { name: /Refresh/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
