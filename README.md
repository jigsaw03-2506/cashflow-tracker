# CashFlow / ငွေစာရင်း

A Myanmar-first, single-user account-balance and debt tracker built with Next.js, TypeScript, Tailwind CSS, Supabase/PostgreSQL, React Hook Form, and Zod.

The app is intentionally focused on three things: your current balances across separate accounts, people who owe you, and people you owe. It records new loans and repayments, including partial repayments, and lets you add money later with **Add money** (at the top of the page or on an account card): choose the money type (physical cash, KBZ, AYA, CB, KPay (KBZPay), Wave, or custom) and the account; if you have no account of that type yet, one is created. Each top-up is saved as its own record. The **History** list shows every top-up, loan, and repayment; each can be edited or deleted, and deleting a loan also deletes its repayments. **Take money out** records spending from an account. Every entry has a **Whose records** choice (my own, or a person such as Dad): the money still moves through your accounts, but the History list can show that person's records on their own, with money in, money out, how much of their money you hold, and what is still owed to them. Repayments follow the records of the loan they repay. The top navigation has three pages:

- **Home** — balances, debts, money in/out, and the editable history.
- **People** (`/people`) — every person with what they owe you, what you owe them, and the net. Tap a name (`/people/[id]`) for every loan and repayment with them and anything kept in their records.
- **Spending** (`/spending`) — money taken out within a date range (this month by default; last month, this year, or any from/to dates), totalled as your own spending and spending for each person such as Dad.

It does not provide transfers, reports, transaction search, or CSV tools.

## Security and sign-in

There is **no authentication**: no login, signup, user accounts, or password flow. The Supabase service-role key is only read by server-side route handlers, never bundled into browser code. Row-level security is enabled and direct `anon`/`authenticated` table access is revoked; financial writes go through validated server routes and atomic PostgreSQL functions.

The development and production scripts bind to `127.0.0.1` so the application is intended for the trusted computer running it. Do not expose it directly to the public internet. If remote access is required, place it behind a private VPN or a network-restricted reverse proxy and firewall; there is intentionally no application sign-in. Same-origin checks on write routes are an additional CSRF defense, not a substitute for network isolation.

Do not add bank passwords, PINs, or OTPs.

## Run locally

1. Create a Supabase project with PostgreSQL.
2. In the Supabase SQL Editor, run the migration files in order:
   - `supabase/migrations/20261021000000_initial_schema.sql`
   - `supabase/migrations/20261021000100_backup_and_batch.sql`
   - `supabase/migrations/20261021000200_opening_debts.sql`
   - `supabase/migrations/20261021000300_opening_debt_money_type.sql`
   - `supabase/migrations/20261021000400_edit_delete_history.sql`
   - `supabase/migrations/20261021000500_records_for_person.sql`
3. Copy `.env.example` to `.env.local`. In the Supabase project settings, copy the project URL and **service-role** key into the two server-only variables. Do not prefix these variables with `NEXT_PUBLIC_`, commit `.env.local`, or share the key.
4. Install dependencies and start the local app:

   ```bash
   npm install
   npm run dev
   ```

5. Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The debt tracker opens directly; there is no sign-in step.

Add each account with the balance it has now, then add people and record debts that already existed using the “already existed” option. Those opening debts do not change account balances. New lending and borrowing, and later repayments, update the selected account automatically.

For every person, the debt list shows each original loan, the remaining balance, the amount repaid, and every repayment date and amount. Fully repaid loans remain visible as history.

The balance summary separates physical cash accounts from e-money accounts (banks and wallets). When recording a new loan or repayment, select **E-money** or **Cash** first, then choose the specific account. Accounts marked as physical cash are grouped under Cash; bank, wallet, and custom account types are grouped under E-money.

The development command binds to `127.0.0.1`, so it is available only on this computer. Next.js may print a “Network” URL as a convenience; with this binding it is still a loopback address, not a public or LAN endpoint. If port 3000 is already in use, check for an existing `npm run dev` terminal and reuse it or stop that specific process before starting another; Next.js may otherwise try port 3001.

## Database and ledger model

- `accounts.initial_balance` is the balance you enter when setting up each account. The `account_balances` view derives current balances from subsequent lending, borrowing, and repayment activity.
- Existing debts are recorded against a transaction without an account, so they establish receivables/payables without changing the current balance you entered.
- New lending or borrowing writes the account transaction and loan record atomically. Repayments are separate, append-only transactions and loan-repayment rows. Row locks and amount checks prevent overpayment and concurrent duplicate application.
- Account and person edits are recorded in `audit_log`. Loan principal and repayment history is preserved rather than overwritten.
- Tables have database constraints and RLS enabled. Only the server-side Supabase client uses the service-role key; no database write key is sent to the browser.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Calculation tests cover MMK account balances, lending, borrowing, and partial repayments.
# cashflow-tracker
