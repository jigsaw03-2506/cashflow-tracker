-- Edit or delete any history entry (money added, loans, repayments) while
-- keeping loans, repayments, and account balances consistent.

create or replace function public.edit_history_entry(
  p_transaction_id uuid,
  p_amount numeric,
  p_occurred_at timestamptz,
  p_account_id uuid default null,
  p_notes text default null,
  p_expected_date date default null,
  p_money_type text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tx public.transactions%rowtype;
  loan_row public.loans%rowtype;
  repayment_row public.loan_repayments%rowtype;
  other_repaid numeric(18, 2);
begin
  select * into tx from public.transactions where id = p_transaction_id for update;
  if not found then
    raise exception 'Record was not found';
  end if;
  if tx.kind = 'transfer' then
    raise exception 'Transfers cannot be edited here';
  end if;
  if p_amount is null or p_amount < 0.01 or p_amount > 90000000000000 then
    raise exception 'Amount must be greater than zero and within supported limits';
  end if;
  if p_money_type is not null and p_money_type not in ('cash', 'e_money') then
    raise exception 'Money type must be cash or e_money';
  end if;

  -- Debts that existed before using the app stay without an account.
  if tx.account_id is not null then
    if p_account_id is null then
      raise exception 'Selected account is unavailable';
    end if;
    if p_account_id <> tx.account_id then
      perform 1 from public.accounts where id = p_account_id and is_active for update;
      if not found then
        raise exception 'Selected account is unavailable';
      end if;
    end if;
  end if;

  select * into loan_row from public.loans where principal_transaction_id = tx.id for update;
  if found then
    select coalesce(sum(amount), 0) into other_repaid
    from public.loan_repayments where loan_id = loan_row.id;
    if p_amount < other_repaid then
      raise exception 'Amount cannot be less than what has already been repaid';
    end if;
    update public.loans
    set principal = p_amount,
        borrowed_or_lent_at = p_occurred_at,
        expected_date = p_expected_date,
        notes = p_notes,
        money_type = case when tx.account_id is null then p_money_type else money_type end
    where id = loan_row.id;
  else
    select * into repayment_row from public.loan_repayments where transaction_id = tx.id for update;
    if found then
      select * into loan_row from public.loans where id = repayment_row.loan_id for update;
      select coalesce(sum(amount), 0) into other_repaid
      from public.loan_repayments
      where loan_id = loan_row.id and id <> repayment_row.id;
      if p_amount > loan_row.principal - other_repaid then
        raise exception 'Repayment cannot exceed the outstanding balance';
      end if;
      update public.loan_repayments
      set amount = p_amount, paid_at = p_occurred_at
      where id = repayment_row.id;
    end if;
  end if;

  update public.transactions
  set amount = p_amount,
      account_id = case when tx.account_id is null then null else p_account_id end,
      occurred_at = p_occurred_at,
      notes = p_notes,
      updated_at = now()
  where id = tx.id;
end;
$$;

create or replace function public.delete_history_entry(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  loan_row public.loans%rowtype;
  repayment_transaction_ids uuid[];
begin
  perform 1 from public.transactions where id = p_transaction_id for update;
  if not found then
    raise exception 'Record was not found';
  end if;

  select * into loan_row from public.loans where principal_transaction_id = p_transaction_id for update;
  if found then
    -- Deleting a loan also deletes its repayments, so no orphaned money movements remain.
    select coalesce(array_agg(transaction_id), array[]::uuid[]) into repayment_transaction_ids
    from public.loan_repayments where loan_id = loan_row.id;
    delete from public.loan_repayments where loan_id = loan_row.id;
    delete from public.loans where id = loan_row.id;
    delete from public.transactions where id = any(repayment_transaction_ids);
  else
    delete from public.loan_repayments where transaction_id = p_transaction_id;
  end if;

  delete from public.transactions where id = p_transaction_id;
end;
$$;

revoke execute on function public.edit_history_entry(uuid, numeric, timestamptz, uuid, text, date, text) from public, anon, authenticated;
revoke execute on function public.delete_history_entry(uuid) from public, anon, authenticated;
grant execute on function public.edit_history_entry(uuid, numeric, timestamptz, uuid, text, date, text) to service_role;
grant execute on function public.delete_history_entry(uuid) to service_role;
