"use client";

import {
  Archive,
  Banknote,
  Check,
  Minus,
  Landmark,
  Pencil,
  Plus,
  Wallet,
  X,
} from "lucide-react";
import { useState } from "react";
import type {
  Account,
  HistoryEntry,
  MoneyType,
} from "@/lib/finance";
import { accountLabels, t, type Language } from "@/lib/i18n";
import {
  AccountForm,
  DepositForm,
  LoanForm,
  PersonForm,
  RepaymentForm,
  EditEntryForm,
  type DepositFormValues,
  type EditEntryValues,
} from "@/components/cashflow-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildHistory, formatKyat, summarizeAccountBalances } from "@/lib/finance";
import {
  HistoryList,
  historyLabel,
  localDateLabel,
} from "@/components/history-list";
import type { AccountInput } from "@/lib/validation";
import { DebtList, debtGroups } from "@/components/debt-list";
import { displayError, requestJson, useTracker } from "@/components/tracker-provider";
import { cn } from "@/lib/utils";

type ModalState =
  | { kind: "account"; account?: Account }
  | { kind: "deposit"; mode: "in" | "out"; account?: Account }
  | { kind: "person" }
  | { kind: "loan"; direction: "lent" | "borrowed" }
  | { kind: "repayment"; direction: "lent" | "borrowed" }
  | { kind: "editEntry"; entry: HistoryEntry }
  | { kind: "deleteEntry"; entry: HistoryEntry }
  | null;

