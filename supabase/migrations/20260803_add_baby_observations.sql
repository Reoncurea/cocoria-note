-- 呼吸チェックのまわりで、赤ちゃんの様子を記録できるようにする。
--
-- 背景（2026-08-03 ユーザー要望）
--   - 呼吸チェックと一緒に、体温・機嫌・寝ている時間を管理したい
--   - うつぶせ寝を直した記録も、呼吸チェックと同じタイミングで残したい
--
-- 設計
--   1. うつぶせ直しは、5分ごとのマスに状態を足す（同じ時刻の記録なので同じ場所に持つ）
--   2. 睡眠は「寝た」「起きた」の打刻。1回の訪問で何回でも記録できる
--   3. 体温・機嫌は時刻つきの記録。1回の訪問で何回でも記録できる

-- ============================================
-- 1. うつぶせ寝を直した記録
-- ============================================

alter table public.breath_check_cells
  add column if not exists prone_corrected boolean not null default false;

comment on column public.breath_check_cells.prone_corrected is 'このコマでうつぶせ寝を直したか';

-- ============================================
-- 2. 睡眠の記録
-- ============================================

create table if not exists public.sleep_logs (
  id         uuid primary key default gen_random_uuid(),
  visit_id   uuid references public.visits(id) on delete cascade not null,
  started_at time not null,
  -- 「寝た」だけ押して、まだ起きていない状態を表すため null を許す
  ended_at   time,
  note       text,
  created_at timestamptz not null default now()
);

create index if not exists sleep_logs_visit_idx on public.sleep_logs (visit_id, started_at);

comment on table public.sleep_logs is '訪問中の睡眠。「寝た」「起きた」の打刻で作る';

-- ============================================
-- 3. 体温・機嫌の記録
-- ============================================

create table if not exists public.baby_observations (
  id          uuid primary key default gen_random_uuid(),
  visit_id    uuid references public.visits(id) on delete cascade not null,
  recorded_at time not null,
  -- 36.8 のような値。測っていないときは null
  temperature numeric(3,1),
  -- good / calm / fussy / crying / sleeping。表示名はアプリ側が持つ
  mood        text,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists baby_observations_visit_idx on public.baby_observations (visit_id, recorded_at);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.baby_observations'::regclass
      and conname = 'baby_observations_mood_check'
  ) then
    alter table public.baby_observations
      add constraint baby_observations_mood_check
      check (mood is null or mood in ('good', 'calm', 'fussy', 'crying', 'sleeping'));
  end if;
end $$;

comment on table public.baby_observations is '訪問中の体温・機嫌の記録';

-- ============================================
-- 4. RLS（既存の訪問まわりと同じ方針）
-- ============================================

alter table public.sleep_logs        enable row level security;
alter table public.baby_observations enable row level security;

drop policy if exists "profile can read own sleep logs" on public.sleep_logs;
create policy "profile can read own sleep logs" on public.sleep_logs
  for select using (
    public.can_read_app_data()
    and exists (
      select 1 from public.visits
      where visits.id = sleep_logs.visit_id
        and (public.is_admin_user() or visits.user_id = auth.uid())
    )
  );

drop policy if exists "profile can write own sleep logs" on public.sleep_logs;
create policy "profile can write own sleep logs" on public.sleep_logs
  for all using (
    public.can_write_app_data()
    and exists (
      select 1 from public.visits
      where visits.id = sleep_logs.visit_id
        and (public.is_admin_user() or visits.user_id = auth.uid())
    )
  )
  with check (
    public.can_write_app_data()
    and exists (
      select 1 from public.visits
      where visits.id = sleep_logs.visit_id
        and (public.is_admin_user() or visits.user_id = auth.uid())
    )
  );

drop policy if exists "profile can read own baby observations" on public.baby_observations;
create policy "profile can read own baby observations" on public.baby_observations
  for select using (
    public.can_read_app_data()
    and exists (
      select 1 from public.visits
      where visits.id = baby_observations.visit_id
        and (public.is_admin_user() or visits.user_id = auth.uid())
    )
  );

drop policy if exists "profile can write own baby observations" on public.baby_observations;
create policy "profile can write own baby observations" on public.baby_observations
  for all using (
    public.can_write_app_data()
    and exists (
      select 1 from public.visits
      where visits.id = baby_observations.visit_id
        and (public.is_admin_user() or visits.user_id = auth.uid())
    )
  )
  with check (
    public.can_write_app_data()
    and exists (
      select 1 from public.visits
      where visits.id = baby_observations.visit_id
        and (public.is_admin_user() or visits.user_id = auth.uid())
    )
  );
