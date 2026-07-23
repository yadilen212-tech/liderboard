import { describe, expect, it } from "vitest";
import { formatNumber, parseCurrency } from "./format";

describe("parseCurrency", () => {
  it("parses Ecuadorian-formatted amounts (dot = thousands, comma = decimals)", () => {
    expect(parseCurrency("17.338,85")).toBe(17338.85);
    expect(parseCurrency("1.234,56")).toBe(1234.56);
    expect(parseCurrency("1.234")).toBe(1234); // thousands, no decimals
    expect(parseCurrency("80,75")).toBe(80.75);
    expect(parseCurrency("-20,4")).toBe(-20.4);
    expect(parseCurrency("0")).toBe(0);
  });

  it("returns null for blank or unparseable input", () => {
    expect(parseCurrency("")).toBeNull();
    expect(parseCurrency("   ")).toBeNull();
    expect(parseCurrency("abc")).toBeNull();
  });

  it("round-trips values rendered by formatNumber (the editor seed) without inflation", () => {
    for (const value of [17338.85, 1234.56, 80.75, -20.4, 0, 1234, 1005, 1.005]) {
      expect(parseCurrency(formatNumber(value))).toBeCloseTo(value, 3);
    }
  });
});
