import { describe, it, expect } from "vitest";
import { errorMessage, notify, notifyError, notifySuccess, notifyInfo } from "@/lib/notify";

describe("errorMessage", () => {
  it("prefers a thrown error's message", () => {
    expect(errorMessage(new Error("boom"), "fallback")).toBe("boom");
  });

  it("accepts a plain string", () => {
    expect(errorMessage("plain failure", "fallback")).toBe("plain failure");
  });

  it("falls back for null/undefined", () => {
    expect(errorMessage(null, "fallback")).toBe("fallback");
    expect(errorMessage(undefined, "fallback")).toBe("fallback");
  });

  it("falls back when the message is empty or whitespace", () => {
    expect(errorMessage(new Error("   "), "fallback")).toBe("fallback");
    expect(errorMessage({ message: "" }, "fallback")).toBe("fallback");
  });

  it("falls back for objects with no message", () => {
    expect(errorMessage({ code: 500 }, "fallback")).toBe("fallback");
  });
});

describe("notification helpers", () => {
  it("do not throw when invoked outside a component", () => {
    // The underlying `toast()` is module-scoped and dispatches to listeners;
    // with no provider mounted there are simply no listeners.
    expect(() => notify({ title: "t" })).not.toThrow();
    expect(() => notifySuccess("saved", "details")).not.toThrow();
    expect(() => notifyInfo("info")).not.toThrow();
    expect(() => notifyError("failed", new Error("x"))).not.toThrow();
    expect(() => notifyError("failed")).not.toThrow();
  });
});
