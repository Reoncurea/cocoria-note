-- 事前プランニング・セッション本体
create table planning_sessions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  staff_id uuid references auth.users(id),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'archived')),
  current_section text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index idx_planning_sessions_customer on planning_sessions(customer_id);
create index idx_planning_sessions_status on planning_sessions(status);

-- 回答データ（セクション単位でJSONBに格納）
create table planning_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references planning_sessions(id) on delete cascade,
  section_id text not null,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, section_id)
);

-- 生成された提案（編集可能）
create table planning_suggestions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references planning_sessions(id) on delete cascade,
  rule_id text,
  priority text not null check (priority in ('high', 'medium', 'low')),
  category text not null,
  title text not null,
  body text not null,
  is_custom boolean not null default false,
  is_dismissed boolean not null default false,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_planning_suggestions_session on planning_suggestions(session_id);

-- RLS（既存のcustomersと同じポリシーに揃える）
alter table planning_sessions enable row level security;
alter table planning_answers enable row level security;
alter table planning_suggestions enable row level security;

create policy "staff can access own planning sessions" on planning_sessions
  for all using (auth.uid() is not null);
create policy "staff can access own planning answers" on planning_answers
  for all using (auth.uid() is not null);
create policy "staff can access own planning suggestions" on planning_suggestions
  for all using (auth.uid() is not null);

-- updated_at 自動更新トリガ
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_planning_sessions_updated
  before update on planning_sessions
  for each row execute function update_updated_at_column();

create trigger trg_planning_answers_updated
  before update on planning_answers
  for each row execute function update_updated_at_column();

create trigger trg_planning_suggestions_updated
  before update on planning_suggestions
  for each row execute function update_updated_at_column();
