import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";

import { ChipArrayField } from "./ChipArrayField";

let latestValue: unknown = "NOT_SET";

function Probe() {
  const form = useForm({ defaultValues: { faculty_members: [] as Array<{ name: string }> } });
  latestValue = form.watch("faculty_members");
  return (
    <FormProvider {...form}>
      <form>
        <ChipArrayField
          name={"faculty_members" as never}
          label="Proposed Faculty Members"
          itemLabel={(item) => item.name}
        />
        <output data-testid="shape">{JSON.stringify(latestValue)}</output>
      </form>
    </FormProvider>
  );
}

describe("ChipArrayField", () => {
  it("keeps the field an array (regression: draft input must not register a nested object key)", async () => {
    const user = userEvent.setup();
    render(<Probe />);

    expect(Array.isArray(latestValue)).toBe(true);

    const input = screen.getByLabelText(/Proposed Faculty Members/i);
    await user.type(input, "Dr. Rao{enter}");

    await waitFor(() => {
      expect(Array.isArray(latestValue)).toBe(true);
      expect(latestValue).toEqual([{ name: "Dr. Rao" }]);
    });
    expect(screen.getByText("Dr. Rao")).toBeTruthy();
  });

  it("supports comma-separated input and removal", async () => {
    const user = userEvent.setup();
    render(<Probe />);

    const input = screen.getByLabelText(/Proposed Faculty Members/i);
    await user.type(input, "Prof. Sharma, Dr. Rao{enter}");

    await waitFor(() => {
      expect(latestValue).toEqual([{ name: "Prof. Sharma" }, { name: "Dr. Rao" }]);
    });

    await user.click(screen.getByRole("button", { name: /Remove Prof\. Sharma/i }));
    await waitFor(() => {
      expect(latestValue).toEqual([{ name: "Dr. Rao" }]);
    });
  });
});
