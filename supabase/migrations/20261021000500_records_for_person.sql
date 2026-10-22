-- Money that moves through my accounts but belongs to someone else's records
-- (for example Dad's business) is tagged with that person.
alter table public.transactions
  add column if not exists for_person_id uuid references public.people(id);

create index if not exists transactions_for_person_id_idx
  on public.transactions (for_person_id);
