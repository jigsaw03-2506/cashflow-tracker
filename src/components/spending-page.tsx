"use client";

import { useState } from "react";
import {
  buildHistory,
  formatKyat,
  localDateKey,
  monthRange,
  summarizeSpending,
  type DateRange,
} from "@/lib/finance";
import { cn } from "@/lib/utils";
import { HistoryList } from "@/components/history-list";
import { useTracker } from "@/components/tracker-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Preset = "thisMonth" | "lastMonth" | "thisYear";

function presetRange(preset: Preset, now = new Date()): DateRange {
  if (preset === "lastMonth") return monthRange(now, -1);
  if (preset === "thisYear") return { from: `${now.getFullYear()}-01-01`, to: localDateKey(now) };
  return monthRange(now);
}

export function SpendingPage() {
  const { data, loading, language } = useTracker();
  const [range, setRange] = useState<DateRange>(() => presetRange("thisMonth"));
  /** "all", "mine", or the id of the person whose spending to list. */
  const [owner, setOwner] = useState("all");

  const history = buildHistory(data.transactions ?? [], data.loans, data.repayments);
  const summary = summarizeSpending(history, range);
  const peopleById = new Map(data.people.map((person) => [person.id, person.name]));
  const accountsById = new Map(data.accounts.map((account) => [account.id, account]));
  const owners = [...summary.byPerson.keys()].filter((id) => peopleById.has(id));
  const activeOwner = owner === "all" || owner === "mine" || owners.includes(owner) ? owner : "all";
  const listed = summary.entries.filter((entry) => {
    const entryOwner = entry.transaction.for_person_id ?? null;
    if (activeOwner === "all") return true;
    if (activeOwner === "mine") return entryOwner === null;
    return entryOwner === activeOwner;
  });

  const presets: { value: Preset; label: string }[] = [
    { value: "thisMonth", label: language === "my" ? "ဒီလ" : "This month" },
    { value: "lastMonth", label: language === "my" ? "ပြီးခဲ့တဲ့လ" : "Last month" },
    { value: "thisYear", label: language === "my" ? "ဒီနှစ်" : "This year" },
  ];
  const activePreset = presets.find((preset) => {
    const candidate = presetRange(preset.value);
    return candidate.from === range.from && candidate.to === range.to;
  })?.value;

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {language === "my" ? "အသုံးစာရင်း" : "Spending"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {language === "my"
            ? "ငွေထုတ်ရန် နဲ့ မှတ်ထားတဲ့ အသုံးစရိတ်တွေ။ ကိုယ်ပိုင်အသုံးနဲ့ တခြားသူအတွက်သုံးပေးတာကို ခွဲပြထားသည်။"
            : "Money taken out, split into your own spending and spending for others."}
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-5">
          <div className="flex flex-wrap gap-2" role="group" aria-label={language === "my" ? "ကာလ" : "Period"}>
            {presets.map((preset) => (
              <Button
                key={preset.value}
                type="button"
                size="sm"
                variant={activePreset === preset.value ? "primary" : "outline"}
                aria-pressed={activePreset === preset.value}
                onClick={() => setRange(presetRange(preset.value))}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-xs text-muted">
              {language === "my" ? "မှ" : "From"}
              <Input
                type="date"
                value={range.from}
                max={range.to || undefined}
                onChange={(event) => setRange({ ...range, from: event.target.value })}
              />
            </label>
            <label className="grid gap-1 text-xs text-muted">
              {language === "my" ? "အထိ" : "To"}
              <Input
                type="date"
                value={range.to}
                min={range.from || undefined}
                onChange={(event) => setRange({ ...range, to: event.target.value })}
              />
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-accent bg-accent text-accent-foreground">
          <CardContent className="py-5">
            <p className="text-sm text-accent-foreground/75">
              {language === "my" ? "စုစုပေါင်း အသုံး" : "Total spent"}
            </p>
            <p className="number mt-2 truncate text-2xl font-semibold">
              {formatKyat(summary.total, language)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-sm text-muted">{language === "my" ? "ကိုယ်ပိုင်အသုံး" : "My own spending"}</p>
            <p className="number mt-2 truncate text-xl font-semibold text-ink">
              {formatKyat(summary.mine, language)}
            </p>
          </CardContent>
        </Card>
        {owners.map((id) => (
          <Card key={id}>
            <CardContent className="py-5">
              <p className="text-sm text-muted">
                {language === "my" ? `${peopleById.get(id)} အတွက်သုံးပေးတာ` : `Spent for ${peopleById.get(id)}`}
              </p>
              <p className="number mt-2 truncate text-xl font-semibold text-ink">
                {formatKyat(summary.byPerson.get(id) ?? 0, language)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={language === "my" ? "ဘယ်သူ့အသုံးလဲ" : "Whose spending"}>
        {[
          { value: "all", label: language === "my" ? "အားလုံး" : "All" },
          { value: "mine", label: language === "my" ? "ကိုယ်ပိုင်" : "Mine" },
          ...owners.map((id) => ({
            value: id,
            label: language === "my" ? `${peopleById.get(id)} အတွက်` : `For ${peopleById.get(id)}`,
          })),
        ].map((item) => (
          <Button
            key={item.value}
            type="button"
            size="sm"
            variant={activeOwner === item.value ? "primary" : "outline"}
            aria-pressed={activeOwner === item.value}
            onClick={() => setOwner(item.value)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div className={cn(loading && "opacity-65")}>
        <HistoryList
          key={`${range.from}-${range.to}-${activeOwner}`}
          language={language}
          entries={listed}
          people={data.people}
          accountsById={accountsById}
          showFilters={false}
          title={language === "my" ? "အသုံးမှတ်တမ်း" : "Spending records"}
          description={language === "my"
            ? "ပြင်/ဖျက် ချင်ရင် ပင်မ စာမျက်နှာက မှတ်တမ်းမှာ လုပ်ပါ။"
            : "Edit or delete from the history on Home."}
        />
      </div>
    </main>
  );
}
