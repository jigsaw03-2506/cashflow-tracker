"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import type { ReactNode } from "react";
import type { Account, HistoryEntry, Loan, MoneyType, Person } from "@/lib/finance";
import { formatKyat, moneyTypeForAccount } from "@/lib/finance";
import { accountLabels, t, type Language } from "@/lib/i18n";
import { accountSchema, MAX_AMOUNT, personSchema } from "@/lib/validation";
import { SearchableSelect } from "@/components/searchable-select";
import { Button } from "@/components/ui/button";
import { AmountInput } from "@/components/ui/amount-input";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const loanFormSchema = z.object({
  person_id: z.string().uuid(),
  account_id: z.string().optional(),
  is_opening_balance: z.boolean(),
  money_type: z.enum(["cash", "e_money"]).optional(),
  amount: z.number().finite().positive().max(MAX_AMOUNT),
  occurred_at: z.string().min(1),
  expected_date: z.string().optional(),
  notes: z.string().trim().max(1000).optional(),
}).refine(
  (value) => value.is_opening_balance || z.string().uuid().safeParse(value.account_id).success,
  { path: ["account_id"], message: "Choose an account." },
);

const repaymentFormSchema = z.object({
  loan_id: z.string().uuid(),
  account_id: z.string().uuid({ message: "Choose an account." }),
  amount: z.number().finite().positive().max(MAX_AMOUNT),
  paid_at: z.string().min(1),
  notes: z.string().trim().max(1000).optional(),
});

type OwnerValue = { for_person_id?: string | null };
type LoanFormValues = z.infer<typeof loanFormSchema> & OwnerValue;
type RepaymentFormValues = z.infer<typeof repaymentFormSchema> & OwnerValue;

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-ink">
      {label}
      {children}
      {error && <span className="text-xs font-normal text-negative">{error}</span>}
    </label>
  );
}

