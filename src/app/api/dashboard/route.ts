import { NextResponse } from "next/server";
import type { Account, HistoryTransaction, Loan, LoanRepayment, Person } from "@/lib/finance";
import { databaseError, getRouteClient } from "@/lib/api";

export async function GET() {
  const { client, response } = await getRouteClient();
  if (response) return response;

  const [
    { data: accounts, error: accountError },
    { data: people, error: peopleError },
    { data: loans, error: loanError },
    { data: repayments, error: repaymentError },
    { data: transactions, error: transactionError },
  ] =
    await Promise.all([
      client.from("account_balances").select("*").order("created_at"),
      client.from("people").select("*").order("name"),
      client.from("loan_balances").select("*").order("borrowed_or_lent_at", { ascending: false }),
      client.from("loan_repayments").select("*").order("paid_at", { ascending: false }),
      client
        .from("transactions")
        .select("*")
        .order("occurred_at", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

  if (accountError) return databaseError(accountError);
  if (peopleError) return databaseError(peopleError);
  if (loanError) return databaseError(loanError);
  if (repaymentError) return databaseError(repaymentError);
  if (transactionError) return databaseError(transactionError);

  const history = (transactions ?? []) as HistoryTransaction[];
  const transactionsById = new Map(history.map((row) => [row.id, row]));

  return NextResponse.json({
    accounts: (accounts ?? []) as Account[],
    people: (people ?? []) as Person[],
    loans: ((loans ?? []) as Loan[]).map((loan) => ({
      ...loan,
      account_id: transactionsById.get(loan.principal_transaction_id ?? "")?.account_id ?? null,
      for_person_id: transactionsById.get(loan.principal_transaction_id ?? "")?.for_person_id ?? null,
    })),
    repayments: ((repayments ?? []) as LoanRepayment[]).map((repayment) => ({
      ...repayment,
      account_id: transactionsById.get(repayment.transaction_id)?.account_id ?? null,
    })),
    transactions: history,
  });
}
