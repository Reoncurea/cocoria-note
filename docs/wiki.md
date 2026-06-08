# cocoria-note Wiki

最終更新: 2026-06-08

## 1. このアプリの目的

cocoria-note は、産後ケア・産後パートナー事業の顧客対応を管理するための業務アプリです。

主に次の情報を一元管理します。

- 顧客基本情報
- 赤ちゃん・家族情報
- プランニング情報
- 訪問記録
- 訪問写真
- 支援内容・活動履歴
- 契約・請求・入金状況
- 管理者によるユーザー招待

現時点では、管理者兼実務ユーザーが運用する前提です。将来的に外部ユーザーや支援者が増える場合に備え、Supabase の RLS とユーザープロフィールでアクセス制御を行います。

## 2. 利用者向けの使い方

### 2.1 ログイン

本番URL:

```text
https://note.cocoria.net
```

ログイン後、利用状態に問題がある場合は `/account-status` に誘導されます。

### 2.2 顧客一覧

場所:

```text
/customers
```

できること:

- 顧客一覧の確認
- 顧客の新規登録
- 顧客詳細への移動

主な実装:

```text
src/app/(dashboard)/customers/page.tsx
src/app/(dashboard)/customers/new/page.tsx
```

### 2.3 顧客詳細

場所:

```text
/customers/[id]
```

できること:

- 基本情報の確認
- 赤ちゃん情報の確認
- 最新プランニング情報の確認
- プランニング情報の直接修正
- 担当者メモの追加
- プランニング写真の追加・メモ編集・削除
- 契約履歴の確認

主な実装:

```text
src/app/(dashboard)/customers/[id]/page.tsx
src/components/customer/ContractHistory.tsx
```

### 2.4 プランニング

場所:

```text
/customers/[id]/planning
/customers/[id]/planning/[sessionId]
/customers/[id]/planning/[sessionId]/edit
/customers/[id]/planning/[sessionId]/review
/customers/[id]/planning/[sessionId]/export
```

できること:

- ヒアリング形式でプランニング情報を入力
- 回答内容の編集
- 提案・レビュー
- PDF向け出力
- 顧客詳細から最新プランニング情報を直接修正

主な実装:

```text
src/lib/planning/questions.json
src/lib/planning/rules.json
src/lib/planning/engine.ts
src/app/api/planning/sessions/route.ts
src/app/api/planning/sessions/[id]/route.ts
src/app/api/planning/sessions/[id]/answers/route.ts
src/app/api/planning/sessions/[id]/generate/route.ts
src/app/api/planning/sessions/[id]/photos/route.ts
```

### 2.5 訪問記録

場所:

```text
/customers/[id]/visits
/customers/[id]/visits/new
/customers/[id]/visits/[visitId]
/customers/[id]/visits/[visitId]/edit
/customers/[id]/visits/[visitId]/report
```

できること:

- 訪問予定・実績の登録
- 訪問時間、休憩、交通手段の記録
- サービス内容の時系列記録
- 訪問写真の追加
- 報告書画面の確認

主な実装:

```text
src/app/(dashboard)/customers/[id]/visits/
src/lib/uploads/photos.ts
```

### 2.6 活動履歴

場所:

```text
/customers/[id]/activities
/customers/[id]/activities/new
/customers/[id]/activities/[activityId]
```

できること:

- 資料提供
- 自治体連携
- その他活動メモ

主な実装:

```text
src/app/(dashboard)/customers/[id]/activities/
src/app/api/customers/[id]/activities/
```

### 2.7 請求・契約

場所:

```text
/customers/[id]/billing
```

できること:

- 契約有無の管理
- 請求済み/未請求の管理
- 入金済み/未入金の管理
- 契約履歴の確認
- 訪問ごとの請求履歴確認

主なテーブル:

```text
billing
customer_contracts
visit_billing
```

### 2.8 管理者ユーザー管理

場所:

```text
/admin/users
```

できること:

- ユーザー招待
- 招待の再送
- 未完了招待の削除
- 権限と利用状態の管理

主な実装:

```text
src/app/(dashboard)/admin/users/
src/app/api/admin/users/
src/app/api/account/accept-invite/route.ts
```

関連docs:

```text
docs/admin-invite-setup.md
docs/invite-user-flow.md
docs/access-control-next-phase.md
docs/pre-stripe-subscription-operations.md
```

## 3. 開発者向けの構成

### 3.1 技術スタック

