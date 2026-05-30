# cocoria note｜管理画面から招待メールを送るための設定

更新日: 2026-05-31

## 目的

管理者画面からメールアドレスを入力して、Supabaseの招待メールを送れるようにする。

## 必要な設定

Vercelの環境変数に、Supabaseの `service_role` キーを追加する。

| 名前 | 入れる値 |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Project Settings の service_role key |

## 注意

`SUPABASE_SERVICE_ROLE_KEY` はとても強い権限を持つ。

- GitHubに書かない
- 画面に表示しない
- `.env.local` を共有しない
- VercelのEnvironment Variablesだけに入れる

このキーは、管理画面のサーバーAPIだけで使う。
ブラウザ側には出ない。

## 設定手順

### 1. Supabaseでキーを確認する

1. Supabaseを開く
2. cocoria-note のプロジェクトを開く
3. Project Settings を開く
4. API を開く
5. `service_role` のキーをコピーする

### 2. Vercelに登録する

1. Vercelを開く
2. cocoria-note のプロジェクトを開く
3. Settings を開く
4. Environment Variables を開く
5. 次を追加する

```text
Name: SUPABASE_SERVICE_ROLE_KEY
Value: Supabaseでコピーしたservice_role key
Environment: Production
```

Previewでも使う場合は Preview にも追加する。

### 3. 再デプロイする

環境変数を追加したら、Vercelで再デプロイする。

## 招待の使い方

1. cocoria noteに管理者アカウントでログイン
2. 設定を開く
3. 利用者管理を開く
4. メールアドレスを入力
5. 権限と利用状態を選ぶ
6. 招待する

招待されたユーザーは、初回確認前として登録される。
招待メールのリンクを開くと、パスワード設定画面に進む。
パスワード設定後、利用状態の確認画面が表示される。
説明が終わったら、管理画面で初回確認を「確認済み」に変更する。

## 招待メールを日本語にする

Supabase側のメールテンプレートを変更すると、日本語の招待メールにできる。

設定場所:

1. Supabaseを開く
2. Authentication を開く
3. Emails または Email Templates を開く
4. Invite user のテンプレートを編集する

件名例:

```text
cocoria noteへのご招待
```

本文例:

```text
cocoria noteに招待されました。

下記リンクから初回設定を進めてください。
{{ .ConfirmationURL }}

このメールに心当たりがない場合は、破棄してください。
```

`{{ .ConfirmationURL }}` はSupabaseが招待リンクに置き換えるため、削除しない。

## エラーが出たとき

### 「招待メール送信の環境設定が未完了です」

Vercelに `SUPABASE_SERVICE_ROLE_KEY` が入っていない。
環境変数を追加して再デプロイする。

### 「招待メールを送信できませんでした」

メールアドレスがすでに存在する、Supabaseのメール設定に問題がある、招待メールの送信制限にかかっている可能性がある。

SupabaseのAuthenticationで対象メールが既に存在するか確認する。