function localDateInput(value?: string) {
  const date = value ? new Date(value) : new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

function FormActions({
  language,
  busy,
  onCancel,
}: {
  language: Language;
  busy: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="mt-6 flex justify-end gap-3">
      <Button type="button" variant="outline" onClick={onCancel}>
        {t(language, "cancel")}
      </Button>
      <Button type="submit" disabled={busy}>
        {busy ? t(language, "loading") : t(language, "save")}
      </Button>
    </div>
  );
}

function MoneyTypeSelector({
  language,
  value,
  onChange,
}: {
  language: Language;
  value: MoneyType;
  onChange: (value: MoneyType) => void;
}) {
  return (
    <Field label={language === "my" ? "ငွေအမျိုးအစား" : "Money type"}>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label={language === "my" ? "ငွေအမျိုးအစား" : "Money type"}>
        {([
          ["e_money", language === "my" ? "E-money" : "E-money"],
          ["cash", language === "my" ? "ငွေသား" : "Cash"],
        ] as const).map(([type, label]) => (
          <Button
            key={type}
            type="button"
            variant={value === type ? "primary" : "outline"}
            aria-pressed={value === type}
            onClick={() => onChange(type)}
          >
            {label}
          </Button>
        ))}
      </div>
    </Field>
  );
}

/** "" means my own records; otherwise the person whose records this belongs to. */
function OwnerSelect({
  language,
  people,
  value,
  onChange,
}: {
  language: Language;
  people: Person[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={language === "my" ? "ဘယ်သူ့စာရင်းလဲ" : "Whose records"}>
      <SearchableSelect
        value={value}
        options={[
          { value: "", label: language === "my" ? "ကိုယ်ပိုင်" : "My own" },
          ...people.map((person) => ({
            value: person.id,
            label: language === "my" ? `${person.name} ရဲ့စာရင်း` : `${person.name}'s records`,
          })),
        ]}
        onChange={onChange}
        placeholder={language === "my" ? "ကိုယ်ပိုင်" : "My own"}
        searchLabel={t(language, "search")}
      />
      {value && (
        <span className="text-xs font-normal text-muted">
          {language === "my"
            ? "ငွေက ကိုယ့်အကောင့်ထဲ ဝင်/ထွက်ပေမယ့် သူ့စာရင်းအဖြစ် သီးသန့် မှတ်ထားမည်။"
            : "The money moves through your accounts but is kept in their records."}
        </span>
      )}
    </Field>
  );
}

export function AccountForm({
  language,
  initial,
  busy,
  onCancel,
  onSubmit,
}: {
  language: Language;
  initial?: Account;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (values: z.infer<typeof accountSchema>) => void;
}) {
  const form = useForm<z.input<typeof accountSchema>, unknown, z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: initial?.name ?? "",
      kind: initial?.kind ?? "kbz_bank",
      initial_balance: Number(initial?.initial_balance ?? 0),
      currency: "MMK",
      notes: initial?.notes ?? "",
    },
  });
  const [selectedKind, setSelectedKind] = useState<Account["kind"]>(
    initial?.kind ?? "kbz_bank",
  );
  const options = Object.entries(accountLabels[language]).map(([value, label]) => ({
    value,
    label,
  }));

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      className="grid gap-4"
    >
      <Field label={t(language, "accountName")} error={form.formState.errors.name?.message}>
        <Input {...form.register("name")} autoFocus maxLength={80} />
      </Field>
      <Field label={t(language, "accountType")} error={form.formState.errors.kind?.message}>
        <SearchableSelect
          value={selectedKind}
          options={options}
          onChange={(value) => {
            const kind = accountSchema.shape.kind.parse(value);
            setSelectedKind(kind);
            form.setValue("kind", kind, {
              shouldValidate: true,
            });
          }}
          placeholder={t(language, "accountType")}
          searchLabel={t(language, "search")}
        />
      </Field>
      <Field label={t(language, "initialBalance")} error={form.formState.errors.initial_balance?.message}>
        <Controller
          control={form.control}
          name="initial_balance"
          render={({ field }) => (
            <AmountInput
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref} emptyValue={0}
            />
          )}
        />
      </Field>
      <Field label={t(language, "note")}>
        <Textarea rows={3} {...form.register("notes")} />
      </Field>
      <FormActions language={language} busy={busy} onCancel={onCancel} />
    </form>
  );
}

export function PersonForm({
  language,
  busy,
  onCancel,
  onSubmit,
}: {
  language: Language;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (values: z.infer<typeof personSchema>) => void;
}) {
  const form = useForm<z.input<typeof personSchema>, unknown, z.infer<typeof personSchema>>({
    resolver: zodResolver(personSchema),
    defaultValues: { name: "", phone: "", notes: "" },
  });

  return (
    <form onSubmit={form.handleSubmit((values) => onSubmit(values))} className="grid gap-4">
      <Field label={t(language, "name")} error={form.formState.errors.name?.message}>
        <Input {...form.register("name")} autoFocus maxLength={100} />
      </Field>
      <Field label={t(language, "phone")} error={form.formState.errors.phone?.message}>
        <Input {...form.register("phone")} type="tel" maxLength={40} />
      </Field>
      <Field label={t(language, "note")}>
        <Textarea rows={3} {...form.register("notes")} />
      </Field>
      <FormActions language={language} busy={busy} onCancel={onCancel} />
    </form>
  );
}

