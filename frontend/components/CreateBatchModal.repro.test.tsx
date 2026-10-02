import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const getBatchOptions = vi.fn();
const getAssignableUsers = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    getBatchOptions: (...a: unknown[]) => getBatchOptions(...a),
    getAssignableUsers: (...a: unknown[]) => getAssignableUsers(...a),
    createBatch: vi.fn(),
  },
}));

import { CreateBatchModal } from "./CreateBatchModal";

const option = { id: "1", name: "Unext", is_active: true, created_at: "", updated_at: "" };
const person = {
  id: "u1", email: "a@b.c", full_name: "A B", role: "Sales",
  is_active: true, created_at: "",
};

describe("CreateBatchModal faculty chip field", () => {
  beforeEach(() => {
    getBatchOptions.mockResolvedValue([option]);
    getAssignableUsers.mockResolvedValue([person]);
  });

  it("renders the open modal without crashing", async () => {
    render(<CreateBatchModal isOpen onClose={() => {}} onBatchCreated={() => {}} />);
    expect(await screen.findByLabelText(/Batch Identifier/i)).toBeTruthy();
  });

  it("adds faculty as array entries, not an object keyed by the draft input", async () => {
    const user = userEvent.setup();
    render(<CreateBatchModal isOpen onClose={() => {}} onBatchCreated={() => {}} />);

    const input = await screen.findByLabelText(/Proposed Faculty Members/i);
    await user.type(input, "Dr. Rao{enter}");
    await user.type(input, "Prof. Sharma{enter}");

    await waitFor(() => {
      expect(screen.getByText("Dr. Rao")).toBeTruthy();
      expect(screen.getByText("Prof. Sharma")).toBeTruthy();
    });

    // The pre-flight summary reads form.watch().faculty_members and maps over it.
    expect(screen.getByText(/Dr\. Rao, Prof\. Sharma/)).toBeTruthy();
  });

  it("removes a faculty chip without crashing", async () => {
    const user = userEvent.setup();
    render(<CreateBatchModal isOpen onClose={() => {}} onBatchCreated={() => {}} />);

    const input = await screen.findByLabelText(/Proposed Faculty Members/i);
    await user.type(input, "Dr. Rao{enter}");
    await user.click(await screen.findByRole("button", { name: /Remove Dr\. Rao/i }));

    await waitFor(() => {
      expect(screen.getByText(/No items added yet/i)).toBeTruthy();
    });
  });

  it("normalizes the batch identifier to the allowed charset while typing", async () => {
    const user = userEvent.setup();
    render(<CreateBatchModal isOpen onClose={() => {}} onBatchCreated={() => {}} />);

    const input = (await screen.findByLabelText(/Batch Identifier/i)) as HTMLInputElement;
    // Typed with spaces, which must never reach the form as-is.
    await user.type(input, "DLTE_AI Strategist _Sep26_B29");
    expect(input.value).toBe("DLTE_AI_Strategist_Sep26_B29");
  });

  it("keeps underscores typed by the user", async () => {
    const user = userEvent.setup();
    render(<CreateBatchModal isOpen onClose={() => {}} onBatchCreated={() => {}} />);

    const input = (await screen.findByLabelText(/Batch Identifier/i)) as HTMLInputElement;
    await user.type(input, "DEL_PYSPARK_2026_B1");
    expect(input.value).toBe("DEL_PYSPARK_2026_B1");
  });

  it("shows the inclusive calendar-day count live while filling the schedule", async () => {
    const user = userEvent.setup();
    render(<CreateBatchModal isOpen onClose={() => {}} onBatchCreated={() => {}} />);

    await screen.findByLabelText(/Commencement Date/i);
    await user.type(screen.getByLabelText(/Commencement Date/i), "2024-01-01");
    await user.type(screen.getByLabelText(/Conclusion Date/i), "2024-01-05");

    await waitFor(() => {
      const daysStrong = screen.getByText("5", { exact: true });
      expect(daysStrong.tagName).toBe("STRONG");
      expect(daysStrong.closest("p")?.textContent).toBe(
        "Calendar days (inclusive of 01-01-2024 and 05-01-2024): 5"
      );
    });
  });
});
