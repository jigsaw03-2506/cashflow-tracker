"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  History,
  Landmark,
  Pencil,
  Trash2,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Account, HistoryEntry, MoneyType, Person } from "@/lib/finance";
import { formatKyat, moneyTypeForAccount, summarizeOwner } from "@/lib/finance";
import type { Language } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function localDateLabel(value: string, language: Language) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(language === "my" ? "my-MM" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    numberingSystem: "latn",
    timeZone: "UTC",
  }).format(date);
}

export function MoneySource({
  accountId,
  moneyType,
  accountsById,
  language,
}: {
  accountId?: string | null;
  moneyType?: MoneyType | null;
  accountsById: Map<string, Account>;
  language: Language;
}) {
  const account = accountId ? accountsById.get(accountId) : undefined;
  const existingLabel = language === "my" ? "အရင်ရှိပြီးသား" : "Existing debt";
  const type = accountId ? moneyTypeForAccount(account) : moneyType;
  if (!type) {
    return <Badge className="bg-surface text-muted">{existingLabel}</Badge>;
  }
  const isCash = type === "cash";
  const typeLabel = isCash
    ? language === "my" ? "ငွေသား" : "Cash"
    : "E-money";
  const detail = accountId ? account?.name : existingLabel;
  return (
    <Badge className="max-w-full gap-1">
      {isCash ? <Banknote className="size-3 shrink-0" /> : <Landmark className="size-3 shrink-0" />}
      <span className="truncate">
        {typeLabel}
        {detail && ` · ${detail}`}
      </span>
    </Badge>
  );
}

export function OwnerBadge({ name, language }: { name?: string; language: Language }) {
  return (
    <Badge className="max-w-full gap-1 bg-warning/10 text-warning">
      <UserRound className="size-3 shrink-0" />
      <span className="truncate">
        {language === "my" ? `${name ?? "—"} ရဲ့စာရင်း` : `${name ?? "—"}'s records`}
      </span>
    </Badge>
  );
}

