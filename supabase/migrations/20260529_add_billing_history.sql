-- Add contract history and visit-level billing tracking.
-- Existing billing rows are kept for compatibility.

create table if not exists customer_contracts (
  id              uuid primary key default uuid_generate_v4(),
  customer_id     uuid references customers(id) on delete cascade not null,
  user_id         uuid references auth.users(id) on delete cascade not null,
  title           text not null default 'Contract',
  contracted_date date not null,
  period_start    date,
  period_end      date,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create table if not exists visit_billing (
  id              uuid primary key default uuid_generate_v4(),
  visit_id        uuid references visits(id) on delete cascade not null,
  customer_id     uuid references customers(id) on delete cascade not null,
  user_id         uuid references auth.users(id) on delete cascade not null,
  contract_id     uuid references customer_contracts(id) on delete set null,
  invoice_label   text,
  amount          integer,
  invoiced        boolean default false,
  invoiced_date   date,
  paid            boolean default false,
  paid_date       date,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique(visit_id)
);

alter table customer_contracts enable row level security;
alter table visit_billing enable row level security;

drop policy if exists "own customer contracts only" on customer_contracts;
create policy "own customer contracts only" on customer_contracts
  for all using (auth.uid() = user_id);

drop policy if exists "own visit billing only" on visit_billing;
create policy "own visit billing only" on visit_billing
  for all using (auth.uid() = user_id);

drop trigger if exists update_customer_contracts_updated_at on customer_contracts;
create trigger update_customer_contracts_updated_at before update on customer_contracts
  for each row execute procedure update_updated_at();

drop trigger if exists update_visit_billing_updated_at on visit_billing;
create trigger update_visit_billing_updated_at before update on visit_billing
  for each row execute procedure update_updated_at();

insert into customer_contracts (customer_id, user_id, title, contracted_date, notes)
select
  b.customer_id,
  b.user_id,
  'Initial contract',
  coalesce(b.invoiced_date, b.created_at::date),
  b.notes
from billing b
where b.contracted = true
  and not exists (
    select 1
    from customer_contracts cc
    where cc.customer_id = b.customer_id
  );
