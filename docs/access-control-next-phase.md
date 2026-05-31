# cocoria-note 権限・課金状態設計メモ

更新日: 2026-05-30

## 今回固めた方針

次フェーズの土台として、`user_profiles` をアプリ利用可否の中心に置く。

現時点ではまだ単独利用者モデルを維持し、顧客・訪問・請求などの業務データは各テーブルの `user_id` または顧客の所有者で分離する。将来 `supporter` やチーム利用を入れる前に、まず「ログインできる」と「業務データを触れる」を分ける。

## ロール

| role | 意味 | 現時点の扱い |
| --- | --- | --- |
| admin | 管理者 | 問い合わせ・ユーザー状態管理・全体確認の土台 |
| user | 通常利用者 | 自分の顧客・訪問・請求データを扱う |
| supporter | 将来の支援者 | 予約枠。今後 `customer_assignments` で担当顧客だけに制限する |

## 利用状態

| 状態 | 意味 | 現時点の扱い |
| --- | --- | --- |
| onboarding_status = pending | 未設定 | アプリ利用不可 |
| onboarding_status = completed | 利用開始済み | 課金状態に応じて利用可 |
| subscription_status = trialing | 試用中 | 読み書き可 |
| subscription_status = active | 有効 | 読み書き可 |
| subscription_status = past_due | 支払い確認が必要 | DB上は読み取りのみの土台。画面は支払方法相談の連絡導線を表示 |
| subscription_status = canceled | 停止中 | DB上は読み取りのみの土台。画面は状態確認へ誘導 |

## DB側の考え方

`20260530_add_profile_based_access_control.sql` で以下の関数を追加した。

- `is_admin_user()`
- `can_read_app_data()`
- `can_write_app_data()`
- `can_access_customer(customer_id)`

RLSでは、読み取りと書き込みを分ける。

- 読み取り: `completed` かつ `trialing / active / past_due / canceled`
- 書き込み: `completed` かつ `trialing / active`
- admin: 有効な管理者として広めに確認可能

## アプリ側の考え方

`middleware.ts` で、ログイン済みユーザーでもプロフィール状態が不十分な場合は `/account-status` に誘導する。

APIへの直接アクセスは、同じ条件で `403` を返す。

## 次にやること

1. 本番DBで `pg_policies` を確認し、古い広いポリシーが残っていないか確認する。
2. `20260530_add_profile_based_access_control.sql` と `20260530_limit_admin_data_visibility.sql` を本番に適用する。
3. Vercelに `SUPABASE_SERVICE_ROLE_KEY` を追加し、管理画面から招待メールを送れるようにする。
4. `subscription_status` を手動更新する運用から始める。
5. Stripe導入前に `subscriptions` テーブルを追加する。
6. supporterを入れる前に `customer_assignments` を追加する。

## 将来の追加テーブル案

```sql
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table organization_members (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'user', 'supporter', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table customer_assignments (
  customer_id uuid not null references customers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null check (permission in ('read', 'write')),
  created_at timestamptz not null default now(),
  primary key (customer_id, user_id)
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'manual',
  provider_customer_id text,
  provider_subscription_id text,
  plan text not null default 'trial',
  status text not null check (status in ('trialing', 'active', 'past_due', 'canceled')),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  grace_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```
