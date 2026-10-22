import { describe, expect, it } from "vitest";
import {
  calculateAccountBalances,
  calculateFinancialTotals,
  calculateMonthlyFlow,
  buildHistory,
  formatKyat,
  monthRange,
  summarizePeople,
  summarizeSpending,
  summarizeOwner,
  moneyTypeForAccount,
  summarizeAccountBalances,
  type Account,
  type Loan,
  type Transaction,
} from "@/lib/finance";

const accounts: Account[] = [
  {
    id: "kbz",
    name: "KBZ Bank",
    kind: "kbz_bank",
    initial_balance: 100_000,
    current_balance: 529_000,
    currency: "MMK",
    notes: null,
    is_active: true,
  },
  {
    id: "cash",
    name: "Physical cash",
    kind: "physical_cash",
    initial_balance: 100_000,
    current_balance: 45_000,
    currency: "MMK",
    notes: null,
    is_active: true,
  },
  {
    id: "wave",
    name: "Wave Money",
    kind: "wave_money",
    initial_balance: 10_000,
    current_balance: 80_000,
    currency: "MMK",
    notes: null,
    is_active: true,
  },
];

const transactions: Transaction[] = [
  { id: "1", kind: "income", account_id: "kbz", to_account_id: null, person_id: null, amount: 500_000, category: "Salary", description: "Salary", notes: null, occurred_at: "2026-10-03T12:00:00Z" },
  { id: "2", kind: "expense", account_id: "cash", to_account_id: null, person_id: null, amount: 45_000, category: "Food", description: "Groceries", notes: null, occurred_at: "2026-10-04T12:00:00Z" },
  { id: "3", kind: "transfer", account_id: "kbz", to_account_id: "wave", person_id: null, amount: 50_000, category: "Transfer", description: "Move to wallet", notes: null, occurred_at: "2026-10-05T12:00:00Z" },
  { id: "4", kind: "lending", account_id: "kbz", to_account_id: null, person_id: "person-a", amount: 80_000, category: "Money lent", description: "Loan to Aye", notes: null, occurred_at: "2026-10-06T12:00:00Z" },
  { id: "5", kind: "lend_repayment", account_id: "wave", to_account_id: null, person_id: "person-a", amount: 20_000, category: "Loan repayment", description: "Repayment received", notes: null, occurred_at: "2026-10-07T12:00:00Z" },
  { id: "6", kind: "borrowing", account_id: "kbz", to_account_id: null, person_id: "person-b", amount: 60_000, category: "Money borrowed", description: "Loan from B", notes: null, occurred_at: "2026-10-08T12:00:00Z" },
  { id: "7", kind: "borrow_repayment", account_id: "cash", to_account_id: null, person_id: "person-b", amount: 10_000, category: "Loan repayment", description: "Repayment made", notes: null, occurred_at: "2026-10-09T12:00:00Z" },
  { id: "8", kind: "expense", account_id: "kbz", to_account_id: null, person_id: null, amount: 1_000, category: "Bank fee", description: "Transfer fee", notes: null, occurred_at: "2026-10-10T12:00:00Z" },
];

const loans: Loan[] = [
  { id: "loan-a", person_id: "person-a", direction: "lent", principal: 80_000, repaid: 20_000, outstanding: 60_000, borrowed_or_lent_at: "2026-10-06T12:00:00Z", expected_date: null, notes: null },
  { id: "loan-b", person_id: "person-b", direction: "borrowed", principal: 60_000, repaid: 10_000, outstanding: 50_000, borrowed_or_lent_at: "2026-10-08T12:00:00Z", expected_date: null, notes: null },
];

