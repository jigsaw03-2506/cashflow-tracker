alter table public.transactions
  alter column account_id drop not null;

create or replace function public.record_opening_loan(
  p_request_key uuid,
  p_direction public.loan_direction,
  p_person_id uuid,
  p_amount numeric,
  p_occurred_at timestamptz,
  p_expected_date date default null,
  p_notes text default null
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
    borrowed_or_lent_at, expected_date, notes
  )
  values (
    p_person_id, p_direction, transaction_id, p_amount,
    p_occurred_at, p_expected_date, p_notes
  );

  return transaction_id;
end;
$$;

revoke execute on function public.record_opening_loan(uuid, public.loan_direction, uuid, numeric, timestamptz, date, text) from public, anon, authenticated;
grant execute on function public.record_opening_loan(uuid, public.loan_direction, uuid, numeric, timestamptz, date, text) to service_role;
