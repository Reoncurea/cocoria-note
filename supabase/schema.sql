-- ============================================
-- 顧客管理システム v1 — Supabase スキーマ
-- ============================================

-- 拡張機能
create extension if not exists "uuid-ossp";

-- ============================================
-- 1. 顧客（カルテ）テーブル
-- ============================================
create table customers (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,

  -- お母さん情報
  name_kanji  text not null,
  name_kana   text not null,
  age         integer,
  phone       text,
  email       text,
  line_id     text,
  address     text,

  -- サポート情報
  transport   text,           -- 訪問手段: 車・電車・その他
  inquiry_date date,          -- 問い合わせ日

  -- ステータス
  status      text not null default '活動中',  -- 活動中・契約済み・終了

  -- メモ
  notes       text,

  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ============================================
-- 2. 赤ちゃん情報テーブル（複数登録・双子対応）
-- ============================================
create table babies (
  id            uuid primary key default uuid_generate_v4(),
  customer_id   uuid references customers(id) on delete cascade not null,
  name          text,
  birth_date    date,          -- 出産日（確定後）
  due_date      date,          -- 出産予定日
  sort_order    integer default 0,
  created_at    timestamptz default now()
);

-- ============================================
-- 3. 家族情報テーブル
-- ============================================
create table family_members (
  id            uuid primary key default uuid_generate_v4(),
  customer_id   uuid references customers(id) on delete cascade not null,
  name          text not null,
  name_kana     text,
  relation      text,          -- 続柄
  gender        text,          -- 男・女・その他
  age           integer,       -- 年齢（月齢）
  allergies     text,          -- アレルギー・制限食材
  sort_order    integer default 0,
  created_at    timestamptz default now()
);

-- ============================================
-- 4. サポート内容タグテーブル
-- ============================================
create table support_tags (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  is_default  boolean default false,  -- デフォルトタグは削除不可
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

-- ============================================
-- 5. 対応履歴テーブル
-- ============================================
create table visits (
  id                uuid primary key default uuid_generate_v4(),
  customer_id       uuid references customers(id) on delete cascade not null,
  user_id           uuid references auth.users(id) on delete cascade not null,

  -- 訪問情報
  visit_date        date not null,
  start_time        time,
  end_time          time,
  transport         text,         -- 訪問手段

  -- 休憩
  has_break         boolean default false,
  break_start       time,
  break_end         time,

  -- メモ
  customer_notes    text,         -- 顧客の様子（非公開・報告書に含めない）
  customer_message  text,         -- ご依頼主からのメッセージ（報告書に含める）
  next_visit_notes  text,         -- 次回の予定・申し引き事項（非公開）
  staff_message     text,         -- 担当者からのメッセージ（報告書に含める）

  -- 報告書状態
  report_sent       boolean default false,
  report_sent_at    timestamptz,

  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ============================================
-- 6. 対応履歴×タグ 中間テーブル
-- ============================================
create table visit_tags (
  id          uuid primary key default uuid_generate_v4(),
  visit_id    uuid references visits(id) on delete cascade not null,
  tag_id      uuid references support_tags(id) on delete cascade not null,
  unique(visit_id, tag_id)
);

-- ============================================
-- 7. 時間ごとサービス報告テーブル
-- ============================================
create table service_records (
  id          uuid primary key default uuid_generate_v4(),
  visit_id    uuid references visits(id) on delete cascade not null,
  time_label  text not null,    -- 例: "10:00"
  content     text,             -- 内容
  detail      text,             -- 詳細
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

-- ============================================
-- 8. 呼吸チェック表テーブル
-- ============================================
create table breath_checks (
  id          uuid primary key default uuid_generate_v4(),
  visit_id    uuid references visits(id) on delete cascade not null,
  memo        text,
  created_at  timestamptz default now()
);

-- 呼吸チェック — 各マス目
create table breath_check_cells (
  id              uuid primary key default uuid_generate_v4(),
  breath_check_id uuid references breath_checks(id) on delete cascade not null,
  hour_label      text not null,    -- 例: "10時"
  minute_value    integer not null, -- 0, 5, 10, ..., 55
  checked         boolean default false,
  unique(breath_check_id, hour_label, minute_value)
);

-- ============================================
-- 9. 請求・入金管理テーブル
-- ============================================
create table billing (
  id              uuid primary key default uuid_generate_v4(),
  customer_id     uuid references customers(id) on delete cascade not null,
  user_id         uuid references auth.users(id) on delete cascade not null,

  -- 契約
  contracted      boolean default false,

  -- 請求
  invoiced        boolean default false,
  invoiced_date   date,
  amount          integer,          -- 金額（任意）

  -- 入金
  paid            boolean default false,
  paid_date       date,

  -- 備考
  notes           text,

  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  unique(customer_id)
);

-- ============================================
-- 10. 問い合わせフォームテーブル
-- ============================================
create table inquiries (
  id              uuid primary key default uuid_generate_v4(),
  name_kanji      text not null,
  name_kana       text not null,
  phone           text not null,
  email           text not null,
  address         text,
  due_date        date,
  baby_count      integer,
  allergies       text,
  support_tags    text[],
  message         text,
  is_processed    boolean default false,  -- カルテ登録済みか
  created_at      timestamptz default now()
);

-- ============================================
-- RLS（Row Level Security）設定
-- ============================================

alter table customers        enable row level security;
alter table babies           enable row level security;
alter table family_members   enable row level security;
alter table support_tags     enable row level security;
alter table visits           enable row level security;
alter table visit_tags       enable row level security;
alter table service_records  enable row level security;
alter table breath_checks    enable row level security;
alter table breath_check_cells enable row level security;
alter table billing          enable row level security;
alter table inquiries        enable row level security;

-- customers RLS
create policy "自分の顧客のみアクセス" on customers
  for all using (auth.uid() = user_id);

-- babies RLS（顧客経由で所有者チェック）
create policy "自分の顧客の赤ちゃん情報のみ" on babies
  for all using (
    exists (select 1 from customers where customers.id = babies.customer_id and customers.user_id = auth.uid())
  );

-- family_members RLS
create policy "自分の顧客の家族情報のみ" on family_members
  for all using (
    exists (select 1 from customers where customers.id = family_members.customer_id and customers.user_id = auth.uid())
  );

-- support_tags RLS
create policy "自分のタグのみ" on support_tags
  for all using (auth.uid() = user_id);

-- visits RLS
create policy "自分の対応履歴のみ" on visits
  for all using (auth.uid() = user_id);

-- visit_tags RLS
create policy "自分の対応履歴のタグのみ" on visit_tags
  for all using (
    exists (select 1 from visits where visits.id = visit_tags.visit_id and visits.user_id = auth.uid())
  );

-- service_records RLS
create policy "自分の作業記録のみ" on service_records
  for all using (
    exists (select 1 from visits where visits.id = service_records.visit_id and visits.user_id = auth.uid())
  );

-- breath_checks RLS
create policy "自分の呼吸チェック表のみ" on breath_checks
  for all using (
    exists (select 1 from visits where visits.id = breath_checks.visit_id and visits.user_id = auth.uid())
  );

-- breath_check_cells RLS
create policy "自分の呼吸チェックマス目のみ" on breath_check_cells
  for all using (
    exists (
      select 1 from breath_checks bc
      join visits v on v.id = bc.visit_id
      where bc.id = breath_check_cells.breath_check_id and v.user_id = auth.uid()
    )
  );

-- billing RLS
create policy "自分の請求情報のみ" on billing
  for all using (auth.uid() = user_id);

-- inquiries: 誰でもINSERT可・SELECT/UPDATEは認証ユーザーのみ
create policy "問い合わせ送信は誰でも可" on inquiries
  for insert with check (true);

create policy "問い合わせ閲覧は認証ユーザーのみ" on inquiries
  for select using (auth.role() = 'authenticated');

create policy "問い合わせ更新は認証ユーザーのみ" on inquiries
  for update using (auth.role() = 'authenticated');

-- ============================================
-- デフォルトタグを挿入する関数（サインアップ後に呼ぶ）
-- ============================================
create or replace function insert_default_tags(p_user_id uuid)
returns void as $$
begin
  insert into support_tags (user_id, name, is_default, sort_order) values
    (p_user_id, '料理',       true, 1),
    (p_user_id, '掃除',       true, 2),
    (p_user_id, '洗濯',       true, 3),
    (p_user_id, '買い物',     true, 4),
    (p_user_id, '沐浴サポート', true, 5),
    (p_user_id, '育児相談',   true, 6);
end;
$$ language plpgsql security definer;

-- 新規ユーザー登録時にデフォルトタグを自動挿入するトリガー
create or replace function on_auth_user_created()
returns trigger as $$
begin
  perform insert_default_tags(new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure on_auth_user_created();

-- updated_at 自動更新用関数
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_customers_updated_at before update on customers
  for each row execute procedure update_updated_at();

create trigger update_visits_updated_at before update on visits
  for each row execute procedure update_updated_at();

create trigger update_billing_updated_at before update on billing
  for each row execute procedure update_updated_at();
