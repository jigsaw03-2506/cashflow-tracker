-- Debts that existed before using the app have no account, but can still record
-- whether the money was cash or e-money.
alter table public.loans
  add column if not exists money_type text
  check (money_type is null or money_type in ('cash', 'e_money'));

create or replace view public.loan_balances
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
  l.principal - coalesce(sum(r.amount), 0) as outstanding,
  l.money_type
from public.loans l
left join public.loan_repayments r on r.loan_id = l.id
group by l.id;

drop function if exists public.record_opening_loan(uuid, public.loan_direction, uuid, numeric, timestamptz, date, text);

create or replace function public.record_opening_loan(
  p_request_key uuid,
  p_direction public.loan_direction,
  p_person_id uuid,
  p_amount numeric,
  p_occurred_at timestamptz,
  p_expected_date date default null,
  p_notes text default null,
  p_money_type text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  transaction_id uuid;
begin
  select id into transaction_id
  from public.transactions
  where request_key = p_request_key;
  if transaction_id is not null then
    return transaction_id;
  end if;

  if p_amount is null or p_amount < 0.01 or p_amount > 90000000000000 then
    raise exception 'Amount must be greater than zero and within supported limits';
  end if;
  if not exists (select 1 from public.people where id = p_person_id) then
    raise exception 'Person was not found';
  end if;
  if p_money_type is not null and p_money_type not in ('cash', 'e_money') then
    raise exception 'Money type must be cash or e_money';
  end if;

  insert into public.transactions (
    request_key, kind, account_id, person_id, amount, category,
    description, notes, occurred_at
  )
  values (
    p_request_key,
    case when p_direction = 'lent' then 'lending'::public.transaction_kind else 'borrowing'::public.transaction_kind end,
    null,
    p_person_id,
    p_amount,
    'Opening debt',
    case when p_direction = 'lent' then 'Existing money owed to me' else 'Existing money I owe' end,
    p_notes,
    p_occurred_at
  )
  returning id into transaction_id;

  insert into public.loans (
    person_id, direction, principal_transaction_id, principal,
    borrowed_or_lent_at, expected_date, notes, money_type
  )
  values (
    p_person_id, p_direction, transaction_id, p_amount,
    p_occurred_at, p_expected_date, p_notes, p_money_type
  );

  return transaction_id;
end;
$$;

revoke all on public.loan_balances from anon, authenticated;
grant select on public.loan_balances to service_role;
revoke execute on function public.record_opening_loan(uuid, public.loan_direction, uuid, numeric, timestamptz, date, text, text) from public, anon, authenticated;
grant execute on function public.record_opening_loan(uuid, public.loan_direction, uuid, numeric, timestamptz, date, text, text) to service_role;
