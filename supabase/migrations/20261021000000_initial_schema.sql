create extension if not exists pgcrypto;

create type public.account_kind as enum (
  'kbz_bank',
  'cb_bank',
  'aya_bank',
  'wave_money',
  'kbzpay',
  'physical_cash',
  'custom'
);

create type public.transaction_kind as enum (
  'income',
  'expense',
  'transfer',
  'lending',
  'lend_repayment',
  'borrowing',
  'borrow_repayment'
);

create type public.loan_direction as enum ('lent', 'borrowed');

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  kind public.account_kind not null,
  initial_balance numeric(18, 2) not null default 0
    check (initial_balance between 0 and 90000000000000),
  currency char(3) not null default 'MMK' check (currency = 'MMK'),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 100),
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  kind public.transaction_kind not null,
  account_id uuid not null references public.accounts(id),
  to_account_id uuid references public.accounts(id),
  person_id uuid references public.people(id),
  amount numeric(18, 2) not null check (amount between 0.01 and 90000000000000),
  category text not null check (length(trim(category)) between 1 and 80),
  description text not null check (length(trim(description)) between 1 and 240),
  notes text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transfer_has_destination check (
    (kind = 'transfer' and to_account_id is not null and to_account_id <> account_id)
    or (kind <> 'transfer' and to_account_id is null)
  ),
  constraint loan_event_has_person check (
    (kind in ('lending', 'lend_repayment', 'borrowing', 'borrow_repayment') and person_id is not null)
    or (kind not in ('lending', 'lend_repayment', 'borrowing', 'borrow_repayment'))
  )
);

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id),
  direction public.loan_direction not null,
  principal_transaction_id uuid not null unique references public.transactions(id),
  principal numeric(18, 2) not null check (principal between 0.01 and 90000000000000),
  borrowed_or_lent_at timestamptz not null,
  expected_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table public.loan_repayments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id),
  transaction_id uuid not null unique references public.transactions(id),
  amount numeric(18, 2) not null check (amount between 0.01 and 90000000000000),
  paid_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  old_record jsonb,
  new_record jsonb,
  changed_at timestamptz not null default now()
);

create index transactions_occurred_at_idx on public.transactions (occurred_at desc);
create index transactions_account_id_idx on public.transactions (account_id);
create index transactions_person_id_idx on public.transactions (person_id);
create index loans_person_direction_idx on public.loans (person_id, direction);
create index loans_expected_date_idx on public.loans (expected_date);

create view public.account_balances
with (security_invoker = true) as
select
  a.id,
  a.name,
  a.kind,
  a.initial_balance,
  a.currency,
  a.notes,
  a.is_active,
  a.created_at,
  a.updated_at,
  a.initial_balance + coalesce(sum(
    case
      when t.account_id = a.id then
        case t.kind
          when 'income' then t.amount
          when 'expense' then -t.amount
          when 'lending' then -t.amount
          when 'lend_repayment' then t.amount
          when 'borrowing' then t.amount
          when 'borrow_repayment' then -t.amount
          else -t.amount
        end
      when t.to_account_id = a.id and t.kind = 'transfer' then t.amount
      else 0
    end
  ), 0) as current_balance
from public.accounts a
left join public.transactions t
  on t.account_id = a.id or (t.to_account_id = a.id and t.kind = 'transfer')
group by a.id;

create view public.loan_balances
with (security_invoker = true) as
select
  l.id,
  l.person_id,
  l.direction,
  l.principal_transaction_id,
  l.principal,
  l.borrowed_or_lent_at,
  l.expected_date,
  l.notes,
  l.created_at,
  coalesce(sum(r.amount), 0) as repaid,
  l.principal - coalesce(sum(r.amount), 0) as outstanding
