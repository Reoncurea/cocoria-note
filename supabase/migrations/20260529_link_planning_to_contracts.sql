alter table planning_sessions
  add column if not exists contract_id uuid references customer_contracts(id) on delete set null;

create unique index if not exists idx_planning_sessions_contract
  on planning_sessions(contract_id)
  where contract_id is not null;