describe("personal cash flow calculations", () => {
  it("formats Myanmar Kyat with stable Latin digits", () => {
    expect(formatKyat(125_000, "my")).toBe("125,000 Ks");
  });

  it("separates available e-money from physical cash", () => {
    expect(summarizeAccountBalances(accounts)).toEqual({
      total: 654_000,
      eMoney: 609_000,
      cash: 45_000,
    });
    expect(
      summarizeAccountBalances([
        ...accounts,
        { ...accounts[0], id: "archived", current_balance: 700_000, is_active: false },
      ]),
    ).toEqual({
      total: 654_000,
      eMoney: 609_000,
      cash: 45_000,
    });
  });

  it("treats physical cash as cash and every bank, wallet, or custom account as e-money", () => {
    expect(moneyTypeForAccount({ kind: "physical_cash" })).toBe("cash");
    for (const kind of ["kbz_bank", "cb_bank", "aya_bank", "wave_money", "kbzpay", "custom"] as const) {
      expect(moneyTypeForAccount({ kind })).toBe("e_money");
    }
  });

  it("recalculates balances without treating transfers or loan principal as income", () => {
    expect(calculateAccountBalances(accounts, transactions)).toEqual(
      new Map([
        ["kbz", 529_000],
        ["cash", 45_000],
        ["wave", 80_000],
      ]),
    );
  });

  it("keeps receivables and payables separate and applies the requested net-position formula", () => {
    expect(calculateFinancialTotals(accounts, loans)).toEqual({
      accountBalances: 654_000,
      bankAndWalletBalances: 609_000,
      physicalCash: 45_000,
      totalLent: 80_000,
      receivables: 60_000,
      totalBorrowed: 60_000,
      payables: 50_000,
      netFinancialPosition: 544_000,
    });
  });

  it("reports only ordinary income and expenses in the monthly chart", () => {
    const months = calculateMonthlyFlow(
      transactions,
      6,
      new Date("2026-10-21T00:00:00Z"),
    );
    expect(months).toHaveLength(6);
    expect(months.at(-1)).toEqual({
      month: "2026-10",
      income: 500_000,
      expense: 46_000,
    });
  });
});

describe("history entries", () => {
  const debt: Loan = {
    id: "loan-dad", person_id: "dad", direction: "borrowed", principal: 40_000_000,
    repaid: 2_000_000, outstanding: 38_000_000, borrowed_or_lent_at: "2026-10-21T05:30:00Z",
    expected_date: null, notes: null, principal_transaction_id: "t-open", account_id: null,
  };
  const history = buildHistory(
    [
      { id: "t-add", kind: "income", account_id: "kbz", person_id: null, amount: 500_000, notes: null, occurred_at: "2026-10-21T05:30:00Z" },
      { id: "t-open", kind: "borrowing", account_id: null, person_id: "dad", amount: 40_000_000, notes: null, occurred_at: "2026-10-21T05:30:00Z" },
      { id: "t-pay", kind: "borrow_repayment", account_id: "cash", person_id: "dad", amount: 2_000_000, notes: null, occurred_at: "2026-10-21T05:30:00Z" },
    ],
    [debt],
    [{ loan_id: "loan-dad", transaction_id: "t-pay" }],
  );

  it("marks money added as money in", () => {
    expect(history[0]).toMatchObject({ effect: 1, isLoanPrincipal: false, loan: undefined });
  });

  it("marks an existing debt as not changing any balance", () => {
    expect(history[1]).toMatchObject({ effect: 0, isLoanPrincipal: true, isOpeningDebt: true });
    expect(history[1].loan?.id).toBe("loan-dad");
  });

  it("links a repayment to its loan and marks it as money out", () => {
    expect(history[2]).toMatchObject({ effect: -1, isLoanPrincipal: false, isOpeningDebt: false });
    expect(history[2].loan?.id).toBe("loan-dad");
  });
});