export function LoanForm({
  language,
  direction,
  accounts,
  people,
  busy,
  onCancel,
  onSubmit,
}: {
  language: Language;
  direction: "lent" | "borrowed";
  accounts: Account[];
  people: Person[];
  busy: boolean;
  onCancel: () => void;
  onSubmit: (values: LoanFormValues) => void;
}) {
  const form = useForm<LoanFormValues>({
    resolver: zodResolver(loanFormSchema),
    defaultValues: {
      person_id: people[0]?.id ?? "",
      account_id: accounts.find((account) => account.is_active)?.id ?? "",
      is_opening_balance: false,
      amount: 0,
      occurred_at: localDateInput(),
      expected_date: "",
      notes: "",
    },
  });
  const [selectedPersonId, setSelectedPersonId] = useState(people[0]?.id ?? "");
  const [ownerId, setOwnerId] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState(
    accounts.find((account) => account.is_active)?.id ?? "",
  );
  const activeAccounts = accounts.filter((account) => account.is_active);
  const [moneyType, setMoneyType] = useState<MoneyType>(() =>
    moneyTypeForAccount(activeAccounts.find((account) => account.id === selectedAccountId)),
  );
  const isOpeningBalance = useWatch({
    control: form.control,
    name: "is_opening_balance",
  });
  const accountsForMoneyType = activeAccounts.filter(
    (account) => moneyTypeForAccount(account) === moneyType,
  );

  return (
    <form
      onSubmit={form.handleSubmit((values) =>
        onSubmit({
          ...values,
          money_type: moneyType,
          account_id: values.is_opening_balance ? undefined : values.account_id,
          for_person_id: ownerId || null,
        }),
      )}
      className="grid gap-4"
    >
      <Field label={t(language, "person")} error={form.formState.errors.person_id?.message}>
        <SearchableSelect
          value={selectedPersonId}
          options={people.map((person) => ({ value: person.id, label: person.name }))}
          onChange={(value) => {
            setSelectedPersonId(value);
            form.setValue("person_id", value, { shouldValidate: true });
          }}
          placeholder={t(language, "person")}
          searchLabel={t(language, "search")}
        />
      </Field>
      <label className="flex items-start gap-3 rounded-control bg-surface-subtle p-3 text-sm font-normal text-ink">
        <input
          type="checkbox"
          className="mt-1 size-4 accent-accent"
          {...form.register("is_opening_balance")}
        />
        <span>
          {language === "my"
            ? "အက်ပ်မသုံးမီကတည်းက ရှိပြီးသားအကြွေး"
            : "This debt already existed before using the app"}
          <span className="mt-1 block text-xs text-muted">
            {language === "my"
              ? "လက်ရှိအကောင့်လက်ကျန်ကို မပြောင်းလဲပါ။"
              : "Record it without changing your current account balance."}
          </span>
        </span>
      </label>
      <MoneyTypeSelector
        language={language}
        value={moneyType}
        onChange={(type) => {
          setMoneyType(type);
          const nextAccount = activeAccounts.find((account) => moneyTypeForAccount(account) === type);
          if (nextAccount) {
            setSelectedAccountId(nextAccount.id);
            form.setValue("account_id", nextAccount.id, { shouldValidate: true });
          } else {
            setSelectedAccountId("");
            form.setValue("account_id", "", { shouldValidate: true });
          }
        }}
      />
      {isOpeningBalance ? (
        <p className="-mt-2 text-xs text-muted">
          {language === "my"
            ? "ငွေအမျိုးအစားကိုသာ မှတ်ထားမည်။ အကောင့်လက်ကျန် မပြောင်းပါ။"
            : "Only the money type is recorded; no account balance changes."}
        </p>
      ) : (
        <Field
          label={direction === "lent" ? t(language, "fromAccount") : t(language, "toAccount")}
          error={form.formState.errors.account_id?.message}
        >
          <SearchableSelect
            value={selectedAccountId}
            options={accountsForMoneyType.map((account) => ({
              value: account.id,
              label: `${account.name} · ${formatKyat(account.current_balance, language)}`,
            }))}
            onChange={(value) => {
              setSelectedAccountId(value);
              form.setValue("account_id", value, { shouldValidate: true });
            }}
            placeholder={t(language, "allAccounts")}
            searchLabel={t(language, "search")}
          />
          {!accountsForMoneyType.length && (
            <span className="text-xs font-normal text-warning">
              {language === "my"
                ? moneyType === "cash" ? "ငွေသားအကောင့် မရှိသေးပါ။" : "E-money အကောင့် မရှိသေးပါ။"
                : moneyType === "cash" ? "No cash account yet." : "No e-money account yet."}
            </span>
          )}
        </Field>
      )}
      <OwnerSelect language={language} people={people} value={ownerId} onChange={setOwnerId} />
      <Field label={t(language, "amount")} error={form.formState.errors.amount?.message}>
        <Controller
          control={form.control}
          name="amount"
          render={({ field }) => (
            <AmountInput
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
            />
          )}
        />
      </Field>
      <Field label={t(language, "date")}>
        <Input type="date" {...form.register("occurred_at")} />
      </Field>
      <Field label={t(language, "dueDate")}>
        <Input type="date" {...form.register("expected_date")} />
      </Field>
      <Field label={t(language, "note")}>
        <Textarea rows={3} {...form.register("notes")} />
      </Field>
      <FormActions language={language} busy={busy} onCancel={onCancel} />
    </form>
  );
}