function AccountBalanceCard({
  account,
  language,
  onDeposit,
  onEdit,
  onToggleArchive,
}: {
  account: Account;
  language: Language;
  onDeposit: () => void;
  onEdit: () => void;
  onToggleArchive: () => void;
}) {
  const label = language === "my"
    ? accountLabels.my[account.kind] ?? account.name
    : account.name;
  return (
    <Card className={cn(!account.is_active && "opacity-65")}>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <span className="grid size-10 place-items-center rounded-control bg-accent-soft text-accent">
            {account.kind === "physical_cash" ? (
              <Banknote className="size-5" />
            ) : (
              <Landmark className="size-5" />
            )}
          </span>
          {!account.is_active && (
            <Badge className="bg-surface-subtle text-muted">
              {t(language, "archived")}
            </Badge>
          )}
        </div>
        <p className="mt-4 truncate text-sm text-muted">{label}</p>
        <p className="mt-1 truncate text-xs text-muted">{account.name}</p>
        <p className="number mt-4 truncate text-xl font-semibold text-ink">
          {formatKyat(account.current_balance, language)}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          {account.is_active ? (
            <Button variant="outline" size="sm" onClick={onDeposit}>
              <Plus className="size-4" />
              {language === "my" ? "ငွေထည့်ရန်" : "Add money"}
            </Button>
          ) : <span />}
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Pencil className="size-4" />
              {t(language, "edit")}
            </Button>
            <Button variant="ghost" size="sm" onClick={onToggleArchive}>
              <Archive className="size-4" />
              {t(language, account.is_active ? "archive" : "active")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DebtTrackerApp() {
  const { data, loading, refresh, language, error, setError } = useTracker();
  const [modal, setModal] = useState<ModalState>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function perform(operation: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await operation();
      setModal(null);
      setNotice(success);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t(language, "dataLoadError"));
    } finally {
      setBusy(false);
    }
  }

  function openLoan(direction: "lent" | "borrowed") {
    if (!data.accounts.some((account) => account.is_active)) {
      setError(language === "my" ? "အရင်ဆုံး ငွေစာရင်းတစ်ခု ထည့်ပါ။" : "Add an account first.");
      setModal({ kind: "account" });
      return;
    }
    if (!data.people.length) {
      setError(language === "my" ? "အရင်ဆုံး လူတစ်ဦး ထည့်ပါ။" : "Add a person first.");
      setModal({ kind: "person" });
      return;
    }
    setError("");
    setModal({ kind: "loan", direction });
  }

  function openRepayment(direction: "lent" | "borrowed") {
    const openLoans = data.loans.some(
      (loan) => loan.direction === direction && Number(loan.outstanding) > 0,
    );
    if (!openLoans) return;
    if (!data.accounts.some((account) => account.is_active)) {
      setError(language === "my" ? "အရင်ဆုံး ငွေစာရင်းတစ်ခု ထည့်ပါ။" : "Add an account first.");
      setModal({ kind: "account" });
      return;
    }
    setModal({ kind: "repayment", direction });
  }

  async function saveAccount(values: AccountInput) {
    const current = modal?.kind === "account" ? modal.account : undefined;
    await perform(
      () => requestJson(current ? `/api/accounts/${current.id}` : "/api/accounts", {
        method: current ? "PATCH" : "POST",
        body: JSON.stringify(values),
      }),
      language === "my" ? "ငွေစာရင်းကို သိမ်းဆည်းပြီးပါပြီ။" : "Account saved.",
    );
  }

  async function saveDeposit(values: DepositFormValues) {
    await perform(
      () => requestJson("/api/deposits", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          occurred_at: new Date(`${values.occurred_at}T12:00:00`).toISOString(),
          request_key: crypto.randomUUID(),
        }),
      }),
      values.kind === "expense"
        ? language === "my" ? "ငွေထုတ်ပြီးပါပြီ။" : "Money taken out."
        : language === "my" ? "ငွေထည့်ပြီးပါပြီ။" : "Money added.",
    );
  }

  async function savePerson(values: { name: string; phone?: string | null; notes?: string | null }) {
    await perform(
      () => requestJson("/api/people", { method: "POST", body: JSON.stringify(values) }),
      language === "my" ? "လူအမည်ကို သိမ်းဆည်းပြီးပါပြီ။" : "Person added.",
    );
  }

  async function saveLoan(values: {
    person_id: string;
    account_id?: string;
    is_opening_balance: boolean;
    money_type?: MoneyType;
    amount: number;
    occurred_at: string;
    expected_date?: string;
    notes?: string;
  }) {
    if (modal?.kind !== "loan") return;
    await perform(
      () => requestJson("/api/loans", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          expected_date: values.expected_date || null,
          direction: modal.direction,
          occurred_at: new Date(`${values.occurred_at}T12:00:00`).toISOString(),
          request_key: crypto.randomUUID(),
        }),
      }),
      language === "my" ? "အကြွေးမှတ်တမ်းကို သိမ်းဆည်းပြီးပါပြီ။" : "Debt recorded.",
    );
  }

  async function saveRepayment(values: {
    loan_id: string;
    account_id: string;
    amount: number;
    paid_at: string;
    notes?: string;
  }) {
    await perform(
      () => requestJson(`/api/loans/${values.loan_id}/repayments`, {
        method: "POST",
        body: JSON.stringify({
          ...values,
          paid_at: new Date(`${values.paid_at}T12:00:00`).toISOString(),
          request_key: crypto.randomUUID(),
        }),
      }),
      language === "my" ? "ပြန်ဆပ်ငွေကို မှတ်တမ်းတင်ပြီးပါပြီ။" : "Repayment recorded.",
    );
  }

  async function saveEntryEdit(values: EditEntryValues) {
    if (modal?.kind !== "editEntry") return;
    const id = modal.entry.transaction.id;
    await perform(
      () => requestJson(`/api/transactions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...values,
          occurred_at: new Date(`${values.occurred_at}T12:00:00`).toISOString(),
          expected_date: values.expected_date || null,
        }),
      }),
      language === "my" ? "မှတ်တမ်းကို ပြင်ပြီးပါပြီ။" : "Record updated.",
    );
  }

  async function deleteEntry(entry: HistoryEntry) {
    await perform(
      () => requestJson(`/api/transactions/${entry.transaction.id}`, { method: "DELETE" }),
      language === "my" ? "မှတ်တမ်းကို ဖျက်ပြီးပါပြီ။" : "Record deleted.",
    );
  }

  function entryTitle(entry: HistoryEntry) {
    const person = data.people.find((item) => item.id === entry.transaction.person_id)?.name;
    return [
      historyLabel(entry, language),
      person,
      formatKyat(entry.transaction.amount, language),
      localDateLabel(entry.transaction.occurred_at, language),
    ].filter(Boolean).join(" · ");
  }

  async function toggleArchive(account: Account) {
    await perform(
      () => requestJson(`/api/accounts/${account.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !account.is_active }),
      }),
      language === "my"
        ? account.is_active ? "ငွေစာရင်းကို သိမ်းဆည်းပြီးပါပြီ။" : "ငွေစာရင်းကို ပြန်ဖွင့်ပြီးပါပြီ။"
        : account.is_active ? "Account archived." : "Account restored.",
    );
  }

  const activeAccounts = data.accounts.filter((account) => account.is_active);
  const accountsById = new Map(data.accounts.map((account) => [account.id, account]));
  const peopleById = new Map(data.people.map((person) => [person.id, person.name]));
  const accountBalances = summarizeAccountBalances(data.accounts);
  const receivables = debtGroups(data.loans, data.repayments, data.people, "lent");
  const payables = debtGroups(data.loans, data.repayments, data.people, "borrowed");
  const history = buildHistory(data.transactions ?? [], data.loans, data.repayments);
  const modalTitle =
    modal?.kind === "account"
      ? modal.account ? t(language, "edit") : t(language, "addAccount")
      : modal?.kind === "deposit"
        ? modal.mode === "out"
          ? language === "my" ? "ငွေထုတ်ရန်" : "Take money out"
          : language === "my" ? "ငွေထည့်ရန်" : "Add money"
      : modal?.kind === "person"
        ? t(language, "addPerson")
        : modal?.kind === "loan"
          ? t(language, modal.direction === "lent" ? "lendMoney" : "borrowMoney")
          : modal?.kind === "repayment"
            ? t(language, modal.direction === "lent" ? "receiveRepayment" : "makeRepayment")
            : modal?.kind === "editEntry"
              ? language === "my" ? "မှတ်တမ်း ပြင်ရန်" : "Edit record"
              : modal?.kind === "deleteEntry"
                ? language === "my" ? "မှတ်တမ်း ဖျက်ရန်" : "Delete record"
                : "";

  return (
    <>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
        {notice && (
          <div role="status" className="flex items-center justify-between gap-4 rounded-card border border-positive/25 bg-positive/5 px-4 py-3 text-sm text-positive">
            <span className="flex items-center gap-2"><Check className="size-4" />{notice}</span>
            <button type="button" aria-label="Dismiss" onClick={() => setNotice("")}>
              <X className="size-4" />
            </button>
          </div>
        )}

        {!data.accounts.length && !loading && (
          <Card className="border-accent bg-accent text-accent-foreground">
            <CardContent className="flex flex-col items-start justify-between gap-5 py-6 sm:flex-row sm:items-center">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold text-accent-foreground/75">
                  {language === "my" ? "ပထမဆုံးအဆင့် · လက်ကျန်ငွေထည့်ပါ" : "Step 1 · Add your current balance"}
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                  {language === "my"
                    ? "စစချင်းမှာ ကိုယ့်လက်ရှိငွေကို အရင်ထည့်ပါ"
                    : "Start by entering the money you have now"}
                </h2>
                <p className="mt-2 text-sm text-accent-foreground/75">
                  {language === "my"
                    ? "ဘဏ်၊ Wallet သို့မဟုတ် လက်ငင်းငွေ တစ်ခုချင်းစီရဲ့ လက်ကျန်ကို ထည့်ပါ။ ပြီးရင် အကြွေးစာရင်းတွေ မှတ်နိုင်ပါတယ်။"
                    : "Enter each bank, wallet, or cash balance first. Then record money owed to you and money you owe."}
                </p>
              </div>
              <Button
                variant="outline"
                className="shrink-0 border-accent-foreground/30 bg-surface text-ink hover:bg-surface-subtle"
                onClick={() => setModal({ kind: "account" })}
              >
                <Plus className="size-4" />
                {language === "my" ? "လက်ကျန်ငွေ စတင်ထည့်ရန်" : "Enter starting balance"}
              </Button>
            </CardContent>
          </Card>
        )}

        <section aria-labelledby="money-heading" className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 id="money-heading" className="text-2xl font-semibold tracking-tight text-ink">
                {language === "my" ? "ကျွန်ုပ်၏ ငွေကြေး" : "My money"}
              </h1>
              <p className="mt-1 text-sm text-muted">
                {language === "my"
                  ? "ကိုယ်ပိုင်လက်ကျန်ငွေနှင့် အကြွေးလက်ကျန်များ"
                  : "Your account balances and outstanding debts"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setModal({ kind: "person" })}>
                <Plus className="size-4" />
                {language === "my" ? "လူအမည်ထည့်ရန်" : "Add a person"}
              </Button>
              <Button
                variant="outline"
                disabled={!activeAccounts.length}
                onClick={() => {
                  setError("");
                  setModal({ kind: "deposit", mode: "out" });
                }}
              >
                <Minus className="size-4" />
                {language === "my" ? "ငွေထုတ်ရန်" : "Take money out"}
              </Button>
              <Button
                onClick={() => {
                  setError("");
                  setModal({ kind: "deposit", mode: "in" });
                }}
              >
                <Plus className="size-4" />
                {language === "my" ? "ငွေထည့်ရန်" : "Add money"}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="border-accent bg-accent text-accent-foreground sm:col-span-2">
              <CardContent className="flex min-h-24 items-center justify-between gap-4 py-5">
                <div className="min-w-0">
                  <p className="text-sm text-accent-foreground/75">
                    {language === "my" ? "လက်ရှိရှိသော စုစုပေါင်းငွေ" : "Total money you have now"}
                  </p>
                  <p className="number mt-2 truncate text-2xl font-semibold">
                    {formatKyat(accountBalances.total, language)}
                  </p>
                </div>
                <Wallet className="size-6 shrink-0" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex min-h-24 items-center justify-between gap-4 py-5">
                <div className="min-w-0">
                  <p className="text-sm text-muted">
                    {language === "my" ? "E-money စုစုပေါင်း" : "Total e-money"}
                  </p>
                  <p className="number mt-2 truncate text-xl font-semibold text-ink">
                    {formatKyat(accountBalances.eMoney, language)}
                  </p>
                </div>
                <Landmark className="size-5 shrink-0 text-accent" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex min-h-24 items-center justify-between gap-4 py-5">
                <div className="min-w-0">
                  <p className="text-sm text-muted">
                    {language === "my" ? "ငွေသား စုစုပေါင်း" : "Total cash"}
                  </p>
                  <p className="number mt-2 truncate text-xl font-semibold text-ink">
                    {formatKyat(accountBalances.cash, language)}
                  </p>
                </div>
                <Banknote className="size-5 shrink-0 text-accent" />
              </CardContent>
            </Card>
          </div>
        </section>

        <section aria-labelledby="accounts-heading" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="accounts-heading" className="text-lg font-semibold text-ink">
                {language === "my" ? "ငွေစာရင်းလက်ကျန်များ" : "Account balances"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {language === "my"
                  ? "ချေးငွေနှင့် ပြန်ဆပ်ငွေများအလိုက် လက်ကျန်ကို ပြင်ဆင်ပေးမည်။"
                  : "Lending and repayments automatically update these balances."}
              </p>
            </div>
            {data.accounts.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setModal({ kind: "account" })}>
                <Plus className="size-4" />
                {t(language, "addAccount")}
              </Button>
            )}
          </div>
          {loading ? (
            <Card><CardContent className="grid min-h-32 place-items-center text-sm text-muted">{t(language, "loading")}</CardContent></Card>
          ) : data.accounts.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.accounts.map((account) => (
                <AccountBalanceCard
                  key={account.id}
                  account={account}
                  language={language}
                  onDeposit={() => setModal({ kind: "deposit", mode: "in", account })}
                  onEdit={() => setModal({ kind: "account", account })}
                  onToggleArchive={() => void toggleArchive(account)}
                />
              ))}
            </div>
          ) : null}
          {!activeAccounts.length && data.accounts.length > 0 && (
            <p className="text-sm text-warning">
              {language === "my" ? "အသုံးပြုနိုင်သော ငွေစာရင်းတစ်ခုကို ဖွင့်ပါ။" : "Activate an account to record a debt or repayment."}
            </p>
          )}
        </section>

        <section aria-label={language === "my" ? "အကြွေးစာရင်း" : "Debt lists"} className="grid items-start gap-5 xl:grid-cols-2">
          <DebtList
            language={language}
            direction="lent"
            groups={receivables}
            accountsById={accountsById}
            peopleById={peopleById}
            onAdd={() => openLoan("lent")}
            onRepay={() => openRepayment("lent")}
            addDisabled={!activeAccounts.length}
          />
          <DebtList
            language={language}
            direction="borrowed"
            groups={payables}
            accountsById={accountsById}
            peopleById={peopleById}
            onAdd={() => openLoan("borrowed")}
            onRepay={() => openRepayment("borrowed")}
            addDisabled={!activeAccounts.length}
          />
        </section>

        <section aria-label={language === "my" ? "မှတ်တမ်း" : "History"}>
          <HistoryList
            language={language}
            entries={history}
            people={data.people}
            accountsById={accountsById}
            onEdit={(entry) => {
              setError("");
              setModal({ kind: "editEntry", entry });
            }}
            onDelete={(entry) => {
              setError("");
              setModal({ kind: "deleteEntry", entry });
            }}
          />
        </section>
      </main>

      <Dialog open={modal !== null} onOpenChange={(open) => !open && !busy && setModal(null)}>
        {modal && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{modalTitle}</DialogTitle>
              <DialogDescription>
                {modal.kind === "account" && (language === "my"
                  ? "စတင်လက်ကျန်ကို ထည့်ပါ။ ချေးငွေနှင့် ပြန်ဆပ်ငွေများက လက်ကျန်ကို ပြင်ဆင်မည်။"
                  : "Set the starting balance. Loans and repayments update the current balance.")}
                {modal.kind === "deposit" && modal.mode === "in" && (language === "my"
                  ? "ငွေအမျိုးအစားကို ရွေးပြီး ငွေထည့်ပါ။ ထည့်တိုင်း မှတ်တမ်းသီးသီး သိမ်းပြီး လက်ကျန်ကို ပေါင်းပေးမည်။"
                  : "Choose the type of money, then add it. Each top-up is saved separately and added to the balance.")}
                {modal.kind === "deposit" && modal.mode === "out" && (language === "my"
                  ? "ဘယ်အကောင့်က ထုတ်လဲ ရွေးပြီး သုံးလိုက်တဲ့ငွေကို မှတ်ပါ။ လက်ကျန်ထဲက နှုတ်ပေးမည်။"
                  : "Choose the account the money left. It is subtracted from the balance.")}
                {modal.kind === "loan" && (language === "my"
                  ? "ချေးငွေကို လူတစ်ဦးနှင့် ငွေစာရင်းတစ်ခုသို့ မှတ်တမ်းတင်ပါ။"
                  : "Record the person, amount, and account used.")}
                {modal.kind === "repayment" && (language === "my"
                  ? "ပြန်ဆပ်ငွေကို မှတ်တမ်းတင်ပြီး လက်ကျန်ကို အလိုအလျောက် ပြင်ဆင်မည်။"
                  : "Record a full or partial repayment; balances update automatically.")}
                {modal.kind === "editEntry" && (language === "my"
                  ? "ပြင်လိုက်ရင် အကောင့်လက်ကျန်နဲ့ အကြွေးစာရင်းကို ပြန်တွက်ပေးမည်။"
                  : "Balances and debt totals are recalculated after you save.")}
                {modal.kind === "deleteEntry" && (language === "my"
                  ? "ဖျက်လိုက်ရင် ပြန်ယူလို့ မရပါ။ လက်ကျန်ကို ပြန်တွက်ပေးမည်။"
                  : "This cannot be undone. Balances are recalculated.")}
              </DialogDescription>
            </DialogHeader>
            {error && (
              <div role="alert" className="mb-4 rounded-control border border-negative/25 bg-negative/5 px-3 py-2 text-sm text-negative">
                {displayError(error, language)}
              </div>
            )}
            {modal.kind === "account" && (
              <AccountForm
                language={language}
                initial={modal.account}
                busy={busy}
                onCancel={() => setModal(null)}
                onSubmit={saveAccount}
              />
            )}
            {modal.kind === "deposit" && (
              <DepositForm
                key={modal.mode}
                language={language}
                mode={modal.mode}
                accounts={data.accounts}
                people={data.people}
                initialAccount={modal.account}
                busy={busy}
                onCancel={() => setModal(null)}
                onSubmit={saveDeposit}
              />
            )}
            {modal.kind === "person" && (
              <PersonForm
                language={language}
                busy={busy}
                onCancel={() => setModal(null)}
                onSubmit={savePerson}
              />
            )}
            {modal.kind === "loan" && (
              <LoanForm
                language={language}
                direction={modal.direction}
                accounts={data.accounts}
                people={data.people}
                busy={busy}
                onCancel={() => setModal(null)}
                onSubmit={saveLoan}
              />
            )}
            {modal.kind === "repayment" && (
              <RepaymentForm
                language={language}
                direction={modal.direction}
                loans={data.loans}
                accounts={data.accounts}
                people={data.people}
                busy={busy}
                onCancel={() => setModal(null)}
                onSubmit={saveRepayment}
              />
            )}
            {modal.kind === "editEntry" && (
              <EditEntryForm
                language={language}
                entry={modal.entry}
                title={entryTitle(modal.entry)}
                accounts={data.accounts}
                people={data.people}
                busy={busy}
                onCancel={() => setModal(null)}
                onSubmit={saveEntryEdit}
              />
            )}
            {modal.kind === "deleteEntry" && (
              <div className="grid gap-4">
                <p className="rounded-control bg-surface-subtle p-3 text-sm text-ink">
                  {entryTitle(modal.entry)}
                </p>
                {modal.entry.isLoanPrincipal && Number(modal.entry.loan?.repaid ?? 0) > 0 && (
                  <p className="text-sm text-warning">
                    {language === "my"
                      ? `ဒီအကြွေးရဲ့ ပြန်ဆပ်မှတ်တမ်းတွေ (${formatKyat(modal.entry.loan?.repaid ?? 0, language)}) လည်း အတူတူ ပျက်ပါမယ်။`
                      : `Its repayments (${formatKyat(modal.entry.loan?.repaid ?? 0, language)}) will be deleted too.`}
                  </p>
                )}
                <div className="mt-2 flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setModal(null)}>
                    {t(language, "cancel")}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => void deleteEntry(modal.entry)}
                  >
                    {busy ? t(language, "loading") : language === "my" ? "ဖျက်မည်" : "Delete"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
