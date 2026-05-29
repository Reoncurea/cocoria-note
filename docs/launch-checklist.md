# cocorianote 公開前・招待前チェックリスト

最終更新日：2026年5月29日

このチェックリストは、cocorianoteを外部利用者に案内する前に確認するためのものです。  
正式公開前は、すべてを完璧に作り込むより、個人情報・写真・利用者分離・課金状態の事故を防ぐことを優先します。

## 1. Supabase Auth

- [ ] Supabaseの `Allow new users to sign up` がOFFになっている
- [ ] Email providerはONのままになっている
- [ ] 自分の管理者アカウントでログインできる
- [ ] 招待したい利用者以外のアカウントが作られていない
- [ ] 不要なテストユーザーを削除した

## 2. 管理者・利用者プロフィール

- [ ] `user_profiles` に自分のアカウントが存在する
- [ ] 自分の `role` が `admin` になっている
- [ ] 自分の `onboarding_status` が `completed` になっている
- [ ] 自分の `subscription_status` が `active` になっている
- [ ] 招待予定ユーザーの運用ステータスを決めた

確認SQL：

```sql
select
  email,
  role,
  onboarding_status,
  subscription_status
from public.user_profiles
order by created_at desc;
```

## 3. RLS・データ分離

- [ ] `planning_sessions` が本人の顧客データに限定されている
- [ ] `planning_answers` が本人のセッションに限定されている
- [ ] `planning_suggestions` が本人のセッションに限定されている
- [ ] `visits` が本人の顧客データに限定されている
- [ ] `billing` が本人の顧客データに限定されている
- [ ] `customer_contracts` が本人の顧客データに限定されている
- [ ] `visit_billing` が本人の訪問・顧客データに限定されている
- [ ] `customer_activities` が本人の顧客データに限定されている
- [ ] `inquiries` は送信のみ公開、閲覧・更新は管理者のみになっている

確認SQL：

```sql
select
  tablename,
  policyname
from pg_policies
where schemaname = 'public'
  and tablename in (
    'planning_sessions',
    'planning_answers',
    'planning_suggestions',
    'visits',
    'billing',
    'customer_contracts',
    'visit_billing',
    'customer_activities',
    'inquiries',
    'user_profiles'
  )
order by tablename, policyname;
```

## 4. 写真アップロード

- [ ] 写真はJPEG、PNG、WebPのみアップロードできる
- [ ] 写真サイズ上限は5MBになっている
- [ ] 元ファイル名をStorage保存名に使っていない
- [ ] DB保存に失敗した場合、Storage側の写真も削除される
- [ ] 写真URLは公開URLではなく署名付きURLで表示している
- [ ] 写真アップロード前に、利用者が顧客本人・家族等から必要な同意を得る運用にしている
- [ ] 不要な人物、住所、室内、位置情報が写った写真を保存しない運用にしている

## 5. 個人情報入力ルール

- [ ] 顧客情報は業務に必要な範囲だけ入力する
- [ ] メモ欄に不要な機微情報を書きすぎない
- [ ] 家族・第三者の情報は必要最小限にする
- [ ] 問い合わせ情報の処理後ルールを決めた
- [ ] 顧客から削除・修正依頼があった場合の対応者を決めた

## 6. 公開ページ・同意導線

- [ ] `/privacy` が文字化けしていない
- [ ] `/privacy` に写真、個人情報、保存期間、削除依頼、第三者提供について書かれている
- [ ] `/terms` が表示できる
- [ ] `/terms` に利用資格、禁止事項、写真・個人情報の入力責任、免責、サブスク予定が書かれている
- [ ] ログイン画面からプライバシーポリシーと利用規約へ移動できる

## 7. Vercel・GitHub反映

- [ ] 最新コミットがGitHubの `master` にpushされている
- [ ] Vercelの最新Deploymentが成功している
- [ ] `note.cocoria.net` でログイン画面が表示される
- [ ] ログイン画面に新規登録導線が出ていない
- [ ] `/privacy` と `/terms` が本番URLで表示できる

## 8. 依存パッケージ・ビルド

- [ ] `npm run lint` がエラーなしで通る
- [ ] `npm run test` が通る
- [ ] `npm run build` が通る
- [ ] `npm audit --audit-level=moderate` が0件になっている

## 9. 招待時の運用

- [ ] 招待する相手のメールアドレスを確認した
- [ ] 利用目的と扱う情報の範囲を説明した
- [ ] 写真アップロード時の同意取得ルールを説明した
- [ ] 試用期間・無料期間・有料化予定を説明した
- [ ] 初回利用後に問題がないか確認する日を決めた

## 10. サブスク課金前チェック

- [ ] `subscription_status` の運用ルールを決めた
- [ ] `trialing`、`active`、`past_due`、`canceled` の意味を決めた
- [ ] 未払い・解約時にどの画面を制限するか決めた
- [ ] Stripe等の決済サービスを使うタイミングを決めた
- [ ] 料金、支払方法、解約条件を利用規約または案内文に反映する準備がある

## まず外部1人に試してもらう前の最低ライン

- [ ] Supabaseの新規サインアップがOFF
- [ ] 自分がadmin
- [ ] RLS確認SQLで想定ポリシーが出る
- [ ] Vercel最新デプロイ成功
- [ ] `/privacy` と `/terms` が読める
- [ ] 写真アップロード制限が本番に反映済み
- [ ] 招待相手に「写真・個人情報は必要最小限」と説明済み
