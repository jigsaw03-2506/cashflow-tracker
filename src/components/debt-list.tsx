"use client";

import { ArrowDownLeft, ArrowUpRight, Plus, Users } from "lucide-react";
import Link from "next/link";
import type { Account, Loan, LoanRepayment, Person } from "@/lib/finance";
import { formatKyat } from "@/lib/finance";
import type { Language } from "@/lib/i18n";
import { localDateLabel, MoneySource, OwnerBadge } from "@/components/history-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type DebtGroup = {
  personId: string;
  name: string;
  loans: Loan[];
  outstanding: number;
  repaymentsByLoan: Map<string, LoanRepayment[]>;
};

export function debtGroups(
  loans: Loan[],
  repayments: LoanRepayment[],
  people: Person[],
  direction: "lent" | "borrowed",
): DebtGroup[] {
  const peopleById = new Map(people.map((person) => [person.id, person.name]));
  const groups = new Map<string, DebtGroup>();
  const repaymentsByLoan = new Map<string, LoanRepayment[]>();
  for (const repayment of repayments) {
    const current = repaymentsByLoan.get(repayment.loan_id) ?? [];
    current.push(repayment);
    repaymentsByLoan.set(repayment.loan_id, current);
  }
  for (const loan of loans) {
    const outstanding = Number(loan.outstanding);
    if (loan.direction !== direction) continue;
    const current = groups.get(loan.person_id) ?? {
      personId: loan.person_id,
      name: peopleById.get(loan.person_id) ?? "—",
      loans: [],
      outstanding: 0,
      repaymentsByLoan,
    };
    current.loans.push(loan);
    current.outstanding += outstanding;
    groups.set(loan.person_id, current);
  }
  return [...groups.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

export function DebtList({
  language,
  direction,
  groups,
  accountsById,
  peopleById,
  onAdd,
  onRepay,
  addDisabled,
  title,
}: {
  language: Language;
  direction: "lent" | "borrowed";
  groups: DebtGroup[];
  accountsById: Map<string, Account>;
  peopleById: Map<string, string>;
  /** Without onAdd/onRepay the list is read-only (used on a person's page). */
  onAdd?: () => void;
  onRepay?: () => void;
  addDisabled?: boolean;
  title?: string;
}) {
  const isReceivable = direction === "lent";
  const total = groups.reduce((sum, group) => sum + group.outstanding, 0);
  const copy = language === "my"
    ? isReceivable
      ? {
          title: "ကိုယ့်ဆီက ငွေချေးယူထားသူများ",
          action: "ရရန်ရှိ",
          repay: "ငွေပြန်လက်ခံရန်",
          empty: "ချေးပေးထားသော မှတ်တမ်း မရှိသေးပါ။",
          due: "ပြန်ဆပ်ရမည့်ရက်",
          loan: "ချေးငွေ",
          principal: "မူရင်းချေးငွေ",
          repaid: "ကိုယ့်ထံ ပြန်ရရှိပြီး",
          remaining: "ပြန်ရရန်ကျန်ငွေ",
          repaymentHistory: "ကိုယ့်ထံ ပြန်ရထားသည့် မှတ်တမ်း",
          noRepayments: "ပြန်ပေးထားမှု မရှိသေးပါ။",
          repaymentAction: "ပြန်ပေးခဲ့သည်",
        }
      : {
          title: "ကိုယ်က ငွေချေးယူထားသူများ",
          action: "ပေးရန်ကျန်",
          repay: "အကြွေးပြန်ဆပ်ရန်",
          empty: "ချေးယူထားသော မှတ်တမ်း မရှိသေးပါ။",
          due: "ပြန်ပေးရမည့်ရက်",
          loan: "အကြွေး",
          principal: "မူရင်းချေးငွေ",
          repaid: "ပြန်ပေးပြီး",
          remaining: "ပြန်ပေးရန်ကျန်ငွေ",
          repaymentHistory: "ပြန်ပေးထားသည့် မှတ်တမ်း",
          noRepayments: "ပြန်ပေးထားမှု မရှိသေးပါ။",
          repaymentAction: "ပြန်ပေးခဲ့သည်",
        }
    : isReceivable
      ? {
          title: "People I have lent money to",
          action: "Record money lent",
          repay: "Record repayment",
          empty: "No money is currently owed to you.",
          due: "Due",
          loan: "Loan",
          principal: "Original amount",
          repaid: "Repaid to you",
          remaining: "Still owed",
          repaymentHistory: "Repayments received",
          noRepayments: "No repayments recorded yet.",
          repaymentAction: "Paid",
        }
      : {
          title: "People I have borrowed from",
          action: "Record money borrowed",
          repay: "Record repayment",
          empty: "You do not currently owe anyone.",
          due: "Due",
          loan: "Debt",
          principal: "Original amount",
          repaid: "Repaid",
          remaining: "Still owed",
          repaymentHistory: "Repayment history",
          noRepayments: "No repayments recorded yet.",
          repaymentAction: "Paid",
        };
  const hasOpenBalance = groups.some((group) =>
    group.loans.some((loan) => Number(loan.outstanding) > 0),
  );

  return (
    <Card className="min-w-0">
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle>{title ?? copy.title}</CardTitle>
          <p className="number mt-2 text-xl font-semibold text-ink">
            {formatKyat(total, language)}
          </p>
        </div>
        {onAdd && onRepay && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onRepay} disabled={!hasOpenBalance}>
            {isReceivable ? (
              <ArrowDownLeft className="size-4" />
            ) : (
              <ArrowUpRight className="size-4" />
            )}
            {copy.repay}
          </Button>
          <Button size="sm" onClick={onAdd} disabled={addDisabled}>
            <Plus className="size-4" />
            {copy.action}
          </Button>
        </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {groups.length === 0 ? (
          <p className="rounded-control bg-surface-subtle px-4 py-8 text-center text-sm text-muted">
            {copy.empty}
          </p>
        ) : groups.map((group) => (
          <div
            key={group.personId}
            className="rounded-control border border-line bg-surface px-4 py-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-control bg-accent-soft text-accent">
                  <Users className="size-4" />
                </span>
                <div className="min-w-0">
                  <Link
                    href={`/people/${group.personId}`}
                    className="block truncate text-sm font-semibold text-ink underline-offset-4 hover:underline"
                  >
                    {group.name}
                  </Link>
                  <p className="mt-1 text-xs text-muted">
                    {group.loans.length} {copy.loan}
                    {group.loans.length === 1 ? "" : language === "my" ? " ခု" : "s"}
                  </p>
                </div>
              </div>
              <p className="number shrink-0 text-sm font-semibold text-ink">
                {formatKyat(group.outstanding, language)}
              </p>
            </div>
            <div className="mt-3 space-y-3 border-t border-line pt-3">
              {group.loans.map((loan) => (
                <div key={loan.id} className="rounded-control bg-surface-subtle px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="text-muted">
                        {copy.loan} · {localDateLabel(loan.borrowed_or_lent_at, language)}
                      </p>
                      <MoneySource
                        accountId={loan.account_id}
                        moneyType={loan.money_type}
                        accountsById={accountsById}
                        language={language}
                      />
                      {loan.for_person_id && (
                        <OwnerBadge name={peopleById.get(loan.for_person_id)} language={language} />
                      )}
                    </div>
                    {loan.expected_date && (
                      <p className="text-muted">
                        {copy.due}: {localDateLabel(loan.expected_date, language)}
                      </p>
                    )}
                  </div>
                  {loan.notes && <p className="mt-2 text-xs text-muted">{loan.notes}</p>}
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted">{copy.principal}</p>
                      <p className="number mt-1 truncate text-xs font-semibold text-ink">
                        {formatKyat(loan.principal, language)}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted">{copy.repaid}</p>
                      <p className="number mt-1 truncate text-xs font-semibold text-positive">
                        {formatKyat(loan.repaid, language)}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted">{copy.remaining}</p>
                      <p className="number mt-1 truncate text-xs font-semibold text-ink">
                        {formatKyat(loan.outstanding, language)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 border-t border-line pt-3">
                    <p className="text-xs font-semibold text-ink">{copy.repaymentHistory}</p>
                    {(group.repaymentsByLoan.get(loan.id) ?? []).length ? (
                      <div className="mt-2 space-y-2">
                        {(group.repaymentsByLoan.get(loan.id) ?? []).map((repayment) => (
                          <div key={repayment.id} className="flex items-center justify-between gap-3 text-xs">
                            <span className="flex min-w-0 flex-wrap items-center gap-2">
                              <span className="text-muted">
                                {copy.repaymentAction} · {localDateLabel(repayment.paid_at, language)}
                              </span>
                              <MoneySource
                                accountId={repayment.account_id}
                                accountsById={accountsById}
                                language={language}
                              />
                            </span>
                            <span className="number shrink-0 font-semibold text-positive">
                              {formatKyat(repayment.amount, language)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted">{copy.noRepayments}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
