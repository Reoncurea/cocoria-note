# cocorianote 初回招待ユーザー運用フロー

最終更新日：2026年5月30日

この手順書は、cocorianoteを外部の人に初めて試してもらうときの運用フローです。  
当面はコストをかけず、Supabase Auth、`user_profiles`、手動確認で運用します。

## 全体方針

- 利用開始は招待制にする
- 最初は1人ずつ招待する
- 顧客情報・写真・訪問記録の扱いを事前に説明する
- 課金はまだ自動化しない
- `subscription_status` は手動で管理する
- 問題が出たら、次の人を招待する前に修正する

## 1. 招待前に確認すること

### Supabase

- [ ] `Allow new users to sign up` がOFF
- [ ] Email providerがON
- [ ] 自分の管理者アカウントでログインできる
- [ ] 自分の `user_profiles.role` が `admin`
- [ ] RLS確認SQLで想定ポリシーが表示される

### Vercel・アプリ

- [ ] Vercelの最新Deploymentが成功している
- [ ] `note.cocoria.net/login` が表示できる
- [ ] ログイン画面に新規登録導線が出ていない
- [ ] `/privacy` が読める
- [ ] `/terms` が読める
- [ ] 写真アップロード制限が反映されている

### 招待相手

- [ ] 招待相手のメールアドレスを確認した
- [ ] 試用目的を確認した
- [ ] 入力してよいデータの範囲を説明できる
- [ ] 写真アップロードの同意ルールを説明できる
- [ ] 試用期間・無料期間・有料化前の扱いを説明できる

## 2. Supabaseでユーザーを招待する

Supabaseの管理画面で行います。

1. Supabaseの対象プロジェクトを開く
2. `Authentication` を開く
3. `Users` を開く
4. `Add user` または `Invite user` を選ぶ
5. 招待相手のメールアドレスを入力する
6. 招待メールを送信する

招待後、SQL Editorで `user_profiles` を確認します。

```sql
select
  user_id,
  email,
  role,
  onboarding_status,
  subscription_status,
  invited_at,
  accepted_at
from public.user_profiles
order by created_at desc;
```

もし招待ユーザーの行がない場合は、対象メールを入れて手動で作成します。

```sql
insert into public.user_profiles (
  user_id,
  email,
  role,
  onboarding_status,
  subscription_status,
  invited_at
)
select
  id,
  email,
  'user',
  'pending',
  'trialing',
  now()
from auth.users
where email = 'invitee@example.com'
on conflict (user_id) do nothing;
```

`invitee@example.com` は招待相手のメールアドレスに置き換えます。

## 3. 招待時に伝えること

招待メールや個別メッセージでは、最低限これを伝えます。

- cocorianoteは招待制の試用段階であること
- 顧客情報や写真は必要最小限だけ入力すること
- 実在顧客の情報を入れる場合は、必要な同意を得ること
- 写真には人物・住居・生活状況が写り込む可能性があること
- 不要な写真、同意のない写真、第三者が写る写真は保存しないこと
- 不具合や不安な点があればすぐ連絡してほしいこと
- 現時点では有料課金は開始していないこと

### 送信用テンプレート

```text
〇〇さん

cocorianoteの試用アカウントを招待しました。
以下のURLからログインしてください。

https://note.cocoria.net/login

利用前に、プライバシーポリシーと利用規約をご確認ください。
顧客情報・訪問記録・写真は、業務に必要な範囲だけ入力してください。
写真をアップロードする場合は、本人やご家族など必要な方の同意を得たうえでお願いします。

現在は招待制の試用段階です。
不具合や気になる点があれば、遠慮なく連絡してください。
```

## 4. 初回ログイン後に確認すること

招待相手が初回ログインしたら、以下を確認します。

- [ ] ログインできた
- [ ] 顧客一覧が空、または本人のデータだけ表示される
- [ ] 他の利用者のデータが見えない
- [ ] 顧客登録ができる
- [ ] 訪問記録が作れる
- [ ] 写真アップロードができる
- [ ] 5MB超の写真が拒否される
- [ ] JPEG、PNG、WebP以外が拒否される
- [ ] `/privacy` と `/terms` を確認してもらった

## 5. 初回利用後のヒアリング

初回利用後、できれば当日または翌日に確認します。

- ログインで迷ったところはあったか
- 顧客登録で入力しづらい項目はあったか
- 訪問記録の流れは自然だったか
- 写真アップロードで困ったことはあったか
- 個人情報の扱いで不安な点はあったか
- 必要な削除・修正操作が分かりやすいか
- 継続利用するなら何が足りないか

## 6. ステータス更新

初回説明が終わり、利用を開始できる状態になったら、必要に応じて `onboarding_status` を更新します。

```sql
update public.user_profiles
set
  onboarding_status = 'completed',
  accepted_at = coalesce(accepted_at, now()),
  updated_at = now()
where email = 'invitee@example.com';
```

継続利用を許可する場合は、当面は `subscription_status = 'trialing'` のままで構いません。  
有料化を開始した後に、`active`、`past_due`、`canceled` の運用へ切り替えます。

## 7. 問題が起きた場合

### ログインできない

- メールアドレスが正しいか確認する
- SupabaseのUsersに対象ユーザーが存在するか確認する
- Email providerがONか確認する
- `Allow new users to sign up` はOFFのままでよい

### データが見えない

- 対象ユーザーの `user_profiles` が存在するか確認する
- そのユーザーで作成した顧客データか確認する
- RLSポリシーが消えていないか確認する

### 他人のデータが見える

- すぐに利用を停止する
- 該当ユーザーにログアウトを依頼する
- SupabaseのRLSポリシーを確認する
- 問題が解決するまで次の招待を止める

### 写真アップロードで不安がある

- 不要な写真は削除する
- 写真の同意取得状況を確認する
- 顧客や家族が写る写真は、保存が本当に必要か見直す

## 8. 2人目を招待する前の確認

- [ ] 1人目の利用でデータ分離の問題が出ていない
- [ ] 写真アップロードの運用に問題が出ていない
- [ ] 使い方の説明文が不足していない
- [ ] 削除・修正依頼への対応方法が決まっている
- [ ] 次の招待相手にも同じ説明ができる

## 最低限の合格ライン

外部1人目の試用を始める条件は、以下を満たすことです。

- Supabaseの新規サインアップがOFF
- 自分がadmin
- Vercel最新デプロイ成功
- `/privacy` と `/terms` が読める
- 招待相手に写真・個人情報の注意点を説明済み
- 初回利用後にヒアリングする予定がある