function OwnerStat({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" }) {
  return (
    <div className="min-w-0 rounded-control bg-surface-subtle px-3 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={cn(
          "number mt-1 truncate text-sm font-semibold",
          tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : "text-ink",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function historyLabel(entry: HistoryEntry, language: Language) {
  const labels = language === "my"
    ? {
        income: "ငွေထည့်",
        lending: "ရရန်ရှိ",
        borrowing: "ပေးရန်ကျန်",
        lend_repayment: "ပြန်ရငွေ",
        borrow_repayment: "ပြန်ဆပ်ငွေ",
        expense: "ငွေထုတ်",
        transfer: "လွှဲပြောင်း",
      }
    : {
        income: "Money added",
        lending: "Lent",
        borrowing: "Borrowed",
        lend_repayment: "Repayment received",
        borrow_repayment: "Repayment made",
        expense: "Money out",
        transfer: "Transfer",
      };
  return labels[entry.transaction.kind];
}

const PAGE_SIZE = 20;

export function HistoryList({
  language,
  entries,
  people,
  accountsById,
  onEdit,
  onDelete,
  title,
  description,
  showFilters = true,
  summaryFor,
}: {
  language: Language;
  entries: HistoryEntry[];
  people: Person[];
  accountsById: Map<string, Account>;
  /** Without onEdit/onDelete the list is read-only. */
  onEdit?: (entry: HistoryEntry) => void;
  onDelete?: (entry: HistoryEntry) => void;
  title?: string;
  description?: string;
  showFilters?: boolean;
  /** Always show the money-in/out summary for this person's records. */
  summaryFor?: string;
}) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  /** "all", "mine", or the id of the person whose records to show. */
  const [filter, setFilter] = useState("all");
  const peopleById = new Map(people.map((person) => [person.id, person.name]));
  const ownerIds = new Set(entries.flatMap((entry) => entry.transaction.for_person_id ?? []));
  const owners = people.filter((person) => ownerIds.has(person.id));
  const activeFilter = filter === "all" || filter === "mine" || ownerIds.has(filter) ? filter : "all";
  const shown = entries.filter((entry) => {
    const owner = entry.transaction.for_person_id ?? null;
    if (activeFilter === "all") return true;
    if (activeFilter === "mine") return owner === null;
    return owner === activeFilter;
  });
  const summaryId = summaryFor ?? activeFilter;
  const ownerName = summaryFor && !ownerIds.has(summaryFor) ? undefined : peopleById.get(summaryId);
  const summary = ownerName ? summarizeOwner(entries, summaryId) : null;
  const filters = [
    { value: "all", label: language === "my" ? "အားလုံး" : "All" },
    { value: "mine", label: language === "my" ? "ကိုယ်ပိုင်" : "Mine" },
    ...owners.map((person) => ({
      value: person.id,
      label: language === "my" ? `${person.name} ရဲ့စာရင်း` : `${person.name}'s records`,
    })),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title ?? (language === "my" ? "မှတ်တမ်း" : "History")}</CardTitle>
        <p className="text-sm text-muted">
          {description ?? (language === "my"
            ? "ငွေထည့်တာ၊ ရရန်ရှိ၊ ပေးရန်ကျန်နဲ့ ပြန်ဆပ်ငွေ အားလုံး။ ပြင်ရင် ဒါမှမဟုတ် ဖျက်ရင် လက်ကျန်ကို ပြန်တွက်ပေးမည်။"
            : "Every top-up, loan, and repayment. Editing or deleting updates your balances.")}
        </p>
      </CardHeader>
      <CardContent>
        {showFilters && owners.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={language === "my" ? "စာရင်းရွေးရန်" : "Filter records"}>
            {filters.map((item) => (
              <Button
                key={item.value}
                type="button"
                size="sm"
                variant={activeFilter === item.value ? "primary" : "outline"}
                aria-pressed={activeFilter === item.value}
                onClick={() => {
                  setFilter(item.value);
                  setVisible(PAGE_SIZE);
                }}
              >
                {item.label}
              </Button>
            ))}
          </div>
        )}
        {summary && ownerName && (
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <OwnerStat
              label={language === "my" ? "ဝင်ငွေ" : "Money in"}
              value={`+${formatKyat(summary.moneyIn, language)}`}
              tone="positive"
            />
            <OwnerStat
              label={language === "my" ? "ထွက်ငွေ" : "Money out"}
              value={`−${formatKyat(summary.moneyOut, language)}`}
            />
            <OwnerStat
              label={summary.held >= 0
                ? language === "my" ? `${ownerName} ရဲ့ငွေ ကိုယ့်ဆီမှာ` : `${ownerName}'s money you hold`
                : language === "my" ? `${ownerName} အတွက် ကိုယ်စိုက်ထား` : `You paid for ${ownerName}`}
              value={formatKyat(Math.abs(summary.held), language)}
              tone={summary.held >= 0 ? undefined : "negative"}
            />
            {summary.lentOutstanding > 0 && (
              <OwnerStat
                label={language === "my" ? `${ownerName} အတွက် ရရန်ရှိ` : `Owed to ${ownerName}`}
                value={formatKyat(summary.lentOutstanding, language)}
              />
            )}
            {summary.borrowedOutstanding > 0 && (
              <OwnerStat
                label={language === "my" ? `${ownerName} အတွက် ပေးရန်ကျန်` : `${ownerName} owes`}
                value={formatKyat(summary.borrowedOutstanding, language)}
              />
            )}
          </div>
        )}
        {shown.length === 0 ? (
          <p className="rounded-control bg-surface-subtle px-4 py-8 text-center text-sm text-muted">
            {language === "my" ? "မှတ်တမ်း မရှိသေးပါ။" : "Nothing recorded yet."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {shown.slice(0, visible).map((entry) => {
              const { transaction } = entry;
              const person = transaction.person_id ? peopleById.get(transaction.person_id) : undefined;
              const sign = entry.effect === 1 ? "+" : entry.effect === -1 ? "−" : "";
              return (
                <li key={transaction.id} className="flex items-start gap-3 py-3">
                  <span
                    className={cn(
                      "mt-1 grid size-8 shrink-0 place-items-center rounded-control",
                      entry.effect === 0 ? "bg-surface-subtle text-muted" : "bg-accent-soft text-accent",
                    )}
                  >
                    {entry.effect === 1 ? (
                      <ArrowDownLeft className="size-4" />
                    ) : entry.effect === -1 ? (
                      <ArrowUpRight className="size-4" />
                    ) : (
                      <History className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-semibold text-ink">
                        {historyLabel(entry, language)}
                        {person && transaction.person_id && (
                          <>
                            <span className="font-normal text-muted"> · </span>
                            <Link
                              href={`/people/${transaction.person_id}`}
                              className="font-normal text-muted underline-offset-4 hover:underline"
                            >
                              {person}
                            </Link>
                          </>
                        )}
                      </p>
                      <p
                        className={cn(
                          "number shrink-0 text-sm font-semibold",
                          entry.effect === 1 ? "text-positive" : entry.effect === 0 ? "text-muted" : "text-ink",
                        )}
                      >
                        {sign}{formatKyat(transaction.amount, language)}
                      </p>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted">
                        <span>{localDateLabel(transaction.occurred_at, language)}</span>
                        <MoneySource
                          accountId={transaction.account_id}
                          moneyType={entry.loan?.money_type}
                          accountsById={accountsById}
                          language={language}
                        />
                        {transaction.for_person_id && activeFilter === "all" && (
                          <OwnerBadge name={peopleById.get(transaction.for_person_id)} language={language} />
                        )}
                      </div>
                      {onEdit && onDelete && (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={language === "my" ? "ပြင်ရန်" : "Edit"}
                          onClick={() => onEdit(entry)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-negative"
                          aria-label={language === "my" ? "ဖျက်ရန်" : "Delete"}
                          onClick={() => onDelete(entry)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                      )}
                    </div>
                    {transaction.notes && (
                      <p className="mt-1 text-xs text-muted">{transaction.notes}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {shown.length > visible && (
          <div className="mt-3 flex justify-center">
            <Button variant="outline" size="sm" onClick={() => setVisible(visible + PAGE_SIZE)}>
              {language === "my" ? "နောက်ထပ်ပြရန်" : "Show more"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
