import { z } from "zod";

export const MAX_AMOUNT = 90_000_000_000_000;

const amountSchema = z
  .number()
  .finite()
  .positive()
  .max(MAX_AMOUNT)
  .refine((value) => (value.toString().split(".")[1]?.length ?? 0) <= 2, {
    message: "Amount can have no more than two decimal places.",
  });

export const accountSchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum([
    "kbz_bank",
    "cb_bank",
    "aya_bank",
    "wave_money",
    "kbzpay",
    "physical_cash",
    "custom",
  ]),
  initial_balance: z.coerce.number().finite().min(0).max(MAX_AMOUNT),
  currency: z.literal("MMK").default("MMK"),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const personSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(40).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const transactionSchema = z.object({
  request_key: z.string().uuid(),
  kind: z.enum(["income", "expense", "transfer"]),
  account_id: z.string().uuid(),
  to_account_id: z.string().uuid().nullable().optional(),
  amount: amountSchema,
  occurred_at: z.string().datetime(),
  category: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(240),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const loanSchema = z.object({
  request_key: z.string().uuid(),
  direction: z.enum(["lent", "borrowed"]),
  person_id: z.string().uuid(),
  account_id: z.string().uuid().optional(),
  is_opening_balance: z.boolean().default(false),
  money_type: z.enum(["cash", "e_money"]).optional(),
  for_person_id: z.string().uuid().nullable().optional(),
  amount: amountSchema,
  occurred_at: z.string().datetime(),
  // An empty date input means "no due date".
  expected_date: z.preprocess(
    (value) => (value === "" ? null : value),
    z.string().date().nullable().optional(),
  ),
  notes: z.string().trim().max(1000).nullable().optional(),
}).refine((value) => value.is_opening_balance || Boolean(value.account_id), {
  path: ["account_id"],
  message: "An account is required for a new loan.",
});

export const repaymentSchema = z.object({
  request_key: z.string().uuid(),
  for_person_id: z.string().uuid().nullable().optional(),
  account_id: z.string().uuid(),
  amount: amountSchema,
  paid_at: z.string().datetime(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const depositSchema = z.object({
  request_key: z.string().uuid(),
  /** income adds money to an account; expense takes money out. */
  kind: z.enum(["income", "expense"]).default("income"),
  for_person_id: z.string().uuid().nullable().optional(),
  account_id: z.string().uuid().optional(),
  new_account: accountSchema.pick({ name: true, kind: true }).optional(),
  amount: amountSchema,
  occurred_at: z.string().datetime(),
  notes: z.string().trim().max(1000).nullable().optional(),
}).refine((value) => Boolean(value.account_id) !== Boolean(value.new_account), {
  path: ["account_id"],
  message: "Choose an existing account or a new account, not both.",
}).refine((value) => value.kind === "income" || !value.new_account, {
  path: ["new_account"],
  message: "Money can only be taken out of an existing account.",
});

export const historyEditSchema = z.object({
  amount: amountSchema,
  occurred_at: z.string().datetime(),
  account_id: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  expected_date: z.preprocess(
    (value) => (value === "" ? null : value),
    z.string().date().nullable().optional(),
  ),
  money_type: z.enum(["cash", "e_money"]).nullable().optional(),
  for_person_id: z.string().uuid().nullable().optional(),
});

export const transactionEditSchema = transactionSchema.omit({
  request_key: true,
});

export type AccountInput = z.infer<typeof accountSchema>;
export type PersonInput = z.infer<typeof personSchema>;
export type TransactionInput = z.infer<typeof transactionSchema>;
export type LoanInput = z.infer<typeof loanSchema>;
export type RepaymentInput = z.infer<typeof repaymentSchema>;
export type DepositInput = z.infer<typeof depositSchema>;
export type HistoryEditInput = z.infer<typeof historyEditSchema>;

export const signInSchema = z.object({
  password: z.string().min(1).max(200),
});