export function RepaymentForm({
  language,
  direction,
  loans,
  accounts,
  people,
  busy,
  onCancel,
  onSubmit,
}: {
  language: Language;
  direction: "lent" | "borrowed";
  loans: Loan[];
  accounts: Account[];
  people: Person[];
  busy: boolean;
  onCancel: () => void;
  onSubmit: (values: RepaymentFormValues) => void;
}) {
  const openLoans = loans.filter(
    (loan) => loan.direction === direction && Number(loan.outstanding) > 0,
  );
  const form = useForm<RepaymentFormValues>({
    resolver: zodResolver(repaymentFormSchema),
    defaultValues: {
      loan_id: openLoans[0]?.id ?? "",
      account_id: accounts.find((account) => account.is_active)?.id ?? "",
      amount: 0,
      paid_at: localDateInput(),
      notes: "",
    },
  });
  const [selectedLoanId, setSelectedLoanId] = useState(openLoans[0]?.id ?? "");
  // A repayment belongs to the same records as the loan it repays.
  const [ownerId, setOwnerId] = useState(openLoans[0]?.for_person_id ?? "");
  const [selectedAccountId, setSelectedAccountId] = useState(
    accounts.find((account) => account.is_active)?.id ?? "",
  );
  const activeAccounts = accounts.filter((account) => account.is_active);
  const [moneyType, setMoneyType] = useState<MoneyType>(() =>
    moneyTypeForAccount(activeAccounts.find((account) => account.id === selectedAccountId)),
  );
  const accountsForMoneyType = activeAccounts.filter(
    (account) => moneyTypeForAccount(account) === moneyType,
  );
  const selectedLoan = openLoans.find((loan) => loan.id === selectedLoanId);
  const personName = (personId: string) =>
    people.find((person) => person.id === personId)?.name ?? "";

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit({ ...values, for_person_id: ownerId || null }))}
      className="grid gap-4"
    >
      <Field label={t(language, "person")}>
        <SearchableSelect
          value={selectedLoanId}
          options={openLoans.map((loan) => ({
            value: loan.id,
            label: `${personName(loan.person_id)} · ${formatKyat(loan.principal, language)} · ${localDateInput(loan.borrowed_or_lent_at)} · ${t(language, "outstanding")}: ${formatKyat(loan.outstanding, language)}`,
          }))}
          onChange={(value) => {
            setSelectedLoanId(value);
            setOwnerId(openLoans.find((loan) => loan.id === value)?.for_person_id ?? "");
            form.setValue("loan_id", value, { shouldValidate: true });
          }}
          placeholder={t(language, "noData")}
          searchLabel={t(language, "search")}
        />
        {selectedLoan && (
          <span className="grid gap-1 text-xs font-normal text-muted">
            <span>{t(language, "date")}: {localDateInput(selectedLoan.borrowed_or_lent_at)}</span>
            <span>{t(language, "principal")}: {formatKyat(selectedLoan.principal, language)}</span>
            <span>{t(language, "repaid")}: {formatKyat(selectedLoan.repaid, language)}</span>
            <span>{t(language, "outstanding")}: {formatKyat(selectedLoan.outstanding, language)}</span>
          </span>
        )}
      </Field>
      <MoneyTypeSelector
        language={language}
        value={moneyType}
        onChange={(type) => {
          setMoneyType(type);
          const nextAccount = activeAccounts.find((account) => moneyTypeForAccount(account) === type);
          if (nextAccount) {
            setSelectedAccountId(nextAccount.id);
            form.setValue("account_id", nextAccount.id, { shouldValidate: true });
          } else {
            setSelectedAccountId("");
            form.setValue("account_id", "", { shouldValidate: true });
          }
        }}
      />
      <Field label={t(language, "account")} error={form.formState.errors.account_id?.message}>
        <SearchableSelect
          value={selectedAccountId}
          options={accountsForMoneyType.map((account) => ({
            value: account.id,
            label: `${account.name} · ${formatKyat(account.current_balance, language)}`,
          }))}
          onChange={(value) => {
            setSelectedAccountId(value);
            form.setValue("account_id", value, { shouldValidate: true });
          }}
          placeholder={t(language, "allAccounts")}
          searchLabel={t(language, "search")}
        />
        {!accountsForMoneyType.length && (
          <span className="text-xs font-normal text-warning">
            {language === "my"
              ? moneyType === "cash" ? "ငွေသားအကောင့် မရှိသေးပါ။" : "E-money အကောင့် မရှိသေးပါ။"
              : moneyType === "cash" ? "No cash account yet." : "No e-money account yet."}
          </span>
        )}
      </Field>
      <OwnerSelect language={language} people={people} value={ownerId} onChange={setOwnerId} />
      <Field label={t(language, "amount")} error={form.formState.errors.amount?.message}>
        <Controller
          control={form.control}
          name="amount"
          render={({ field }) => (
            <AmountInput
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
            />
          )}
        />
      </Field>
      <Field label={t(language, "date")}>
        <Input type="date" {...form.register("paid_at")} />
      </Field>
      <Field label={t(language, "note")}>
        <Textarea rows={3} {...form.register("notes")} />
      </Field>
      <FormActions language={language} busy={busy} onCancel={onCancel} />
    </form>
  );
}

