export type AccountKind =
  | "kbz_bank"
  | "cb_bank"
  | "aya_bank"
  | "wave_money"
  | "kbzpay"
  | "physical_cash"
  | "custom";

export type TransactionKind =
  | "income"
  | "expense"
  | "transfer"
  | "lending"
  | "lend_repayment"
  | "borrowing"
  | "borrow_repayment";

export type LoanDirection = "lent" | "borrowed";

export type Account = {
  id: string;
  name: string;
  kind: AccountKind;
  initial_balance: number | string;
  current_balance: number | string;
  currency: string;
  notes: string | null;
  is_active: boolean;
};

export type MoneyType = "e_money" | "cash";

export function moneyTypeForAccount(account?: Pick<Account, "kind">): MoneyType {
  return account?.kind === "physical_cash" ? "cash" : "e_money";
}

export type AccountBalanceSummary = {
  total: number;
  eMoney: number;
  cash: number;
};

export function summarizeAccountBalances(
  accounts: Pick<Account, "kind" | "current_balance" | "is_active">[],
): AccountBalanceSummary {
  return accounts.reduce<AccountBalanceSummary>(
    (summary, account) => {
      if (!account.is_active) return summary;
      const balance = Number(account.current_balance);
      if (!Number.isFinite(balance)) {
        throw new TypeError("Account balances must be finite numbers.");
      }
      summary.total += balance;
      if (moneyTypeForAccount(account) === "cash") summary.cash += balance;
      else summary.eMoney += balance;
      return summary;
    },
    { total: 0, eMoney: 0, cash: 0 },
  );
}

export type Person = {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
};

export type Transaction = {
  id: string;
  kind: TransactionKind;
  account_id: string;
  to_account_id: string | null;
  person_id: string | null;
  amount: number | string;
  category: string;
  description: string;
  notes: string | null;
  occurred_at: string;
};

export type Loan = {
  id: string;
  person_id: string;
  direction: LoanDirection;
  principal: number | string;
  repaid: number | string;
  outstanding: number | string;
  borrowed_or_lent_at: string;
  expected_date: string | null;
  notes: string | null;
  principal_transaction_id?: string;
  /** Account the money left or entered; null for debts that existed before using the app. */
  account_id?: string | null;
  /** Cash or e-money for debts that existed before using the app. */
  money_type?: MoneyType | null;
  /** Whose records this loan belongs to; null for my own. */
  for_person_id?: string | null;
};

export type LoanRepayment = {
  id: string;
  loan_id: string;
  transaction_id: string;
  amount: number | string;
  paid_at: string;
  account_id?: string | null;
};

export type HistoryTransaction = {
  id: string;
  kind: TransactionKind;
  /** Null for debts that existed before using the app. */
  account_id: string | null;
  person_id: string | null;
  amount: number | string;
  notes: string | null;
  occurred_at: string;
  created_at?: string;
  /** Whose records this entry belongs to; null for my own. */
  for_person_id?: string | null;
};

export type HistoryEntry = {
  transaction: HistoryTransaction;
  /** The loan this entry starts or repays, if any. */
  loan?: Loan;
  isLoanPrincipal: boolean;
  isOpeningDebt: boolean;
  /** Effect on account balances: 1 money in, -1 money out, 0 no change. */
  effect: 1 | -1 | 0;
};

const moneyInKinds = new Set<TransactionKind>(["income", "borrowing", "lend_repayment"]);

export function buildHistory(
  transactions: HistoryTransaction[],
  loans: Loan[],
  repayments: Pick<LoanRepayment, "loan_id" | "transaction_id">[],
): HistoryEntry[] {
  const loansById = new Map(loans.map((loan) => [loan.id, loan]));
  const loanByPrincipal = new Map(
    loans.flatMap((loan) =>
      loan.principal_transaction_id ? [[loan.principal_transaction_id, loan] as const] : [],
    ),
  );
  const loanByRepayment = new Map(
    repayments.flatMap((repayment) => {
      const loan = loansById.get(repayment.loan_id);
      return loan ? [[repayment.transaction_id, loan] as const] : [];
    }),
  );

  return transactions.map((transaction) => {
    const principalLoan = loanByPrincipal.get(transaction.id);
    const isOpeningDebt = Boolean(principalLoan) && transaction.account_id === null;
    return {
      transaction,
      loan: principalLoan ?? loanByRepayment.get(transaction.id),
      isLoanPrincipal: Boolean(principalLoan),
      isOpeningDebt,
      effect: isOpeningDebt || transaction.account_id === null
        ? 0
        : moneyInKinds.has(transaction.kind) ? 1 : -1,
    };
  });
}