describe("records kept for another person", () => {
  const lentForDad: Loan = {
    id: "loan-dad-biz", person_id: "ko-aung", direction: "lent", principal: 10_000_000,
    repaid: 0, outstanding: 10_000_000, borrowed_or_lent_at: "2026-10-21T05:30:00Z",
    expected_date: null, notes: null, principal_transaction_id: "t-lend", account_id: "kbz",
    for_person_id: "dad",
  };
  const entries = buildHistory(
    [
      // Lent 100 lakh from my KBZ on Dad's behalf.
      { id: "t-lend", kind: "lending", account_id: "kbz", person_id: "ko-aung", amount: 10_000_000, notes: null, occurred_at: "2026-10-21T05:30:00Z", for_person_id: "dad" },
      // Interest from Dad's business arrived in my cash.
      { id: "t-interest", kind: "income", account_id: "cash", person_id: null, amount: 300_000, notes: "Interest", occurred_at: "2026-10-22T05:30:00Z", for_person_id: "dad" },
      // My own top-up is not part of Dad's records.
      { id: "t-mine", kind: "income", account_id: "cash", person_id: null, amount: 50_000, notes: null, occurred_at: "2026-10-22T05:30:00Z", for_person_id: null },
    ],
    [lentForDad],
    [],
  );

  it("totals only that person's money in and out, and what is still owed to them", () => {
    expect(summarizeOwner(entries, "dad")).toEqual({
      moneyIn: 300_000,
      moneyOut: 10_000_000,
      held: -9_700_000,
      lentOutstanding: 10_000_000,
      borrowedOutstanding: 0,
    });
  });

  it("keeps my own records separate", () => {
    expect(summarizeOwner(entries, null)).toMatchObject({ moneyIn: 50_000, moneyOut: 0, held: 50_000 });
  });
});

describe("people balances", () => {
  const people = [
    { id: "dad", name: "Dad", phone: null, notes: null },
    { id: "aung", name: "Ko Aung", phone: null, notes: null },
    { id: "new", name: "No loans", phone: null, notes: null },
  ];
  const loan = (id: string, person_id: string, direction: "lent" | "borrowed", principal: number, repaid: number): Loan => ({
    id, person_id, direction, principal, repaid, outstanding: principal - repaid,
    borrowed_or_lent_at: "2026-10-01T12:00:00Z", expected_date: null, notes: null,
  });

  it("shows what each person owes me, what I owe them, and the net", () => {
    const balances = summarizePeople(people, [
      loan("1", "dad", "borrowed", 40_000_000, 2_000_000),
      loan("2", "aung", "lent", 10_000_000, 0),
      loan("3", "aung", "borrowed", 1_000_000, 1_000_000),
      loan("4", "aung", "lent", 500_000, 200_000),
    ]);
    expect(balances[0]).toMatchObject({ owedToMe: 0, iOwe: 38_000_000, net: -38_000_000, openLoans: 1 });
    expect(balances[1]).toMatchObject({ owedToMe: 10_300_000, iOwe: 0, net: 10_300_000, openLoans: 2, totalLoans: 3 });
    expect(balances[2]).toMatchObject({ owedToMe: 0, iOwe: 0, net: 0, totalLoans: 0 });
  });
});

describe("spending in a date range", () => {
  const tx = (id: string, kind: "expense" | "income", day: string, amount: number, owner: string | null) => ({
    id, kind, account_id: "cash", person_id: null, amount, notes: null,
    occurred_at: `${day}T12:00:00`, for_person_id: owner,
  });
  const entries = buildHistory(
    [
      tx("a", "expense", "2026-10-01", 5_000, null),
      tx("b", "expense", "2026-10-15", 150_000, "dad"),
      tx("c", "expense", "2026-10-31", 20_000, null),
      tx("d", "expense", "2026-09-30", 99_000, null),
      tx("e", "income", "2026-10-10", 300_000, "dad"),
    ],
    [],
    [],
  );

  it("defaults to the whole current month", () => {
    expect(monthRange(new Date(2026, 9, 21))).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(monthRange(new Date(2026, 0, 5), -1)).toEqual({ from: "2025-12-01", to: "2025-12-31" });
  });

  it("totals only money taken out within the range, split into mine and Dad's", () => {
    const summary = summarizeSpending(entries, { from: "2026-10-01", to: "2026-10-31" });
    expect(summary.entries.map((entry) => entry.transaction.id)).toEqual(["a", "b", "c"]);
    expect(summary.mine).toBe(25_000);
    expect(summary.byPerson.get("dad")).toBe(150_000);
    expect(summary.total).toBe(175_000);
  });

  it("includes both end dates", () => {
    const summary = summarizeSpending(entries, { from: "2026-10-15", to: "2026-10-15" });
    expect(summary.entries.map((entry) => entry.transaction.id)).toEqual(["b"]);
  });
});
