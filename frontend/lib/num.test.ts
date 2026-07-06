import { describe, it, expect } from "vitest";
import { decimalInput, integerInput } from "@/lib/num";

describe("decimalInput", () => {
  it("strips letters and symbols", () => {
    expect(decimalInput("12abc")).toBe("12");
    expect(decimalInput("1a2b3")).toBe("123");
    expect(decimalInput("$5.00")).toBe("5.00");
    expect(decimalInput("abc")).toBe("");
  });

  it("allows at most one decimal point", () => {
    expect(decimalInput("1.5")).toBe("1.5");
    expect(decimalInput("1.2.3")).toBe("1.23");
    expect(decimalInput(".5")).toBe(".5");
  });

  it("allows an empty string so the field can be cleared", () => {
    expect(decimalInput("")).toBe("");
  });
});

describe("integerInput", () => {
  it("keeps only digits", () => {
    expect(integerInput("10 people")).toBe("10");
    expect(integerInput("2x")).toBe("2");
    expect(integerInput("abc")).toBe("");
  });
});
