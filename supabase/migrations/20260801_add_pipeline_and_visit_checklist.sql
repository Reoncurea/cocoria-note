-- 顧客ごとの進行ステータス（15段階）・訪問チェックリスト・交通/定期利用情報を追加する。
--
-- 追加するもの
--   1. customers に進行ステータスと交通・定期利用の項目
--   2. customer_stage_events（ステータス変更履歴）
--   3. visits.checklist（訪問チェックリストの状態を JSONB で保持）
--
-- 既存データへの影響
--   - customers.pipeline_stage は既存行にも 'inquiry' が入る（下で実態に合わせて補正）
--   - 既存の RLS 方針（can_read_app_data / can_write_app_data / can_access_customer）を踏襲する

-- ============================================
-- 1. customers への項目追加
-- ============================================

alter table public.customers
  add column if not exists pipeline_stage    text not null default 'inquiry',
  add column if not exists stage_updated_at  timestamptz not null default now(),
  add column if not exists stage_note        text,
  add column if not exists nearest_station   text,
  add column if not exists route_note        text,
  add column if not exists transport_fee     integer,
  add column if not exists is_recurring      boolean not null default false,
  add column if not exists recurring_note    text;

comment on column public.customers.pipeline_stage   is '進行ステータス（15段階）';
comment on column public.customers.stage_updated_at is 'ステータスが最後に変わった日時。滞留アラートの判定に使う';
comment on column public.customers.stage_note       is 'ステータスに対する補足メモ';
comment on column public.customers.nearest_station  is '最寄駅';
comment on column public.customers.route_note       is '交通経路メモ';
comment on column public.customers.transport_fee    is '交通費（往復・円）';
comment on column public.customers.is_recurring     is '定期利用者かどうか';
comment on column public.customers.recurring_note   is '定期利用のパターン（例: 毎週火曜 10:00-13:00）';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.customers'::regclass
      and conname = 'customers_pipeline_stage_check'
  ) then
    alter table public.customers
      add constraint customers_pipeline_stage_check
      check (pipeline_stage in (
        'inquiry',              -- 1. 問い合わせ
        'form_received',        -- 2. 申込フォーム受領
        'transport_check',      -- 3. 交通費確認中
        'scheduling',           -- 4. 日程調整中
        'schedule_fixed',       -- 5. 日程確定
        'contract_sent',        -- 6. 契約送付済み
        'contract_signed',      -- 7. 契約締結済み
        'invoiced',             -- 8. 請求済み
        'paid',                 -- 9. 入金済み
        'day_before_confirmed', -- 10. 前日確認済み
        'visit_done',           -- 11. 訪問完了
        'report_sent',          -- 12. 報告書送付済み
        'survey_sent',          -- 13. アンケート送付済み
        'next_offered',         -- 14. 次回案内済み
        'completed'             -- 15. 完了・継続利用
      ));
  end if;
end $$;

create index if not exists customers_pipeline_stage_idx
  on public.customers (user_id, pipeline_stage);

-- ステータスが変わったときだけ stage_updated_at を更新する
create or replace function public.touch_customer_stage_updated_at()
returns trigger as $$
begin
  if new.pipeline_stage is distinct from old.pipeline_stage then
    new.stage_updated_at = now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_customers_stage_updated on public.customers;
create trigger trg_customers_stage_updated
  before update on public.customers
  for each row execute function public.touch_customer_stage_updated_at();

-- ============================================
-- 2. ステータス変更履歴
-- ============================================

create table if not exists public.customer_stage_events (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade not null,
  user_id     uuid references auth.users(id) on delete cascade not null,
  from_stage  text,
  to_stage    text not null,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists customer_stage_events_customer_idx
  on public.customer_stage_events (customer_id, created_at desc);

alter table public.customer_stage_events enable row level security;

drop policy if exists "profile can read own stage events" on public.customer_stage_events;
create policy "profile can read own stage events" on public.customer_stage_events
  for select using (
    public.can_read_app_data()
    and (public.is_admin_user() or user_id = auth.uid())
    and public.can_access_customer(customer_id)
  );

drop policy if exists "profile can write own stage events" on public.customer_stage_events;
create policy "profile can write own stage events" on public.customer_stage_events
  for all using (
    public.can_write_app_data()
    and (public.is_admin_user() or user_id = auth.uid())
    and public.can_access_customer(customer_id)
  )
  with check (
    public.can_write_app_data()
    and (public.is_admin_user() or user_id = auth.uid())
    and public.can_access_customer(customer_id)
  );

-- ============================================
-- 3. 訪問チェックリスト
-- ============================================
-- 形式: { "<項目ID>": { "checked": boolean, "note": string, "at": timestamptz } }
-- 項目の定義そのものはアプリ側（src/lib/constants/visit-checklist.ts）に持つ。
-- 項目を増減してもDB変更が不要になるよう、値だけをJSONBで保持する。

alter table public.visits
  add column if not exists checklist jsonb not null default '{}'::jsonb;

comment on column public.visits.checklist is '訪問チェックリストの状態。項目定義はアプリ側が正本';

-- ============================================
-- 4. 既存データの補正
-- ============================================
-- すでに運用中の顧客が全員「問い合わせ」に見えてしまうのを避けるため、
-- 実績から推定できる範囲でステータスを引き上げる。
-- （推定なので、実態と違う顧客は画面から直してください）

update public.customers c
set pipeline_stage = 'report_sent'
where c.pipeline_stage = 'inquiry'
  and exists (
    select 1 from public.visits v
    where v.customer_id = c.id and v.report_sent = true
  );

update public.customers c
set pipeline_stage = 'visit_done'
where c.pipeline_stage = 'inquiry'
  and exists (
    select 1 from public.visits v
    where v.customer_id = c.id and v.visit_date <= current_date
  );

update public.customers c
set pipeline_stage = 'contract_signed'
where c.pipeline_stage = 'inquiry'
  and exists (
    select 1 from public.customer_contracts cc
    where cc.customer_id = c.id
  );
