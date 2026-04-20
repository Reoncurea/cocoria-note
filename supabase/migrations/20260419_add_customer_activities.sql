-- 対応記録テーブル（訪問以外の顧客対応：資料提供・自治体連携など）
create table if not exists customer_activities (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid references customers(id) on delete cascade not null,
  user_id        uuid references auth.users(id) not null,
  type           text not null check (type in ('material', 'municipal', 'other')),
  activity_date  date not null,
  title          text not null,
  body           text,
  staff_name     text,
  municipality_name text,
  contact_person text,
  created_at     timestamptz default now() not null,
  updated_at     timestamptz default now() not null
);

alter table customer_activities enable row level security;

create policy "Users can manage own activities"
  on customer_activities for all
  using (auth.uid() = user_id);

create trigger trg_customer_activities_updated
  before update on customer_activities
  for each row execute function update_updated_at_column();
