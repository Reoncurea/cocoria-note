# cocoria note｜管理画面から招待メールを送るための設定

更新日: 2026-05-31

## 目的

管理者画面からメールアドレスを入力して、Supabaseの招待メールを送れるようにする。

## 必要な設定

Vercelの環境変数に、Supabaseの `service_role` キーと本番URLを追加する。

| 名前 | 入れる値 |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Project Settings の service_role key |
| `NEXT_PUBLIC_APP_ORIGIN` | `https://note.cocoria.net` |

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

```text
Name: NEXT_PUBLIC_APP_ORIGIN
Value: https://note.cocoria.net
Environment: Production
```

Previewでも使う場合は Preview にも追加する。

### 2-2. SupabaseのURL設定を確認する

SupabaseのAuthenticationで、次を設定する。

Site URL:

```text
https://note.cocoria.net
```

Redirect URLs:

```text
https://note.cocoria.net/auth/callback
```

VercelのURLでも確認したい場合だけ、次も残す。

```text
https://cocoria-note.vercel.app/auth/callback
```

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
パスワード設定が完了すると、自動で「確認済み」になり、そのまま利用開始できる。
管理者は管理画面で、初回設定日時と利用状態を確認する。

## 招待の再送・削除

初回確認前の招待だけ、管理画面から再送・削除できる。

- 再送: 古い未完了招待を取り消して、新しい招待メールを送る
- 削除: 未完了の招待だけを削除する

確認済みのユーザーは、この画面から削除しない。
実利用データを誤って消さないため、削除対象は初回確認前に限定している。

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

```html
<p>cocoria noteに招待されました。</p>

<p>下のボタンから初回設定を進めてください。</p>

<p>
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 20px;background:#ec6aa8;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;">
    初回設定をはじめる
  </a>
</p>

<p style="font-size:12px;color:#666666;">
  ボタンを押せない場合は、下記URLをコピーしてブラウザで開いてください。<br>
  {{ .ConfirmationURL }}
</p>

<p style="font-size:12px;color:#666666;">
  このメールに心当たりがない場合は、破棄してください。
</p>
```

`{{ .ConfirmationURL }}` はSupabaseが招待リンクに置き換えるため、削除しない。

## エラーが出たとき

### 「招待メール送信の環境設定が未完了です」

Vercelに `SUPABASE_SERVICE_ROLE_KEY` が入っていない。
環境変数を追加して再デプロイする。

### 「招待メールを送信できませんでした」

メールアドレスがすでに存在する、Supabaseのメール設定に問題がある、招待メールの送信制限にかかっている可能性がある。

SupabaseのAuthenticationで対象メールが既に存在するか確認する。
