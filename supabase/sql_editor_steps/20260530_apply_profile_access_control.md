# 2026-05-30 user_profiles ベース権限管理 適用手順

この手順は Supabase SQL Editor で実行する。

## 目的

ログイン済みであっても、`user_profiles` の状態が不十分なユーザーは業務データを触れないようにする。

- `onboarding_status = completed`
- `subscription_status = trialing / active`

上記を満たすユーザーだけが、顧客・訪問・請求・写真・プランニング等を書き込みできる。

## 1. 適用前チェック

SQL Editorで先に実行する。

```sql
select
  user_id,
  email,
  role,
  onboarding_status,
  subscription_status
from public.user_profiles
order by created_at desc;
```

自分のアカウントが次の状態であることを確認する。

- `role = admin`
- `onboarding_status = completed`
- `subscription_status = active`

## 2. RLS強化SQLを適用

以下のファイル内容を SQL Editor に貼り付けて実行する。

`supabase/migrations/20260530_add_profile_based_access_control.sql`

## 3. 適用後チェック

### 3-1. 関数が作成されているか

```sql
select
  routine_name,
  routine_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'is_admin_user',
    'can_read_app_data',
    'can_write_app_data',
    'can_access_customer'
  )
order by routine_name;
```

4件表示されればOK。

### 3-2. role に supporter が追加されているか

```sql
select
  conname,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.user_profiles'::regclass
  and conname = 'user_profiles_role_check';
```

`admin`, `user`, `supporter` が含まれていればOK。

### 3-3. 主要テーブルのRLSポリシーを確認

```sql
select
  schemaname,
  tablename,
  policyname,
  cmd
from pg_policies
where schemaname in ('public', 'storage')
  and (
    tablename in (
      'customers',
      'babies',
      'family_members',
      'support_tags',
      'visits',
      'visit_tags',
      'service_records',
      'visit_photos',
      'breath_checks',
      'breath_check_cells',
      'billing',
      'customer_contracts',
      'visit_billing',
      'customer_activities',
      'planning_sessions',
      'planning_answers',
      'planning_suggestions',
      'inquiries',
      'user_profiles'
    )
    or (schemaname = 'storage' and tablename = 'objects')
  )
order by schemaname, tablename, policyname;
```

古い問い合わせポリシーで、`authenticated` 全員が閲覧できるものが残っていないことを確認する。

特に残っていたら危険な例:

- `inquiries` の `select using (auth.role() = 'authenticated')`
- `inquiries` の `update using (auth.role() = 'authenticated')`
- `planning_*` の `using (auth.uid() is not null)`

## 4. アプリ側の動作確認

### adminアカウント

- `/dashboard` が開ける
- 顧客一覧が開ける
- 顧客登録ができる
- 写真アップロードができる

### pendingユーザー

`user_profiles` を一時的に次へ変更して確認する。

```sql
update public.user_profiles
set onboarding_status = 'pending'
where email = '確認したいメールアドレス';
```

期待結果:

- `/dashboard` に進めない
- `/account-status` に表示される
- APIは `403` になる

確認後、戻す。

```sql
update public.user_profiles
set onboarding_status = 'completed'
where email = '確認したいメールアドレス';
```

### canceledユーザー

```sql
update public.user_profiles
set subscription_status = 'canceled'
where email = '確認したいメールアドレス';
```

期待結果:

- `/account-status` に表示される
- 業務画面へ進めない

確認後、戻す。

```sql
update public.user_profiles
set subscription_status = 'active'
where email = '確認したいメールアドレス';
```

## 5. もしSQLが途中で止まった場合

エラー文を控えて、以下を確認する。

```sql
select
  tablename,
  policyname
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

途中まで適用された可能性がある場合でも、今回のSQLは既存ポリシーを一度落として作り直す設計なので、エラー原因を直して再実行できる。

ただし、本番適用中に不明なエラーが出た場合は、次の招待ユーザーを追加する前に止める。