from public.loans l
left join public.loan_repayments r on r.loan_id = l.id
group by l.id;

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (table_name, record_id, operation, new_record)
    values (tg_table_name, (to_jsonb(new) ->> 'id')::uuid, tg_op, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_log (table_name, record_id, operation, old_record, new_record)
    values (
      tg_table_name,
      (to_jsonb(new) ->> 'id')::uuid,
      tg_op,
      to_jsonb(old),
      to_jsonb(new)
    );
    return new;
  else
    insert into public.audit_log (table_name, record_id, operation, old_record)
    values (tg_table_name, (to_jsonb(old) ->> 'id')::uuid, tg_op, to_jsonb(old));
    return old;
  end if;
end;
$$;

create trigger accounts_audit
after insert or update or delete on public.accounts
for each row execute function public.write_audit_log();

create trigger people_audit
after insert or update or delete on public.people
for each row execute function public.write_audit_log();

create trigger transactions_audit
after insert or update or delete on public.transactions
for each row execute function public.write_audit_log();

create or replace function public.record_transaction(
  p_request_key uuid,
  p_kind public.transaction_kind,
  p_account_id uuid,
  p_amount numeric,
  p_occurred_at timestamptz,
  p_category text,
  p_description text,
  p_notes text default null,
  p_to_account_id uuid default null,
  p_person_id uuid default null,
  p_expected_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  transaction_id uuid;
  loan_direction_value public.loan_direction;
begin
  select id into transaction_id
  from public.transactions
  where request_key = p_request_key;
  if transaction_id is not null then
    return transaction_id;
  end if;

  if p_amount < 0.01 or p_amount > 90000000000000 then
    raise exception 'Amount must be greater than zero and within supported limits';
  end if;
  if length(trim(p_category)) = 0 or length(trim(p_description)) = 0 then
    raise exception 'Category and description are required';
  end if;

  perform 1 from public.accounts
  where id = p_account_id and is_active
  for update;
  if not found then
    raise exception 'Selected account is unavailable';
  end if;

  if p_kind = 'transfer' then
    if p_to_account_id is null or p_to_account_id = p_account_id then
      raise exception 'A transfer requires two different accounts';
    end if;
    perform 1 from public.accounts
    where id = p_to_account_id and is_active
    for update;
    if not found then
      raise exception 'Destination account is unavailable';
    end if;
  elsif p_to_account_id is not null then
    raise exception 'Only transfers may specify a destination account';
  end if;

  if p_kind in ('lending', 'borrowing') and p_person_id is null then
    raise exception 'Loan records require a person';
  end if;
  if p_kind not in ('lending', 'borrowing') and p_person_id is not null then
    raise exception 'This transaction type cannot start a loan';
  end if;

  insert into public.transactions (
    request_key, kind, account_id, to_account_id, person_id, amount,
    category, description, notes, occurred_at
  )
  values (
    p_request_key, p_kind, p_account_id, p_to_account_id, p_person_id,
    p_amount, trim(p_category), trim(p_description), p_notes, p_occurred_at
  )
  returning id into transaction_id;

  if p_kind in ('lending', 'borrowing') then
    loan_direction_value := case when p_kind = 'lending' then 'lent'::public.loan_direction else 'borrowed'::public.loan_direction end;
    insert into public.loans (
      person_id, direction, principal_transaction_id, principal,
      borrowed_or_lent_at, expected_date, notes
    )
    values (
      p_person_id, loan_direction_value, transaction_id, p_amount,
      p_occurred_at, p_expected_date, p_notes
    );
  end if;

  return transaction_id;
end;
$$;

create or replace function public.record_loan_repayment(
  p_request_key uuid,
  p_loan_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_paid_at timestamptz,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  loan_row public.loans%rowtype;
  loan_outstanding numeric(18, 2);
  repayment_kind public.transaction_kind;
  transaction_id uuid;
begin
  select id into transaction_id
  from public.transactions
  where request_key = p_request_key;
  if transaction_id is not null then
    return transaction_id;
  end if;

  select * into loan_row from public.loans where id = p_loan_id for update;
  if not found then
    raise exception 'Loan record was not found';
  end if;

  select loan_row.principal - coalesce(sum(amount), 0)
  into loan_outstanding
  from public.loan_repayments
  where loan_id = p_loan_id;

  if p_amount <= 0 or p_amount > loan_outstanding then
    raise exception 'Repayment must be positive and cannot exceed the outstanding balance';
  end if;

  perform 1 from public.accounts
  where id = p_account_id and is_active
  for update;
  if not found then
    raise exception 'Selected account is unavailable';
  end if;

  repayment_kind := case
    when loan_row.direction = 'lent' then 'lend_repayment'::public.transaction_kind
    else 'borrow_repayment'::public.transaction_kind
  end;

  insert into public.transactions (
    request_key, kind, account_id, person_id, amount, category,
    description, notes, occurred_at
  )
  values (
    p_request_key, repayment_kind, p_account_id, loan_row.person_id,
    p_amount, 'Loan repayment',
    case when loan_row.direction = 'lent' then 'Repayment received' else 'Repayment made' end,
    p_notes, p_paid_at
  )
  returning id into transaction_id;

  insert into public.loan_repayments (loan_id, transaction_id, amount, paid_at)
  values (p_loan_id, transaction_id, p_amount, p_paid_at);

  return transaction_id;
end;
$$;

create or replace function public.revise_transaction(
  p_transaction_id uuid,
  p_kind public.transaction_kind,
  p_account_id uuid,
  p_amount numeric,
  p_occurred_at timestamptz,
  p_category text,
  p_description text,
  p_notes text default null,
  p_to_account_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  transaction_row public.transactions%rowtype;
begin
  select * into transaction_row
  from public.transactions
  where id = p_transaction_id
  for update;
  if not found then
    raise exception 'Transaction was not found';
  end if;
  if transaction_row.kind in ('lending', 'lend_repayment', 'borrowing', 'borrow_repayment') then
    raise exception 'Loan transactions must be changed through the loan record';
  end if;
  if p_amount is null or p_amount < 0.01 or p_amount > 90000000000000 then
    raise exception 'Amount must be positive and within supported limits';
  end if;
  if length(trim(p_category)) = 0 or length(trim(p_description)) = 0 then
    raise exception 'Category and description are required';
  end if;

  perform 1 from public.accounts
  where id = p_account_id and is_active
  for update;
  if not found then
    raise exception 'Selected account is unavailable';
  end if;
  if p_kind = 'transfer' then
    if p_to_account_id is null or p_to_account_id = p_account_id then
      raise exception 'A transfer requires two different accounts';
    end if;
    perform 1 from public.accounts
    where id = p_to_account_id and is_active
    for update;
    if not found then
      raise exception 'Destination account is unavailable';
    end if;
  elsif p_to_account_id is not null then
    raise exception 'Only transfers may specify a destination account';
  end if;
  update public.transactions
  set kind = p_kind,
      account_id = p_account_id,
      to_account_id = p_to_account_id,
      amount = p_amount,
      occurred_at = p_occurred_at,
      category = trim(p_category),
      description = trim(p_description),
      notes = p_notes,
      updated_at = now()
  where id = p_transaction_id;
end;
$$;

create or replace function public.remove_transaction(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.loans where principal_transaction_id = p_transaction_id)
    or exists (select 1 from public.loan_repayments where transaction_id = p_transaction_id) then
    raise exception 'Loan transactions are part of permanent loan history';
  end if;
  delete from public.transactions where id = p_transaction_id;
  if not found then
    raise exception 'Transaction was not found';
  end if;
end;
$$;

revoke all on public.accounts, public.people, public.transactions, public.loans,
  public.loan_repayments, public.audit_log from anon, authenticated;
revoke all on public.account_balances, public.loan_balances from anon, authenticated;
grant all on public.accounts, public.people, public.transactions, public.loans,
  public.loan_repayments, public.audit_log to service_role;
grant select on public.account_balances, public.loan_balances to service_role;
revoke execute on function public.record_transaction(uuid, public.transaction_kind, uuid, numeric, timestamptz, text, text, text, uuid, uuid, date) from public, anon, authenticated;
revoke execute on function public.record_loan_repayment(uuid, uuid, uuid, numeric, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.revise_transaction(uuid, public.transaction_kind, uuid, numeric, timestamptz, text, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.remove_transaction(uuid) from public, anon, authenticated;
revoke execute on function public.write_audit_log() from public, anon, authenticated;
grant execute on function public.record_transaction(uuid, public.transaction_kind, uuid, numeric, timestamptz, text, text, text, uuid, uuid, date) to service_role;
grant execute on function public.record_loan_repayment(uuid, uuid, uuid, numeric, timestamptz, text) to service_role;
grant execute on function public.revise_transaction(uuid, public.transaction_kind, uuid, numeric, timestamptz, text, text, text, uuid) to service_role;
grant execute on function public.remove_transaction(uuid) to service_role;

alter table public.accounts enable row level security;
alter table public.people enable row level security;
alter table public.transactions enable row level security;
alter table public.loans enable row level security;
alter table public.loan_repayments enable row level security;
alter table public.audit_log enable row level security;