const depositFormSchema = z.object({
  amount: z.number().finite().positive().max(MAX_AMOUNT),
  occurred_at: z.string().min(1),
  notes: z.string().trim().max(1000).optional(),
});

export type DepositFormValues = z.infer<typeof depositFormSchema> & OwnerValue & {
  kind: "income" | "expense";
  account_id?: string;
  new_account?: { kind: Account["kind"]; name: string };
};

const depositKindOrder: Account["kind"][] = [
  "physical_cash",
  "kbz_bank",
  "aya_bank",
  "cb_bank",
  "kbzpay",
  "wave_money",
  "custom",
];

export function DepositForm({
  language,
  mode,
  accounts,
  people,
  initialAccount,
  busy,
  onCancel,
  onSubmit,
}: {
  language: Language;
  /** in: add money (may create an account); out: take money out of an existing account. */
  mode: "in" | "out";
  accounts: Account[];
  people: Person[];
  initialAccount?: Account;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (values: DepositFormValues) => void;
}) {
  const form = useForm<z.infer<typeof depositFormSchema>>({
    resolver: zodResolver(depositFormSchema),
    defaultValues: { amount: 0, occurred_at: localDateInput(), notes: "" },
  });
  const activeAccounts = accounts.filter((account) => account.is_active);
  const kindOptions = mode === "in"
    ? depositKindOrder
    : depositKindOrder.filter((value) => activeAccounts.some((account) => account.kind === value));
  const [kind, setKind] = useState<Account["kind"]>(
    initialAccount?.kind ?? activeAccounts[0]?.kind ?? "physical_cash",
  );
  const [ownerId, setOwnerId] = useState("");
  const accountsOfKind = activeAccounts.filter((account) => account.kind === kind);
  const [accountId, setAccountId] = useState(
    initialAccount?.id ?? accountsOfKind[0]?.id ?? "",
  );
  // New accounts default to the owner's name from the first account, since every account is "my money".
  const defaultName = (accountKind: Account["kind"]) =>
    accounts[0]?.name ?? accountLabels[language][accountKind] ?? "";
  const [newName, setNewName] = useState(() => defaultName(kind));
  const [nameError, setNameError] = useState("");
  const selectedAccount = accountsOfKind.find((account) => account.id === accountId);
  const createsAccount = mode === "in" && accountsOfKind.length === 0;
  const txKind = mode === "in" ? "income" : "expense";

  return (
    <form
      onSubmit={form.handleSubmit((values) => {
        if (createsAccount) {
          const name = newName.trim();
          if (!name) {
            setNameError(language === "my" ? "အကောင့်အမည် ထည့်ပါ။" : "Enter an account name.");
            return;
          }
          onSubmit({
            ...values,
            kind: txKind,
            new_account: { kind, name: name.slice(0, 80) },
            for_person_id: ownerId || null,
          });
        } else if (selectedAccount) {
          onSubmit({
            ...values,
            kind: txKind,
            account_id: selectedAccount.id,
            for_person_id: ownerId || null,
          });
        }
      })}
      className="grid gap-4"
    >
      <Field label={language === "my" ? "ငွေအမျိုးအစား" : "Money type"}>
        <SearchableSelect
          value={kind}
          options={kindOptions.map((value) => ({
            value,
            label: accountLabels[language][value] ?? value,
          }))}
          onChange={(value) => {
            const nextKind = accountSchema.shape.kind.parse(value);
            setKind(nextKind);
            setAccountId(activeAccounts.find((account) => account.kind === nextKind)?.id ?? "");
            setNewName(defaultName(nextKind));
            setNameError("");
          }}
          placeholder={language === "my" ? "ငွေအမျိုးအစား" : "Money type"}
          searchLabel={t(language, "search")}
        />
      </Field>
      {createsAccount ? (
        <Field label={t(language, "accountName")} error={nameError}>
          <Input
            value={newName}
            maxLength={80}
            onChange={(event) => {
              setNewName(event.target.value);
              setNameError("");
            }}
          />
          <span className="text-xs font-normal text-muted">
            {language === "my"
              ? "ဒီအမျိုးအစား အကောင့် မရှိသေးလို့ အကောင့်အသစ် ဖွင့်ပြီး ငွေထည့်ပေးပါမည်။"
              : "You have no account of this type yet, so a new one will be created with this money."}
          </span>
        </Field>
      ) : (
        <Field label={t(language, "account")}>
          <SearchableSelect
            value={accountId}
            options={accountsOfKind.map((account) => ({
              value: account.id,
              label: `${account.name} · ${formatKyat(account.current_balance, language)}`,
            }))}
            onChange={setAccountId}
            placeholder={t(language, "account")}
            searchLabel={t(language, "search")}
          />
        </Field>
      )}
      <OwnerSelect language={language} people={people} value={ownerId} onChange={setOwnerId} />
      <Field
        label={mode === "in"
          ? language === "my" ? "ထည့်မည့်ပမာဏ" : "Amount to add"
          : language === "my" ? "ထုတ်မည့်ပမာဏ" : "Amount to take out"}
        error={form.formState.errors.amount?.message}
      >
        <Controller
          control={form.control}
          name="amount"
          render={({ field }) => (
            <AmountInput
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
            />
          )}
        />
      </Field>
      <Field label={t(language, "date")}>
        <Input type="date" {...form.register("occurred_at")} />
      </Field>
      <Field label={t(language, "note")}>
        <Textarea rows={3} {...form.register("notes")} />
      </Field>
      <FormActions language={language} busy={busy} onCancel={onCancel} />
    </form>
  );
}

