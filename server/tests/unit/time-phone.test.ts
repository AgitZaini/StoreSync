import { normalizePhone } from "../../src/utils/phone";
import { addBusinessDays, businessDate, startOfBusinessDay } from "../../src/utils/time";

describe("WIB business dates", () => {
  it("uses the Asia/Jakarta calendar day", () => {
    expect(businessDate(new Date("2026-09-28T16:59:59Z"))).toBe("2026-09-28");
    expect(businessDate(new Date("2026-09-28T17:00:00Z"))).toBe("2026-09-29");
  });

  it("finds the start of a WIB day and shifts dates across months", () => {
    expect(startOfBusinessDay("2026-09-29").toISOString()).toBe("2026-09-28T17:00:00.000Z");
    expect(addBusinessDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addBusinessDays("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("normalizePhone", () => {
  it.each([
    ["081234567890", "6281234567890"],
    ["+62 812-3456-7890", "6281234567890"],
    ["6281234567890", "6281234567890"],
    ["81234567890", "6281234567890"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["", "12345", "0812", "+1 415 555 0100", "62812345678901234"])("rejects %s", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});
