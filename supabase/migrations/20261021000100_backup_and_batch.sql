create or replace function public.record_transaction_batch(p_records jsonb)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  transaction_ids uuid[] := array[]::uuid[];
begin
  if p_records is null
    or jsonb_typeof(p_records) is distinct from 'array'
    or jsonb_array_length(p_records) < 1
    or jsonb_array_length(p_records) > 500 then
    raise exception 'A CSV import must contain between 1 and 500 transaction rows';
  end if;

  for item in select value from jsonb_array_elements(p_records)
  loop
    transaction_ids := array_append(
      transaction_ids,
      public.record_transaction(
        (item ->> 'request_key')::uuid,
        (item ->> 'kind')::public.transaction_kind,
        (item ->> 'account_id')::uuid,
        (item ->> 'amount')::numeric,
        (item ->> 'occurred_at')::timestamptz,
        item ->> 'category',
        item ->> 'description',
        item ->> 'notes',
        nullif(item ->> 'to_account_id', '')::uuid,
        null,
        null
      )
    );
  end loop;

  return transaction_ids;
end;
$$;

create or replace function public.restore_backup(p_backup jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_backup is null
    or p_backup ->> 'version' is distinct from '1'
    or jsonb_typeof(p_backup -> 'accounts') is distinct from 'array'
    or jsonb_typeof(p_backup -> 'people') is distinct from 'array'
    or jsonb_typeof(p_backup -> 'transactions') is distinct from 'array'
    or jsonb_typeof(p_backup -> 'loans') is distinct from 'array'
    or jsonb_typeof(p_backup -> 'loan_repayments') is distinct from 'array'
    or jsonb_typeof(p_backup -> 'audit_log') is distinct from 'array' then
    raise exception 'Backup file is not a supported CashFlow backup';
  end if;

  if jsonb_array_length(p_backup -> 'accounts') > 1000
    or jsonb_array_length(p_backup -> 'people') > 10000
    or jsonb_array_length(p_backup -> 'transactions') > 100000
    or jsonb_array_length(p_backup -> 'loans') > 100000
    or jsonb_array_length(p_backup -> 'loan_repayments') > 100000
    or jsonb_array_length(p_backup -> 'audit_log') > 200000 then
    raise exception 'Backup exceeds the supported record limits';
  end if;

  delete from public.loan_repayments;
  delete from public.loans;
  delete from public.transactions;
  delete from public.accounts;
  delete from public.people;
  delete from public.audit_log;

  insert into public.people (id, name, phone, notes, created_at, updated_at)
  select id, name, phone, notes, created_at, updated_at
  from jsonb_populate_recordset(null::public.people, p_backup -> 'people');

  insert into public.accounts (
    id, name, kind, initial_balance, currency, notes, is_active, created_at, updated_at
  )
  select id, name, kind, initial_balance, currency, notes, is_active, created_at, updated_at
  from jsonb_populate_recordset(null::public.accounts, p_backup -> 'accounts');

  insert into public.transactions (
    id, request_key, kind, account_id, to_account_id, person_id, amount,
    category, description, notes, occurred_at, created_at, updated_at
  )
  select id, request_key, kind, account_id, to_account_id, person_id, amount,
    category, description, notes, occurred_at, created_at, updated_at
  from jsonb_populate_recordset(null::public.transactions, p_backup -> 'transactions');

  insert into public.loans (
    id, person_id, direction, principal_transaction_id, principal,
    borrowed_or_lent_at, expected_date, notes, created_at
  )
  select id, person_id, direction, principal_transaction_id, principal,
    borrowed_or_lent_at, expected_date, notes, created_at
  from jsonb_populate_recordset(null::public.loans, p_backup -> 'loans');

  insert into public.loan_repayments (id, loan_id, transaction_id, amount, paid_at, created_at)
  select id, loan_id, transaction_id, amount, paid_at, created_at
  from jsonb_populate_recordset(null::public.loan_repayments, p_backup -> 'loan_repayments');

  insert into public.audit_log (
    id, table_name, record_id, operation, old_record, new_record, changed_at
  )
  overriding system value
  select id, table_name, record_id, operation, old_record, new_record, changed_at
  from jsonb_populate_recordset(null::public.audit_log, p_backup -> 'audit_log');

  perform setval(
    pg_get_serial_sequence('public.audit_log', 'id'),
    coalesce((select max(id) from public.audit_log), 0) + 1,
    false
  );
end;
$$;

revoke execute on function public.record_transaction_batch(jsonb) from public, anon, authenticated;
revoke execute on function public.restore_backup(jsonb) from public, anon, authenticated;
grant execute on function public.record_transaction_batch(jsonb) to service_role;
grant execute on function public.restore_backup(jsonb) to service_role;
