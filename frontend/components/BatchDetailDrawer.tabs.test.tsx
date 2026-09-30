import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const getBatch = vi.fn();
const getBatchOptions = vi.fn();
const getFacultyTypes = vi.fn();
const getVerticals = vi.fn();
const getProgramTypes = vi.fn();
const getSessions = vi.fn();
const getScheduledSessions = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    api: {
      getBatch: (...a: unknown[]) => getBatch(...a),
      getBatchOptions: (...a: unknown[]) => getBatchOptions(...a),
      getFacultyTypes: (...a: unknown[]) => getFacultyTypes(...a),
      getVerticals: (...a: unknown[]) => getVerticals(...a),
      getProgramTypes: (...a: unknown[]) => getProgramTypes(...a),
      getSessions: (...a: unknown[]) => getSessions(...a),
      getScheduledSessions: (...a: unknown[]) => getScheduledSessions(...a),
    },
  };
});

import { BatchDetailDrawer, BatchDetailTab } from "./BatchDetailDrawer";
import { ConfirmProvider } from "./ConfirmProvider";
import { Batch } from "@/lib/api";

const batch = {
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
} as Batch;

function renderDrawer(initialTab?: BatchDetailTab) {
  return render(
    <ConfirmProvider>
      <BatchDetailDrawer batch={batch} isOpen onClose={() => {}} initialTab={initialTab} />
    </ConfirmProvider>
  );
}

describe("BatchDetailDrawer initialTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBatch.mockResolvedValue(batch);
    getBatchOptions.mockResolvedValue([]);
    getFacultyTypes.mockResolvedValue([]);
    getVerticals.mockResolvedValue([]);
    getProgramTypes.mockResolvedValue([]);
    getSessions.mockResolvedValue([]);
    getScheduledSessions.mockResolvedValue([]);
  });

  it("lands on the timetable when initialTab is sessions", async () => {
    renderDrawer("sessions");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Ingest Timetable/i })).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: /Add Session/i })).toBeTruthy();
    expect(screen.queryByText("Curriculum / Program Title")).toBeNull();
  });

  it("lands on the overview when initialTab is omitted", async () => {
    renderDrawer();

    await waitFor(() => {
      expect(screen.getByText("Curriculum / Program Title")).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: /Ingest Timetable/i })).toBeNull();
  });

  it("re-applies the requested tab when a different batch is opened", async () => {
    const { rerender } = renderDrawer("overview");

    await waitFor(() => {
      expect(screen.getByText("Curriculum / Program Title")).toBeTruthy();
    });

    const second = { ...batch, id: "b-2", batch_id: "BATCH_002" };
    getBatch.mockResolvedValue(second);

    rerender(
      <ConfirmProvider>
        <BatchDetailDrawer batch={second} isOpen onClose={() => {}} initialTab="sessions" />
      </ConfirmProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Ingest Timetable/i })).toBeTruthy();
    });
  });
});