const editEntryFormSchema = z.object({
  amount: z.number().finite().positive().max(MAX_AMOUNT),
  occurred_at: z.string().min(1),
  expected_date: z.string().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export type EditEntryValues = z.infer<typeof editEntryFormSchema> & OwnerValue & {
  account_id?: string | null;
  money_type?: MoneyType | null;
};

export function EditEntryForm({
  language,
  entry,
  title,
  accounts,
  people,
  busy,
  onCancel,
  onSubmit,
}: {
  language: Language;
  entry: HistoryEntry;
  title: string;
  accounts: Account[];
  people: Person[];
  busy: boolean;
  onCancel: () => void;
  onSubmit: (values: EditEntryValues) => void;
}) {
  const { transaction, loan } = entry;
  const form = useForm<z.infer<typeof editEntryFormSchema>>({
    resolver: zodResolver(editEntryFormSchema),
    defaultValues: {
      amount: Number(transaction.amount),
      occurred_at: localDateInput(transaction.occurred_at),
      expected_date: loan?.expected_date ?? "",
      notes: transaction.notes ?? "",
    },
  });
  // Keep the current account selectable even if it has since been archived.
  const selectableAccounts = accounts.filter(
    (account) => account.is_active || account.id === transaction.account_id,
  );
  const currentAccount = selectableAccounts.find((account) => account.id === transaction.account_id);
  const [accountId, setAccountId] = useState(transaction.account_id ?? "");
  const [moneyType, setMoneyType] = useState<MoneyType>(
    currentAccount ? moneyTypeForAccount(currentAccount) : loan?.money_type ?? "cash",
  );
  const [accountError, setAccountError] = useState("");
  const [ownerId, setOwnerId] = useState(transaction.for_person_id ?? "");
  const hasAccount = transaction.account_id !== null;
  const accountsForMoneyType = selectableAccounts.filter(
    (account) => moneyTypeForAccount(account) === moneyType,
  );
  const repaid = entry.isLoanPrincipal && loan ? Number(loan.repaid) : 0;

  return (
    <form
      onSubmit={form.handleSubmit((values) => {
        if (hasAccount && !accountsForMoneyType.some((account) => account.id === accountId)) {
          setAccountError(language === "my" ? "အကောင့်တစ်ခု ရွေးပါ။" : "Choose an account.");
          return;
        }
        onSubmit({
          ...values,
          account_id: hasAccount ? accountId : null,
          money_type: entry.isOpeningDebt ? moneyType : null,
          for_person_id: ownerId || null,
        });
      })}
      className="grid gap-4"
    >
      <p className="rounded-control bg-surface-subtle p-3 text-sm text-ink">{title}</p>
      <MoneyTypeSelector
        language={language}
        value={moneyType}
        onChange={(type) => {
          setMoneyType(type);
          setAccountError("");
          setAccountId(
            selectableAccounts.find((account) => moneyTypeForAccount(account) === type)?.id ?? "",
          );
        }}
      />
      {hasAccount && (
        <Field label={t(language, "account")} error={accountError}>
          <SearchableSelect
            value={accountId}
            options={accountsForMoneyType.map((account) => ({
              value: account.id,
              label: `${account.name} · ${accountLabels[language][account.kind] ?? ""}`,
            }))}
            onChange={(value) => {
              setAccountId(value);
              setAccountError("");
            }}
            placeholder={t(language, "account")}
            searchLabel={t(language, "search")}
          />
        </Field>
      )}
      <OwnerSelect language={language} people={people} value={ownerId} onChange={setOwnerId} />
      <Field label={t(language, "amount")} error={form.formState.errors.amount?.message}>
        <Controller
          control={form.control}
          name="amount"
          render={({ field }) => (
            <AmountInput
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
            />
          )}
        />
        {repaid > 0 && (
          <span className="text-xs font-normal text-muted">
            {language === "my"
              ? `ပြန်ဆပ်ပြီးသား ${formatKyat(repaid, language)} ထက် မနည်းရပါ။`
              : `Cannot be less than the ${formatKyat(repaid, language)} already repaid.`}
          </span>
        )}
      </Field>
      <Field label={t(language, "date")}>
        <Input type="date" {...form.register("occurred_at")} />
      </Field>
      {entry.isLoanPrincipal && (
        <Field label={t(language, "dueDate")}>
          <Input type="date" {...form.register("expected_date")} />
        </Field>
      )}
      <Field label={t(language, "note")}>
        <Textarea rows={3} {...form.register("notes")} />
      </Field>
      <FormActions language={language} busy={busy} onCancel={onCancel} />
    </form>
  );
}
