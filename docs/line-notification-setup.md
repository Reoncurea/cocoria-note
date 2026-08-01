# LINE通知の設定手順

毎朝、その日にやることをLINEに送るための設定です。
コードは入っていますが、**環境変数を入れるまでは何も送信されません**（安全側に倒してあります）。

送られる内容:

- 今日の訪問
- 明日の訪問（前日確認のリマインド）
- 同じステータスのまま止まっている顧客と、その「次のタスク」
- 未送信の報告書
- 未入金

何も無い日は送信しません。

---

## 1. LINE公式アカウントとMessaging APIチャネルを用意する

1. [LINE Developers](https://developers.line.biz/console/) にログイン
2. プロバイダーを作成（例: `cocoria`）
3. 「新規チャネル作成」→ **Messaging API** を選ぶ
4. チャネル名・説明・業種を入力して作成

すでにcocoriaの公式LINEがある場合は、そのチャネルを使えます。

> 注意: 以前あった LINE Notify は 2025年3月末で終了しています。
> 今から作るなら Messaging API です。

## 2. チャネルアクセストークンを取得する

1. 作成したチャネルの「Messaging API設定」タブを開く
2. 一番下の「チャネルアクセストークン（長期）」で **発行** を押す
3. 表示された文字列をコピー

これが `LINE_CHANNEL_ACCESS_TOKEN` です。**絶対にGitHubに書かないでください。**

## 3. 送信先のユーザーIDを調べる

通知は「自分のLINEアカウント宛」に送ります。そのためのユーザーIDが必要です。

1. 「Messaging API設定」タブのQRコードから、**自分のLINEでその公式アカウントを友だち追加**する
2. 同じタブの「Webhook URL」は未設定のままでOK
3. ユーザーIDは、チャネル基本設定タブの「あなたのユーザーID」に表示されます（`U` から始まる33文字）

これが `LINE_NOTIFY_TO` です。

## 4. Vercelに環境変数を登録する

Vercel → プロジェクト → Settings → Environment Variables で、以下を **Production** に追加します。

| 名前 | 値 |
| --- | --- |
| `LINE_CHANNEL_ACCESS_TOKEN` | 手順2でコピーしたトークン |
| `LINE_NOTIFY_TO` | 手順3のユーザーID |
| `CRON_SECRET` | 自分で決めた長いランダム文字列 |

`CRON_SECRET` は、定期実行のリクエストが本物か確かめるための合言葉です。
未設定だと通知APIは常に401を返します（外部から叩かれないようにするため）。

生成例:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

登録したら **再デプロイ** してください。環境変数はデプロイ時に読み込まれます。

## 5. 送信時刻

`vercel.json` に設定済みです。

```json
{ "path": "/api/cron/daily-alerts", "schedule": "0 23 * * *" }
```

Vercel CronはUTCで動くため、`23:00 UTC` = **日本時間 朝8:00** です。
時刻を変えたいときは、希望時刻から9時間引いた値を書いてください。

| 送りたい時刻（日本） | schedule |
| --- | --- |
| 6:00 | `0 21 * * *` |
| 7:00 | `0 22 * * *` |
| 8:00 | `0 23 * * *` |
| 9:00 | `0 0 * * *` |
| 21:00 | `0 12 * * *` |

> Vercelの無料プラン（Hobby）は **cronが1日1回まで** です。
> 朝と夜の2回送りたい場合はProプランが必要です。

## 6. 動作確認

デプロイ後、手元から叩いて確認できます。

```bash
curl -H "Authorization: Bearer ここにCRON_SECRET" https://note.cocoria.net/api/cron/daily-alerts
```

返ってくる内容:

| 応答 | 意味 |
| --- | --- |
| `{"sent":true,...}` | 送信できた |
| `{"sent":false,"reason":"nothing_to_report"}` | 今日は知らせることが無い（正常） |
| `401` | `CRON_SECRET` が違う、または未設定 |
| `503` | LINEの環境変数が未設定 |
| `502` | LINE側でエラー。トークンかユーザーIDを確認 |

## 7. うまくいかないとき

| 症状 | 見るところ |
| --- | --- |
| 401が返る | Vercelに `CRON_SECRET` が入っているか。再デプロイしたか |
| 503が返る | `LINE_CHANNEL_ACCESS_TOKEN` と `LINE_NOTIFY_TO` の両方が入っているか |
| 502が返る | トークンの有効期限、公式アカウントを友だち追加しているか |
| 何も届かない | Vercel → Deployments → Functions のログで `/api/cron/daily-alerts` を確認 |
| 時刻がずれる | UTCとの9時間差を計算し直す |

## 8. 通知内容を変えたい

送る内容は `src/lib/notify/daily-alerts.ts` にまとまっています。
「止まっている」と判定するまでの日数は、ステータスごとに
`src/lib/constants/pipeline.ts` の `staleAfterDays` で決めています。