| 項目 | 内容 |
| --- | --- |
| フレームワーク | Next.js 16 |
| UI | React 19 |
| DB/Auth/Storage | Supabase |
| フォーム | react-hook-form / zod |
| 日付 | date-fns |
| アイコン | lucide-react |
| PDF | @react-pdf/renderer |
| テスト | Vitest |
| デプロイ | Vercel |

### 3.2 ディレクトリ

```text
src/app/                         画面とAPI
src/app/(dashboard)/             ログイン後の業務画面
src/app/api/                     サーバーAPI
src/components/                  共通UIコンポーネント
src/lib/constants/               選択肢・表示定数
src/lib/planning/                プランニング質問・ルール・エンジン
src/lib/supabase/                Supabase client/server/middleware
src/lib/uploads/                 写真アップロード補助
src/lib/validation/              入力バリデーション
src/types/database.ts            Supabaseテーブル型
supabase/migrations/             DB変更履歴
docs/                            運用・開発ドキュメント
```

### 3.3 主なコマンド

```bash
npm run dev
npm run lint
npm test
npm run build
npm run start
```

コミット前の最低確認:

```bash
npm run lint
npm test
npm run build
```

### 3.4 環境変数

ローカル:

```text
.env.local
```

主な環境変数:

| 名前 | 用途 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ブラウザ/SSR用のanon key |
| `SUPABASE_SERVICE_ROLE_KEY` | 管理者API用。絶対に公開しない |
| `NEXT_PUBLIC_APP_ORIGIN` | 本番URL。例: `https://note.cocoria.net` |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | 問い合わせ先メール |

注意:

- `SUPABASE_SERVICE_ROLE_KEY` はGitHubへ書かない
- `.env.local` は共有しない
- VercelのEnvironment Variablesに本番値を登録する

## 4. データベースとStorage

### 4.1 主なテーブル

| テーブル | 用途 |
| --- | --- |
| `customers` | 顧客基本情報 |
| `babies` | 赤ちゃん情報 |
| `family_members` | 家族情報 |
| `support_tags` | 支援内容タグ |
| `planning_sessions` | プランニング単位 |
| `planning_answers` | プランニング回答 |
| `planning_suggestions` | プランニング提案 |
| `planning_photos` | プランニング写真 |
| `visits` | 訪問記録 |
| `visit_tags` | 訪問に紐づく支援タグ |
| `service_records` | 訪問中の時系列記録 |
| `visit_photos` | 訪問写真 |
| `breath_checks` | 呼吸確認 |
| `breath_check_cells` | 呼吸確認の時刻別チェック |
| `billing` | 顧客単位の請求概要 |
| `customer_contracts` | 契約履歴 |
| `visit_billing` | 訪問単位の請求 |
| `customer_activities` | 活動履歴 |
| `inquiries` | 問い合わせ |
| `user_profiles` | 権限・利用状態 |

### 4.2 Storage bucket

| bucket | 用途 | 公開設定 |
| --- | --- | --- |
| `visit-photos` | 訪問写真 | private |
| `planning-photos` | プランニング写真 | private |

写真URLは公開URLではなく、短時間だけ使える署名付きURLで表示します。

### 4.3 migration一覧

```text
20260419_add_customer_activities.sql
20260419_add_planning.sql
20260529_add_billing_history.sql
20260529_add_visit_photos.sql
20260529_harden_multi_user_access.sql
20260529_link_planning_to_contracts.sql
20260530_add_profile_based_access_control.sql
20260530_limit_admin_data_visibility.sql
20260531_harden_invites_and_trial_limits.sql
20260608_add_planning_photos.sql
```

本番反映時は、VercelのデプロイだけではDB変更は反映されません。Supabase側にも未適用migrationを反映してください。

## 5. アクセス制御

### 5.1 基本方針

- 認証はSupabase Auth
- 業務データはSupabase RLSで保護
- `user_profiles` の状態で、読み取り・書き込み可否を制御
- 管理者APIでは `SUPABASE_SERVICE_ROLE_KEY` を使う

### 5.2 主要な判定

| 関数/項目 | 意味 |
| --- | --- |
| `is_admin_user()` | 管理者として扱えるか |
| `can_read_app_data()` | アプリデータを読めるか |
| `can_write_app_data()` | アプリデータを書けるか |
| `can_access_customer(customer_id)` | 対象顧客へアクセスできるか |

### 5.3 ユーザー状態

| 項目 | 主な値 |
| --- | --- |
| `role` | `admin`, `user`, `supporter` |
| `onboarding_status` | `pending`, `completed` |
| `subscription_status` | `trialing`, `active`, `past_due`, `canceled` |

