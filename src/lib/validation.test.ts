import { describe, expect, it } from "vitest";
import { depositSchema, loanSchema } from "@/lib/validation";

const loanInput = {
  request_key: "0dc78ff5-109f-4dd4-a5c0-43c10455e0ab",
  direction: "lent" as const,
  person_id: "080f1c2f-a28a-43e7-a7a6-0ea63fc47c89",
  amount: 250_000,
  occurred_at: "2026-10-21T05:00:00.000Z",
};

describe("loan input validation", () => {
  it("allows an existing debt without an account", () => {
    expect(loanSchema.safeParse({
      ...loanInput,
      is_opening_balance: true,
    }).success).toBe(true);
  });

  it("requires an account when recording new borrowing or lending", () => {
    expect(loanSchema.safeParse({
      ...loanInput,
      is_opening_balance: false,
    }).success).toBe(false);
    expect(loanSchema.safeParse({
      ...loanInput,
      account_id: "cacb9e5c-f5f7-4cc5-bf0f-c8786685b985",
      is_opening_balance: false,
    }).success).toBe(true);
  });
});

describe("deposit input validation", () => {
  const depositInput = {
    request_key: "5b0f2f0e-6a52-4a8e-9f8e-1d1f0d0c7a11",
    amount: 200_000,
    occurred_at: "2026-10-21T05:00:00.000Z",
  };

  it("accepts either an existing account or a new account of a chosen type", () => {
    expect(depositSchema.safeParse({
      ...depositInput,
      account_id: "cacb9e5c-f5f7-4cc5-bf0f-c8786685b985",
    }).success).toBe(true);
    expect(depositSchema.safeParse({
      ...depositInput,
      new_account: { kind: "aya_bank", name: "AYA ဘဏ်" },
    }).success).toBe(true);
  });

  it("rejects a deposit with no account or with both kinds of account", () => {
    expect(depositSchema.safeParse(depositInput).success).toBe(false);
    expect(depositSchema.safeParse({
      ...depositInput,
      account_id: "cacb9e5c-f5f7-4cc5-bf0f-c8786685b985",
      new_account: { kind: "aya_bank", name: "AYA ဘဏ်" },
    }).success).toBe(false);
  });
});

describe("loan due date", () => {
  it("treats an empty due date as no due date", () => {
    const parsed = loanSchema.safeParse({
      request_key: "0dc78ff5-109f-4dd4-a5c0-43c10455e0ab",
      direction: "borrowed",
      person_id: "080f1c2f-a28a-43e7-a7a6-0ea63fc47c89",
      account_id: "cacb9e5c-f5f7-4cc5-bf0f-c8786685b985",
      amount: 40_000_000,
      occurred_at: "2026-10-21T05:00:00.000Z",
      expected_date: "",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.expected_date).toBeNull();
  });
});

describe("taking money out", () => {
  const base = {
    request_key: "5b0f2f0e-6a52-4a8e-9f8e-1d1f0d0c7a15",
    kind: "expense",
    amount: 100_000,
    occurred_at: "2026-10-21T05:00:00.000Z",
    for_person_id: "080f1c2f-a28a-43e7-a7a6-0ea63fc47c89",
  };

  it("accepts an existing account, tagged for another person", () => {
    expect(depositSchema.safeParse({ ...base, account_id: "cacb9e5c-f5f7-4cc5-bf0f-c8786685b985" }).success).toBe(true);
  });

  it("does not create a new account just to take money out of it", () => {
    expect(depositSchema.safeParse({ ...base, new_account: { kind: "aya_bank", name: "AYA" } }).success).toBe(false);
  });
});
