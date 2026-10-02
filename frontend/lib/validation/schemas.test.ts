import { describe, expect, it } from "vitest";
import {
  CODE_CHARSET_MESSAGE,
  codeStringSchema,
  createBatchSchema,
  normalizeCodeChars,
} from "./schemas";

describe("normalizeCodeChars", () => {
  it("keeps every allowed character, including underscores", () => {
    expect(normalizeCodeChars("DEL_PYSPARK_2026_B1")).toBe("DEL_PYSPARK_2026_B1");
    expect(normalizeCodeChars("A_B")).toBe("A_B");
    expect(normalizeCodeChars("_LEAD")).toBe("_LEAD");
    expect(normalizeCodeChars("TRAIL_")).toBe("TRAIL_");
    expect(normalizeCodeChars("SOW-1")).toBe("SOW-1");
    expect(normalizeCodeChars("BATCH.2026")).toBe("BATCH.2026");
    expect(normalizeCodeChars("BATCH:01")).toBe("BATCH:01");
  });

  it("turns the spaces in a typed batch name into single underscores", () => {
    expect(normalizeCodeChars("DLTE_AI Strategist _Sep26_B29")).toBe("DLTE_AI_Strategist_Sep26_B29");
    expect(normalizeCodeChars("a b  c")).toBe("a_b_c");
    expect(normalizeCodeChars("  Padded")).toBe("Padded");
  });

  it("keeps a space typed mid-entry as the pending separator", () => {
    // Trimming here would eat the separator and glue the next word on.
    expect(normalizeCodeChars("DLTE_AI Strategist ")).toBe("DLTE_AI_Strategist_");
    expect(normalizeCodeChars("DLTE_AI Strategist S")).toBe("DLTE_AI_Strategist_S");
  });

  it("trims a trailing separator only once it is not wanted anymore", () => {
    // The zod rule trims, so a value pasted with padding still validates.
    expect(normalizeCodeChars("  Padded  ")).toBe("Padded_");
    expect(codeStringSchema(3, 50).safeParse(normalizeCodeChars("  Padded  ")).success).toBe(true);
  });

  it("removes unsupported characters", () => {
    expect(normalizeCodeChars("DEL/PYSPARK")).toBe("DELPYSPARK");
    expect(normalizeCodeChars("B1#")).toBe("B1");
    expect(normalizeCodeChars("a@b&c+d")).toBe("abcd");
  });
});

describe("codeStringSchema", () => {
  const schema = codeStringSchema(3, 50);

  it("accepts the allowed charset including underscores", () => {
    expect(schema.safeParse("DEL_PYSPARK_2026_B1").success).toBe(true);
    expect(schema.safeParse("A_B").success).toBe(true);
    expect(schema.safeParse("BATCH.2026:X-1").success).toBe(true);
  });

  it("trims surrounding whitespace before validating", () => {
    const parsed = schema.safeParse("  DEL_PYSPARK  ");
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).toBe("DEL_PYSPARK");
  });

  it("rejects inner spaces and other unsupported characters", () => {
    const result = schema.safeParse("DLTE_AI Strategist");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(CODE_CHARSET_MESSAGE);
    }
  });
});

describe("createBatchSchema batch_id", () => {
  const base = {
    client_name: "IBM",
    program_name: "Big Data Program",
    entity_id: "e1",
    category_id: "c1",
    domain: "Data Science",
    technology: "PySpark",
    delivery_mode_id: "m1",
    location_city: "",
    accommodation_id: "a1",
    start_date: "2099-01-01",
    end_date: "2099-02-01",
    training_days: 10,
    total_hours: 80,
    total_enrollments: 20,
    faculty_members: [{ name: "Dr Rao" }],
    sales_spoc_id: "s1",
    coordinator_id: "co1",
    primary_manager_id: "pm1",
    sow_number: "SOW-2026-DEL-089",
    remarks: "",
  };

  it("accepts the normalized form of the reported value", () => {
    const normalized = normalizeCodeChars("DLTE_AI Strategist _Sep26_B29");
    expect(normalized).toBe("DLTE_AI_Strategist_Sep26_B29");
    expect(createBatchSchema.safeParse({ ...base, batch_id: normalized }).success).toBe(true);
  });

  it("still reports the raw typed value as invalid", () => {
    const result = createBatchSchema.safeParse({ ...base, batch_id: "DLTE_AI Strategist _Sep26_B29" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "batch_id");
      expect(issue?.message).toBe(CODE_CHARSET_MESSAGE);
    }
  });
});