現運用では、管理者兼実務ユーザーが中心です。外部ユーザーを増やす場合は、招待フロー・トライアル期限・権限を事前に確認してください。

## 6. デプロイ・本番反映

### 6.1 通常のコード反映

1. 修正
2. `npm run lint`
3. `npm test`
4. `npm run build`
5. commit
6. GitHub `master` へpush
7. Vercelで自動デプロイ

### 6.2 DB変更がある場合

コードのpushとは別に、Supabaseへmigrationを適用します。

DB変更がある例:

- 新しいテーブル追加
- RLS変更
- Storage bucket追加
- DB関数追加
- カラム追加

最近追加された本番適用注意のmigration:

```text
20260531_harden_invites_and_trial_limits.sql
20260608_add_planning_photos.sql
```

### 6.3 本番確認

最低限見る画面:

- `/login`
- `/dashboard`
- `/customers`
- `/customers/[id]`
- `/customers/[id]/planning`
- `/customers/[id]/visits`
- `/admin/users`

最低限見る動作:

- ログインできる
- 顧客一覧が表示される
- 顧客詳細が表示される
- プランニング情報を編集できる
- プランニング写真を追加できる
- 訪問記録を作成できる
- 管理者画面が開ける

## 7. セキュリティ方針

### 7.1 守ること

- 秘密情報は環境変数に置く
- `SUPABASE_SERVICE_ROLE_KEY` をクライアント側に出さない
- サーバーAPIでは `requireAuth()` を使って認証確認する
- 入力値はサーバー側で検証する
- DB操作はRLSで保護する
- 写真アップロードは種類・サイズをチェックする
- エラーで内部情報を画面に出さない

### 7.2 写真アップロード

許可形式:

```text
JPEG
PNG
WebP
```

サイズ:

```text
5MB以下
```

プランニング写真は `src/app/api/planning/sessions/[id]/photos/route.ts` を通してアップロードし、サーバー側でも検証します。

## 8. 現状の注意点

### 8.1 文字化けしているファイルがある

既存docsや一部定数に文字化けが残っています。

確認済みの例:

```text
docs/launch-checklist.md
docs/admin-invite-setup.md
src/lib/constants/statuses.ts
src/lib/constants/activities.ts
src/lib/constants/forms.ts
src/types/database.ts のコメント
src/lib/supabase/server.ts のコメント
```

画面表示に影響する定数は、別タスクで優先的に修正してください。

### 8.2 lint warningが残っている

`npm run lint` は成功しますが、既存のReact Hooks warningなどが残っています。

主な対象:

```text
visits
billing
dashboard
ContractHistory
BottomNav
```

新規機能を追加するときは、触ったファイルのwarningは増やさない方針にします。

### 8.3 DB migrationは自動反映されない

GitHubへpushしてVercelが成功しても、SupabaseのDB変更は別途反映が必要です。

## 9. よくあるトラブル

### 9.1 画面は出るが写真追加できない

原因候補:

- `planning_photos` テーブルが本番DBにない
- `planning-photos` bucketがない
- Storage policyが未適用
- ファイルが5MBを超えている
- JPEG/PNG/WebP以外を選んでいる

確認するmigration:

```text
20260608_add_planning_photos.sql
```

### 9.2 ログイン後に業務画面へ入れない

原因候補:

- `user_profiles.role` が想定と違う
- `onboarding_status` が `completed` ではない
- `subscription_status` が有効状態ではない
- トライアル期限が切れている

確認SQL例:

```sql
select
  email,
  role,
  onboarding_status,
  subscription_status,
  invited_by,
  accepted_at,
  trial_ends_at
from public.user_profiles
order by created_at desc;
```

### 9.3 Google連携系のAPIが表示されない

以前の `invalid_grant` は、課金ではなくGoogle OAuthのrefresh token失効・取り消しが原因でした。

対応:

- Google OAuthのrefresh tokenを再発行
- Vercelの環境変数を更新
- Vercelで再デプロイ

### 9.4 Vercelでは直らない

DBやStorageを変える変更は、Vercel再デプロイだけでは反映されません。

確認:

- GitHubにpush済みか
- Vercel Deploymentが成功しているか
- Supabase migrationを適用したか
- Vercelの環境変数が正しいか

## 10. 今後の改善候補

- 文字化けファイルの修正
- 既存lint warningの解消
- 訪問写真もプランニング写真と同じくサーバーAPI経由に統一
- Supabase migration適用手順の標準化
- 管理者向け運用チェック画面の追加
- 支援者ロールを本格運用する場合の権限整理
- 請求・契約まわりのStripe連携
- 画面ごとのテスト追加

