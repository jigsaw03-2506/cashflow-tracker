import { describe, expect, it } from "vitest";
import {
  amountToText,
  caretAfterFormat,
  formatAmountText,
  parseAmountText,
} from "@/lib/amount-format";

describe("amount input formatting", () => {
  it("adds a comma every three digits as you type", () => {
    expect(formatAmountText("1000000.23")).toBe("1,000,000.23");
    expect(formatAmountText("1,0000")).toBe("10,000");
    expect(formatAmountText("150000")).toBe("150,000");
  });

  it("allows one decimal point and at most two decimals", () => {
    expect(formatAmountText("12.345")).toBe("12.34");
    expect(formatAmountText("1.2.3")).toBe("1.23");
    expect(formatAmountText(".5")).toBe("0.5");
    expect(formatAmountText("1000.")).toBe("1,000.");
  });

  it("ignores letters and leading zeros", () => {
    expect(formatAmountText("00a12b3")).toBe("123");
  });

  it("parses the formatted text back to a number", () => {
    expect(parseAmountText("1,000,000.23")).toBe(1_000_000.23);
    expect(parseAmountText("")).toBeNaN();
    expect(parseAmountText("", 0)).toBe(0);
  });

  it("shows a stored amount with commas and no trailing zeros", () => {
    expect(amountToText(40_000_000)).toBe("40,000,000");
    expect(amountToText(1_000_000.5)).toBe("1,000,000.5");
    expect(amountToText(0)).toBe("");
  });

  it("keeps the caret after the same digit when commas move", () => {
    // Typing "0" after "1,000" (caret at end) gives "10,000" with the caret at the end.
    expect(caretAfterFormat("1,0000", 6, "10,000")).toBe(6);
    // Typing "5" at the very start of "1,000".
    expect(caretAfterFormat("51,000", 1, "51,000")).toBe(1);
  });
});