export type OwnerSummary = {
  moneyIn: number;
  moneyOut: number;
  /** Positive: their money I am holding. Negative: my money spent for them. */
  held: number;
  lentOutstanding: number;
  borrowedOutstanding: number;
};

/** Totals for entries recorded on someone else's behalf (null = my own records). */
export function summarizeOwner(entries: HistoryEntry[], ownerId: string | null): OwnerSummary {
  let moneyIn = 0;
  let moneyOut = 0;
  let lentOutstanding = 0;
  let borrowedOutstanding = 0;
  for (const entry of entries) {
    if ((entry.transaction.for_person_id ?? null) !== ownerId) continue;
    const amount = toMinorUnits(entry.transaction.amount);
    if (entry.effect === 1) moneyIn += amount;
    if (entry.effect === -1) moneyOut += amount;
    if (entry.isLoanPrincipal && entry.loan) {
      const outstanding = toMinorUnits(entry.loan.outstanding);
      if (entry.loan.direction === "lent") lentOutstanding += outstanding;
      else borrowedOutstanding += outstanding;
    }
  }
  return {
    moneyIn: fromMinorUnits(moneyIn),
    moneyOut: fromMinorUnits(moneyOut),
    held: fromMinorUnits(moneyIn - moneyOut),
    lentOutstanding: fromMinorUnits(lentOutstanding),
    borrowedOutstanding: fromMinorUnits(borrowedOutstanding),
  };
}

export type PersonBalance = {
  person: Person;
  /** What they still owe me. */
  owedToMe: number;
  /** What I still owe them. */
  iOwe: number;
  /** owedToMe - iOwe: positive means they owe me overall. */
  net: number;
  openLoans: number;
  totalLoans: number;
};

/** Outstanding amounts with each person, from the loans recorded with them. */
export function summarizePeople(people: Person[], loans: Loan[]): PersonBalance[] {
  return people.map((person) => {
    let owedToMe = 0;
    let iOwe = 0;
    let openLoans = 0;
    let totalLoans = 0;
    for (const loan of loans) {
      if (loan.person_id !== person.id) continue;
      totalLoans += 1;
      const outstanding = toMinorUnits(loan.outstanding);
      if (outstanding > 0) openLoans += 1;
      if (loan.direction === "lent") owedToMe += outstanding;
      else iOwe += outstanding;
    }
    return {
      person,
      owedToMe: fromMinorUnits(owedToMe),
      iOwe: fromMinorUnits(iOwe),
      net: fromMinorUnits(owedToMe - iOwe),
      openLoans,
      totalLoans,
    };
  });
}

/** The local calendar date (YYYY-MM-DD) of a stored timestamp. */
export function localDateKey(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export type DateRange = { from: string; to: string };

/** First and last day of the month that `now` falls in, shifted by `offset` months. */
export function monthRange(now = new Date(), offset = 0): DateRange {
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { from: localDateKey(first), to: localDateKey(last) };
}

export type SpendingSummary = {
  entries: HistoryEntry[];
  total: number;
  mine: number;
  /** Spending recorded for another person, keyed by their id. */
  byPerson: Map<string, number>;
};

/** Money taken out (expenses) between two dates, inclusive, split by whose records it is. */
export function summarizeSpending(entries: HistoryEntry[], range: DateRange): SpendingSummary {
  const inRange = entries.filter((entry) => {
    if (entry.transaction.kind !== "expense") return false;
    const day = localDateKey(entry.transaction.occurred_at);
    return (!range.from || day >= range.from) && (!range.to || day <= range.to);
  });
  let mine = 0;
  const byPerson = new Map<string, number>();
  for (const entry of inRange) {
    const amount = toMinorUnits(entry.transaction.amount);
    const owner = entry.transaction.for_person_id;
    if (owner) byPerson.set(owner, (byPerson.get(owner) ?? 0) + amount);
    else mine += amount;
  }
  return {
    entries: inRange,
    total: fromMinorUnits([...byPerson.values()].reduce((sum, value) => sum + value, mine)),
    mine: fromMinorUnits(mine),
    byPerson: new Map([...byPerson].map(([id, value]) => [id, fromMinorUnits(value)])),
  };
}

export type MonthlyFlow = {
  month: string;
  income: number;
  expense: number;
};

export type FinancialTotals = {
  accountBalances: number;
  bankAndWalletBalances: number;
  physicalCash: number;
  totalLent: number;
  receivables: number;
  totalBorrowed: number;
  payables: number;
  netFinancialPosition: number;
};

export function toMinorUnits(amount: number | string): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    throw new TypeError("Financial amounts must be finite numbers.");
  }
  return Math.round(value * 100);
}

