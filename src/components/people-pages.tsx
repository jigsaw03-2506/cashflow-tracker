"use client";

import { ArrowLeft, ChevronRight, Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { buildHistory, formatKyat, summarizePeople, type PersonBalance } from "@/lib/finance";
import type { Language } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { PersonForm } from "@/components/cashflow-forms";
import { DebtList, debtGroups } from "@/components/debt-list";
import { HistoryList } from "@/components/history-list";
import { requestJson, useTracker } from "@/components/tracker-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  return (
    <Card className="min-w-0">
      <CardContent className="py-5">
        <p className="text-sm text-muted">{label}</p>
        <p
          className={cn(
            "number mt-2 truncate text-xl font-semibold",
            tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : "text-ink",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

/** One line saying who owes whom overall. */
function netSentence(balance: PersonBalance, language: Language) {
  const name = balance.person.name;
  const amount = formatKyat(Math.abs(balance.net), language);
  if (balance.net > 0) {
    return language === "my" ? `${name} က ကိုယ့်ကို ${amount} ပေးရန်ရှိ` : `${name} owes you ${amount}`;
  }
  if (balance.net < 0) {
    return language === "my" ? `ကိုယ်က ${name} ကို ${amount} ပေးရန်ကျန်` : `You owe ${name} ${amount}`;
  }
  return language === "my" ? "ရှင်းပြီးပါပြီ" : "All settled";
}

export function PeoplePage() {
  const { data, loading, refresh, language, setError } = useTracker();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const balances = summarizePeople(data.people, data.loans)
    .filter((balance) => balance.person.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort(
      (left, right) =>
        Math.abs(right.net) - Math.abs(left.net) || left.person.name.localeCompare(right.person.name),
    );
  const all = summarizePeople(data.people, data.loans);
  const totalOwedToMe = all.reduce((sum, balance) => sum + balance.owedToMe, 0);
  const totalIOwe = all.reduce((sum, balance) => sum + balance.iOwe, 0);

  async function addPerson(values: { name: string; phone?: string | null; notes?: string | null }) {
    setBusy(true);
    setError("");
    try {
      await requestJson("/api/people", { method: "POST", body: JSON.stringify(values) });
      setAdding(false);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t(language, "dataLoadError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {language === "my" ? "လူများ" : "People"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {language === "my"
              ? "ဘယ်သူ့ဆီက ဘယ်လောက်ရရန်ရှိလဲ၊ ဘယ်သူ့ကို ဘယ်လောက်ပေးရန်ကျန်လဲ။ နာမည်ကိုနှိပ်ပြီး အသေးစိတ်ကြည့်ပါ။"
              : "Who owes you and whom you owe. Tap a name for the full record."}
          </p>
        </div>
        <Button variant="outline" onClick={() => setAdding(true)}>
          <Plus className="size-4" />
          {language === "my" ? "လူအမည်ထည့်ရန်" : "Add a person"}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Stat
          label={language === "my" ? "စုစုပေါင်း ရရန်ရှိ" : "Total owed to you"}
          value={formatKyat(totalOwedToMe, language)}
          tone="positive"
        />
        <Stat
          label={language === "my" ? "စုစုပေါင်း ပေးရန်ကျန်" : "Total you owe"}
          value={formatKyat(totalIOwe, language)}
          tone="negative"
        />
      </div>

      <Card>
        <CardContent className="space-y-4 pt-5">
          <label className="relative block">
            <span className="sr-only">{t(language, "search")}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={language === "my" ? "နာမည်ရှာရန်" : "Search names"}
              className="pl-9"
            />
          </label>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted">{t(language, "loading")}</p>
          ) : balances.length === 0 ? (
            <p className="rounded-control bg-surface-subtle px-4 py-8 text-center text-sm text-muted">
              {data.people.length
                ? language === "my" ? "ရှာတဲ့နာမည် မတွေ့ပါ။" : "No names match."
                : language === "my" ? "လူအမည် မထည့်ရသေးပါ။" : "No people yet."}
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {balances.map((balance) => (
                <li key={balance.person.id}>
                  <Link
                    href={`/people/${balance.person.id}`}
                    className="flex items-center gap-3 rounded-control px-2 py-3 transition-colors duration-fast hover:bg-surface-subtle"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-control bg-accent-soft text-accent">
                      <Users className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {balance.person.name}
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted">
                        {netSentence(balance, language)}
                      </span>
                    </span>
                    <span className="grid shrink-0 justify-items-end gap-1 text-xs">
                      {balance.owedToMe > 0 && (
                        <span className="number font-semibold text-positive">
                          {language === "my" ? "ရရန် " : "Owed "}
                          {formatKyat(balance.owedToMe, language)}
                        </span>
                      )}
                      {balance.iOwe > 0 && (
                        <span className="number font-semibold text-negative">
                          {language === "my" ? "ပေးရန် " : "You owe "}
                          {formatKyat(balance.iOwe, language)}
                        </span>
                      )}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={adding} onOpenChange={(open) => !open && !busy && setAdding(false)}>
        {adding && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t(language, "addPerson")}</DialogTitle>
              <DialogDescription>
                {language === "my" ? "နာမည်နဲ့ ဖုန်းနံပါတ် ထည့်ပါ။" : "Enter a name and phone number."}
              </DialogDescription>
            </DialogHeader>
            <PersonForm
              language={language}
              busy={busy}
              onCancel={() => setAdding(false)}
              onSubmit={addPerson}
            />
          </DialogContent>
        )}
      </Dialog>
    </main>
  );
}

export function PersonDetail({ id }: { id: string }) {
  const { data, loading, language } = useTracker();
  const person = data.people.find((item) => item.id === id);

  const back = (
    <Link
      href="/people"
      className="inline-flex items-center gap-2 text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
    >
      <ArrowLeft className="size-4" />
      {language === "my" ? "လူများ" : "People"}
    </Link>
  );

  if (!person) {
    return (
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        {back}
        <p className="rounded-control bg-surface-subtle px-4 py-8 text-center text-sm text-muted">
          {loading
            ? t(language, "loading")
            : language === "my" ? "ဒီလူကို မတွေ့ပါ။" : "This person was not found."}
        </p>
      </main>
    );
  }

  const [balance] = summarizePeople([person], data.loans);
  const accountsById = new Map(data.accounts.map((account) => [account.id, account]));
  const peopleById = new Map(data.people.map((item) => [item.id, item.name]));
  const lent = debtGroups(data.loans, data.repayments, [person], "lent").filter((group) => group.personId === id);
  const borrowed = debtGroups(data.loans, data.repayments, [person], "borrowed").filter(
    (group) => group.personId === id,
  );
  const related = buildHistory(data.transactions ?? [], data.loans, data.repayments).filter(
    (entry) => entry.transaction.person_id === id || entry.transaction.for_person_id === id,
  );

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      {back}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{person.name}</h1>
        {(person.phone || person.notes) && (
          <p className="mt-1 text-sm text-muted">
            {[person.phone, person.notes].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      <Card className={cn(balance.net !== 0 && "border-accent bg-accent text-accent-foreground")}>
        <CardContent className="py-5">
          <p className={cn("text-sm", balance.net !== 0 ? "text-accent-foreground/75" : "text-muted")}>
            {language === "my" ? "စုစုပေါင်း" : "Overall"}
          </p>
          <p className="number mt-2 text-2xl font-semibold">{netSentence(balance, language)}</p>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Stat
          label={language === "my" ? `${person.name} က ကိုယ့်ကို ပေးရန် (ရရန်ရှိ)` : `${person.name} owes you`}
          value={formatKyat(balance.owedToMe, language)}
          tone="positive"
        />
        <Stat
          label={language === "my" ? `ကိုယ်က ${person.name} ကို ပေးရန်ကျန်` : `You owe ${person.name}`}
          value={formatKyat(balance.iOwe, language)}
          tone="negative"
        />
      </div>

      {(lent.length > 0 || borrowed.length > 0) && (
        <section className="grid items-start gap-5 xl:grid-cols-2">
          {lent.length > 0 && (
            <DebtList
              language={language}
              direction="lent"
              groups={lent}
              accountsById={accountsById}
              peopleById={peopleById}
              title={language === "my" ? `${person.name} ကို ချေးထားတာ (ရရန်)` : `Lent to ${person.name}`}
            />
          )}
          {borrowed.length > 0 && (
            <DebtList
              language={language}
              direction="borrowed"
              groups={borrowed}
              accountsById={accountsById}
              peopleById={peopleById}
              title={language === "my" ? `${person.name} ဆီက ချေးထားတာ (ပေးရန်)` : `Borrowed from ${person.name}`}
            />
          )}
        </section>
      )}

      <HistoryList
        language={language}
        entries={related}
        people={data.people}
        accountsById={accountsById}
        showFilters={false}
        summaryFor={id}
        title={language === "my" ? `${person.name} နဲ့ ပတ်သက်တဲ့ မှတ်တမ်း` : `Records with ${person.name}`}
        description={language === "my"
          ? "ချေးငွေ၊ ပြန်ဆပ်ငွေနဲ့ သူ့စာရင်းအဖြစ် မှတ်ထားတာ အားလုံး။ ပြင်/ဖျက် ချင်ရင် ပင်မ စာမျက်နှာက မှတ်တမ်းမှာ လုပ်ပါ။"
          : "Loans, repayments, and anything kept in their records. Edit or delete from the history on Home."}
      />
    </main>
  );
}