export function fromMinorUnits(amount: number): number {
  return amount / 100;
}

export function calculateAccountBalances(
  accounts: Pick<Account, "id" | "initial_balance">[],
  transactions: Pick<
    Transaction,
    "kind" | "account_id" | "to_account_id" | "amount"
  >[],
): Map<string, number> {
  const balances = new Map(
    accounts.map((account) => [
      account.id,
      toMinorUnits(account.initial_balance),
    ]),
  );

  for (const transaction of transactions) {
    const amount = toMinorUnits(transaction.amount);
    const source = balances.get(transaction.account_id);

    if (source !== undefined) {
      const delta =
        transaction.kind === "income" ||
        transaction.kind === "lend_repayment" ||
        transaction.kind === "borrowing"
          ? amount
          : -amount;
      balances.set(transaction.account_id, source + delta);
    }

    if (
      transaction.kind === "transfer" &&
      transaction.to_account_id &&
      balances.has(transaction.to_account_id)
    ) {
      balances.set(
        transaction.to_account_id,
        balances.get(transaction.to_account_id)! + amount,
      );
    }
  }

  return new Map(
    [...balances].map(([id, amount]) => [id, fromMinorUnits(amount)]),
  );
}

export function calculateFinancialTotals(
  accounts: Account[],
  loans: Loan[],
): FinancialTotals {
  const activeAccounts = accounts.filter((account) => account.is_active);
  const accountBalances = activeAccounts.reduce(
    (sum, account) => sum + toMinorUnits(account.current_balance),
    0,
  );
  const physicalCashMinor = activeAccounts
    .filter((account) => account.kind === "physical_cash")
    .reduce((sum, account) => sum + toMinorUnits(account.current_balance), 0);
  const totalLent = loans
    .filter((loan) => loan.direction === "lent")
    .reduce((sum, loan) => sum + toMinorUnits(loan.principal), 0);
  const receivables = loans
    .filter((loan) => loan.direction === "lent")
    .reduce((sum, loan) => sum + toMinorUnits(loan.outstanding), 0);
  const totalBorrowed = loans
    .filter((loan) => loan.direction === "borrowed")
    .reduce((sum, loan) => sum + toMinorUnits(loan.principal), 0);
  const payables = loans
    .filter((loan) => loan.direction === "borrowed")
    .reduce((sum, loan) => sum + toMinorUnits(loan.outstanding), 0);

  return {
    accountBalances: fromMinorUnits(accountBalances),
    bankAndWalletBalances: fromMinorUnits(accountBalances - physicalCashMinor),
    physicalCash: fromMinorUnits(physicalCashMinor),
    totalLent: fromMinorUnits(totalLent),
    receivables: fromMinorUnits(receivables),
    totalBorrowed: fromMinorUnits(totalBorrowed),
    payables: fromMinorUnits(payables),
    netFinancialPosition: fromMinorUnits(
      accountBalances - receivables - payables,
    ),
  };
}

export function formatMoney(amount: number | string, language = "my"): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    throw new TypeError("Financial amounts must be finite numbers.");
  }
  return new Intl.NumberFormat(language === "my" ? "my-MM" : "en-US", {
    numberingSystem: "latn",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatKyat(amount: number | string, language = "my"): string {
  const symbol = language === "my" ? "Ks" : "Ks";
  return `${formatMoney(amount, language)} ${symbol}`;
}

export function calculateMonthlyFlow(
  transactions: Pick<Transaction, "kind" | "amount" | "occurred_at">[],
  months = 6,
  now = new Date(),
): MonthlyFlow[] {
  const results: MonthlyFlow[] = [];
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    results.push({ month, income: 0, expense: 0 });
  }

  const byMonth = new Map(results.map((item) => [item.month, item]));
  for (const transaction of transactions) {
    if (transaction.kind !== "income" && transaction.kind !== "expense") {
      continue;
    }
    const date = new Date(transaction.occurred_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const month = byMonth.get(key);
    if (!month) continue;
    const amount = fromMinorUnits(toMinorUnits(transaction.amount));
    if (transaction.kind === "income") month.income += amount;
    else month.expense += amount;
  }

  return results;
}
