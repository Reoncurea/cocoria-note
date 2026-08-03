# cocoria-note Wiki

最終更新: 2026-08-01

## 1. このアプリの目的

cocoria-note は、産後ケア・産後パートナー事業の顧客対応を管理するための業務アプリです。

主に次の情報を一元管理します。

- 顧客基本情報
- 赤ちゃん・家族情報
- 顧客ごとの進行ステータス（15段階）と「次のタスク」
- プランニング情報
- 訪問記録・訪問チェックリスト
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

- 進行ステータスの確認・変更と「次のタスク」の確認
- 基本情報の確認（住所からGoogleマップ・経路を開ける）
- 交通情報（最寄駅・経路・交通費）の確認
- 次回の訪問予定・前回の訪問内容の確認
- 赤ちゃん情報の確認
- 請求・入金状況の確認
- 最新プランニング情報の確認
- プランニング情報の直接修正
- 担当者メモの追加
- プランニング写真の追加・メモ編集・削除
- 契約履歴の確認

主な実装:

```text
src/app/(dashboard)/customers/[id]/page.tsx            サーバー側でまとめて取得
src/app/(dashboard)/customers/[id]/CustomerDetailClient.tsx  画面
src/components/customer/StageCard.tsx                  進行ステータス
src/components/customer/ContractHistory.tsx
```

### 2.3.1 進行ステータス（15段階）

顧客ごとに、いまどこまで進んでいるかを1〜15の段階で持ちます。
段階ごとに「次にやること」が決まっていて、顧客詳細・顧客一覧・ダッシュボードに出ます。

| # | ステータス | 次のタスク | 定期利用 |
| --- | --- | --- | --- |
| 1 | 問い合わせ | 申込フォームを案内する | |
| 2 | 申込フォーム受領 | カルテに転記して交通費を確認する | |
| 3 | 交通費確認中 | 交通経路と交通費を確定する | |
| 4 | 日程調整中 | 訪問日の候補を出して決める | |
| 5 | 日程確定 | 契約書を送付する | |
| 6 | 契約送付済み | 契約の締結を確認する | |
| 7 | 契約締結済み | 訪問前日の確認連絡をする | |
| 8 | 前日確認済み | 訪問して記録を取る | |
| 9 | 訪問完了 | 報告書を作成して送付する | |
| 10 | 報告書送付済み | アンケートを送る | |
| 11 | アンケート送付済み | 請求書を発行して送る／定期利用は次回案内へ | 文言が変わる |
| 12 | 請求済み | 入金を確認する | **飛ばす** |
| 13 | 入金済み | 次回のご利用を案内する | **飛ばす** |
| 14 | 次回案内済み | 返答を受けて次回予約か完了にする | |
| 15 | 完了・継続利用 | （対応中のタスクなし） | |

### 2.3.1 古いステータスは廃止（2026-08-03）

以前は `customers.status`（活動中／契約済み／終了）という3段階のステータスがあり、
15段階の進行ステータスと**両方が画面に出ていました**。連動していないため、
「終了」と「5. 日程確定」が並ぶような矛盾した表示になっていました。

15段階が古い3段階を完全に含んでいるので、**古いほうは画面から外しました。**

- 顧客名の隣のバッジ → 進行ステータス＋保留バッジに置き換え
- カルテ編集のステータス欄 → 削除
- 新規登録のステータス欄 → 削除
- CSV出力 → 進行ステータス・追跡状態・定期利用を出すよう変更
- `src/lib/constants/statuses.ts` → どこからも使われていなかったので削除

**DBの `status` 列は残してあります**（データは消していない）。
新規登録時はDB既定値の「活動中」が入りますが、どこにも表示されません。
完全に消したくなったら、列の削除は別途migrationで行ってください。

### 2.3.2 2回目以降の進め方（2026-08-03 追加）

**スポット・初回の方は、訪問予定を登録した時点でステータスが自動で進みます。**
2回目以降にステータスを手で戻す必要はありません。

自動で進む条件:

| いまの段階 | 訪問を登録すると |
| --- | --- |
| 4. 日程調整中 | → 5. 日程確定 |
| 14. 次回案内済み | → 5. 日程確定 |
| 15. 完了・継続利用 | → 5. 日程確定 |
| 上記以外 | **変わらない** |

契約や請求の途中（6〜13）にいる顧客を勝手に飛ばすと、抜けに気づけなくなるため
動かしません。1〜3（問い合わせ〜交通費確認）も、交通費の確認を抜かさないよう
そのままにしています。

判定は `stageAfterVisitScheduled()` の1か所にまとめてあります。

**定期利用の方は、段階を回しません。**

毎週の訪問ごとに8段階を手で動かすのは現実的でないため、
ステータスは「15. 完了・継続利用」のまま置き、
進捗は**訪問チェックリスト**と**訪問予定一覧**で見ます。請求は月末にまとめて行います。
顧客詳細のステータスカードにその案内と「完了・継続利用に戻す」ボタンを出しています。

> 未対応: 定期利用の方の**月末請求のリマインドはまだありません。**
> いまはカレンダー等で自力管理する前提です。

### 2.3.3 保留・待ち（2026-08-03 追加）

進行ステータスとは**別軸**で「いま追わない」を持たせています。
ステータスはそのまま残るので、解除すれば元の段階から再開できます。

| 状態 | 意味 | 使う場面 |
| --- | --- | --- |
| 通常 | 追いかける | 既定 |
| **待ち** | そのうち動く見込みがある | 産前に申込があり、出産の連絡待ち |
| **保留** | こちらからは追わない | 問い合わせ・申込は来たが契約に至らなかった |

止めているあいだの挙動:

- 要対応アラート・ダッシュボードの「今日やること」・LINE通知に**出ません**
- 滞留日数のカウントも止まります
- 顧客一覧では既定で**隠れます**。「保留・待ち N」ボタンで切り替えて見られます
- 進行ステータスと入力済みの情報はそのまま残ります

**再開予定日**（`hold_until`）を入れると、その日が来た時点で自動的に通常へ戻り、
アラートにも復帰します。空のままなら、手動で解除するまで通知は一切出ません。

解除すると `stage_updated_at` を現在時刻に更新します。
止めていた期間の分だけ、解除直後に「放置」と判定されるのを防ぐためです。

判定は必ず `needsFollowUp()` を使うこと（`isStale()` は保留を見ません）。

```text
src/lib/constants/pipeline.ts    isOnHold / needsFollowUp / HOLD_LABEL など
src/components/customer/HoldCard.tsx
src/app/api/customers/[id]/hold/route.ts
```

### 請求のタイミング（2026-08-02 ユーザー確認）

| 契約形態 | 請求のタイミング |
| --- | --- |
| スポット契約・初回利用 | **アンケート送付済みのあと**（11 → 12 → 13 → 14） |
| 定期利用 | **月末にまとめて請求**。訪問ごとの流れでは請求しない（11 → 14） |

定期利用の判定はカルテの「定期利用」チェックボックス（`customers.is_recurring`）です。
定期利用の顧客では、

- 「完了して次へ進む」ボタンが 12・13 を飛ばす
- ステータス選択の一覧では 12・13 が薄く表示され「月末請求のため通常は使いません」と出る
- 11 の次のタスクが「次回のご利用を案内する（請求は月末）」に変わる

手動で 12・13 を選ぶことは可能です（月末請求の記録に使う場合）。

段階ごとに「この日数を超えたら止まっている扱い」の目安を持っています。
超えると、顧客一覧・ダッシュボード・LINE通知にアラートとして出ます。

定義の正本:

```text
src/lib/constants/pipeline.ts
```

段階を増減するときは、ここと migration の check 制約の両方を直してください。

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
- **チャットを使わず、わかっている項目だけフォームで先に入力**（`/form`）
- カルテの氏名・住所・電話・メールを、空欄の項目へまとめて流し込み
- 回答内容の編集
- 提案・レビュー
- PDF向け出力
- 顧客詳細から最新プランニング情報を直接修正

フォーム一括入力の画面:

```text
/customers/[id]/planning/[sessionId]/form
```

セクション単位で開閉でき、セクションごとにも、まとめてでも保存できます。
条件つきで表示されるセクションは、チェックを入れるとすべて出せます。

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

- 訪問予定の登録（日時だけ先に登録できる）
- **訪問チェックリスト（5フェーズ・全47項目）**
- 訪問しながらの呼吸チェック・作業記録
- 訪問時間、休憩、交通手段の記録
- 前回訪問の内容・申し送りの確認
- Googleマップ・経路を開く
- 訪問写真の追加
- 報告書画面の確認

主な実装:

```text
src/app/(dashboard)/customers/[id]/visits/new/page.tsx       訪問を登録（1ステップ）
src/app/(dashboard)/customers/[id]/visits/[visitId]/         作業画面
src/components/visit/VisitChecklist.tsx                      チェックリスト
src/components/visit/BreathCheckTable.tsx                    呼吸チェック
src/components/visit/ServiceRecordQuickAdd.tsx               作業記録のタップ入力
src/lib/constants/visit-checklist.ts     項目定義（正本）
src/lib/visits/checklist-context.ts      カルテ・プランニングからの自動表示
src/lib/uploads/photos.ts
```

### 2.5.0 訪問記録の流れ（2026-08-03 に作り直し）

**訪問記録は「訪問より先に作るもの」です。** 訪問が終わってから書くのではありません。

```text
1. 訪問履歴タブ →「＋記録」
   日時・訪問手段・休憩・サポート内容だけ登録する（1ステップ）
        ↓
2. 作業画面（訪問詳細ページ）へ自動で移動
   ① 訪問前チェック        ← 前日までにここを埋める
   ② 訪問開始時チェック
   ③ 訪問中の記録 ＋ 呼吸チェック ＋ 作業記録のタップ入力
   ④ 訪問終了時チェック
   ⑤ 帰宅後チェック
        ↓
3. チェックリストの一番下「詳細な対応履歴を入力 →」
   ※ この画面の一番下に「この訪問記録を削除する」もあります
        ↓
4. 対応履歴の入力（作業記録の整形・メッセージ・非公開メモ・写真）
        ↓
5. 一番下の「保存して報告書を作成 →」
```

訪問記録を削除すると、チェックリスト・呼吸チェック・作業記録・写真・
その訪問の請求も連動して消えます（`on delete cascade`）。
訪問写真は、DBの行だけ消してもストレージにファイルが残るため、
削除時にストレージからも消しています。

作業画面はすべて自動保存です。訪問中にアプリを閉じても内容は残ります。
画面を開くと、**まだ終わっていない最初のフェーズが自動で開きます。**

各フェーズの一番下に「たたむ」と「次のフェーズ →」を置いています。
入力後に見出しまでスクロールして戻る必要はありません。

#### 画面をまたいでも内容が消えないようにしている

チェックリスト・呼吸チェック・作業記録は、**画面を開いた時点でDBから取り直します**
（`VisitChecklist` / `BreathCheckTable` / `ServiceRecordQuickAdd` の同期用 useEffect）。

これが無いと、対応履歴の画面へ行って戻ったときに、ブラウザが前の表示を
再利用して**チェックが消えたように見えます**（DBには保存されている）。
2026-08-03 に実際に踏んだ不具合なので、これらのコンポーネントから
同期処理を消さないこと。

#### なぜこの形にしたか

以前は「＋記録」が2ステップのフォームで、作業記録・メッセージ・メモまで
入力して保存しないと訪問記録が作られませんでした。そのため、

- 訪問前チェック（前日にやりたい）が、訪問後にしか開けない
- 呼吸チェック（訪問中に5分ごとに押したい）が、保存後にしか開けない
- 作業記録のタップ入力が、フォームの中にしかなく訪問中に使いにくい

という状態でした。**記録が存在するタイミングが実際の作業より後ろ**だったのが原因です。
訪問の枠を先に作る形に変えて解消しました。

### 2.5.1 訪問チェックリスト

| フェーズ | 内容 |
| --- | --- |
| 訪問前チェック | 日時・住所・交通費・プラン・契約/支払い・アレルギー・緊急連絡先・持参物など |
| 訪問開始時チェック | 体調・赤ちゃんの様子・本日の希望・優先順位・終了希望時刻・写真可否 |
| 訪問中の記録 | 開始時刻・実施作業・料理名と保存方法・お世話内容・ヒヤリハット・事故 |
| 訪問終了時チェック | 実施報告・未完了の説明・保存/温め方・忘れ物・破損確認・終了時刻・次回希望 |
| 帰宅後チェック | 記録確定・PDF作成・報告書送付・お礼・アンケート・経費/売上登録・次回予約 |

- チェックの状態は `visits.checklist`（JSONB）に入ります
- 項目定義はアプリ側（`src/lib/constants/visit-checklist.ts`）が正本なので、
  **項目を増減してもDB変更は不要**です
- 訪問前チェックの項目は、カルテとプランニング情報から中身を自動で表示します
  （住所・最寄駅・交通費・アレルギー・緊急連絡先など）
- 入力は自動保存です（0.7秒待ってからまとめて送信）
- **「訪問中の記録」フェーズの中に、呼吸チェック表と作業記録のタップ入力が入っています**
  （`VisitChecklist` の `phaseExtras` で差し込んでいます）

### 2.5.2 訪問予定一覧

場所:

```text
/schedule
```

できること:

- 全顧客をまたいだ訪問予定の確認（これから／過去）
- 定期利用の方だけに絞り込み
- 定期利用者の一覧と利用パターンの確認
- 報告書が未送信の訪問の把握

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
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE通知用。未設定なら通知は送られない |
| `LINE_NOTIFY_TO` | LINE通知の送信先ユーザーID |
| `CRON_SECRET` | 定期実行APIの合言葉。未設定なら通知APIは常に401 |
| `APP_SESSION_CACHE_SECRET` | 認証チェックのキャッシュ署名鍵（任意） |

`APP_SESSION_CACHE_SECRET` は未設定でも動きます。その場合は
`SUPABASE_SERVICE_ROLE_KEY` を署名鍵として使い、どちらも無ければ
キャッシュを使わず毎回Supabaseへ問い合わせます（遅くなるだけで、動作はします）。

注意:

- `SUPABASE_SERVICE_ROLE_KEY` はGitHubへ書かない
- `.env.local` は共有しない
- VercelのEnvironment Variablesに本番値を登録する

### 3.5 表示速度の作り（2026-08-01に見直し）

以前は、ページを開くたびに次の3つが順番に走っていました。

1. middleware で `auth.getUser()`（Supabaseへ1往復）
2. middleware で `user_profiles` の照会（もう1往復）
3. 画面が出てから、クライアント側でデータ取得を開始

そのため「移動 → 空のスピナー → やっとデータ」になっていました。
いまは次の形にしています。

| やったこと | 実装 |
| --- | --- |
| 認証チェックの結果を60秒だけ使い回す | `src/lib/supabase/gate-cache.ts` |
| 主要画面をサーバー側で描画（データ入りHTMLを返す） | 各 `page.tsx` |
| 移動中はスケルトンを出す | 各 `loading.tsx` |
| 写真の署名URLを1回でまとめて発行 | `src/lib/uploads/signed-urls.ts` |

キャッシュはCookieに置きますが、必ずHMAC署名を付け、Supabaseの認証Cookieの
中身を署名に含めています。ログアウトやトークン更新でCookieが変われば、
キャッシュは自動的に外れます。データ本体はSupabaseのRLSで守られており、
ここで判定しているのは「画面に入れるかどうか」だけです。

サーバー側で描画している画面:

```text
/dashboard
/customers
/customers/[id]
/customers/[id]/visits
/customers/[id]/visits/[visitId]
/customers/[id]/planning/[sessionId]/form
/schedule
```

これらは `page.tsx` がサーバーでデータを取り、画面部分だけを
`*Client.tsx` に渡す形になっています。**画面に手を入れるときは
`*Client.tsx` を、取得するデータを変えるときは `page.tsx` を触ります。**

### 3.6 LINE通知（毎朝のアラート）

Vercel Cron が毎朝 `/api/cron/daily-alerts` を呼び、その日のやることを
LINEに送ります。**環境変数を入れるまでは何も送信されません。**

送る内容:

- 今日の訪問
- 明日の訪問（前日確認のリマインド）
- 同じステータスのまま止まっている顧客と、その「次のタスク」
- 未送信の報告書
- 未入金

何も無い日は送信しません。

```text
src/lib/notify/line.ts          LINEへの送信
src/lib/notify/daily-alerts.ts  本文の組み立て
src/app/api/cron/daily-alerts/route.ts
vercel.json                     実行時刻（UTC）
```

設定手順 → `docs/line-notification-setup.md`

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
| `customer_stage_events` | 進行ステータスの変更履歴 |
| `inquiries` | 問い合わせ |
| `user_profiles` | 権限・利用状態 |

2026-08-01 に追加した列:

| テーブル | 列 | 用途 |
| --- | --- | --- |
| `customers` | `pipeline_stage` | 進行ステータス（15段階） |
| `customers` | `stage_updated_at` | ステータスが最後に変わった日時。滞留判定に使う |
| `customers` | `stage_note` | ステータスへの補足メモ |
| `customers` | `nearest_station` / `route_note` / `transport_fee` | 交通情報 |
| `customers` | `is_recurring` / `recurring_note` | 定期利用かどうかとパターン |
| `visits` | `checklist` | 訪問チェックリストの状態（JSONB） |

2026-08-03 に追加した列:

| テーブル | 列 | 用途 |
| --- | --- | --- |
| `customers` | `hold_state` | 追跡状態（active / waiting / paused） |
| `customers` | `hold_reason` | 止めている理由 |
| `customers` | `hold_until` | この日が来たら自動で通常へ戻る |

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
20260609_add_photo_upload_option.sql
20260801_add_pipeline_and_visit_checklist.sql
20260803_add_customer_hold.sql
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
20260801_add_pipeline_and_visit_checklist.sql
20260803_add_customer_hold.sql
```

`20260803_add_customer_hold.sql` は列を足すだけで、既存データは変わりません
（全員 `hold_state = 'active'`＝通常のまま）。適用しないと顧客一覧・顧客詳細・
ダッシュボードでエラーになるので、コードのデプロイと同時に適用してください。

`20260801_add_pipeline_and_visit_checklist.sql` を適用するまでは、
顧客一覧・顧客詳細・ダッシュボード・訪問予定が正しく表示されません
（`pipeline_stage` などの列がまだ無いため）。**コードのデプロイと同時に適用してください。**

このmigrationは最後に、既存の顧客のステータスを実績から推定して引き上げます
（契約履歴があれば「契約締結済み」、訪問実績があれば「訪問完了」、報告書送信済みなら
「報告書送付済み」）。あくまで推定なので、**適用後に顧客一覧で実態と合っているか
確認して、違うものは画面から直してください。**

### 6.3 本番確認

最低限見る画面:

- `/login`
- `/dashboard`
- `/customers`
- `/customers/[id]`
- `/customers/[id]/planning`
- `/customers/[id]/planning/[sessionId]/form`
- `/customers/[id]/visits`
- `/customers/[id]/visits/[visitId]`
- `/schedule`
- `/admin/users`

最低限見る動作:

- ログインできる
- 顧客一覧が表示される（ステータスのバッジと「次のタスク」が出る）
- 顧客詳細が表示される
- 進行ステータスを変更でき、変更後に画面へ反映される
- プランニング情報を編集できる
- フォーム一括入力で保存できる
- プランニング写真を追加できる
- 訪問記録を作成できる
- 訪問チェックリストにチェックを入れると保存される
- 訪問予定一覧が表示される
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

### 8.1 文字化けの件は解消済み（2026-08-01 確認）

以前ここに「docsや定数に文字化けが残っている」と書いてありましたが、
2026-08-01 時点で対象ファイルを確認したところ、いずれも正常に読めます。
この注意書きは古くなっていたので取り消しました。

### 8.2 lint warningが残っている

`npm run lint` は成功しますが、既存のReact Hooks warningなどが残っています（0 errors / 23 warnings）。

主な対象:

```text
customers/[id]/edit
customers/[id]/billing
customers/[id]/activities/[activityId]
customers/[id]/visits/new
customers/[id]/visits/[visitId]/edit
customers/[id]/visits/[visitId]/report
customers/[id]/planning/[sessionId]/export
CocoriaLogo
BottomNav
```

2026-08-01 の作り替えで、`dashboard` `customers` `customers/[id]`
`customers/[id]/visits` `customers/[id]/visits/[visitId]` `ContractHistory`
のwarningは解消しました。

新規機能を追加するときは、触ったファイルのwarningは増やさない方針にします。

### 8.3 DB migrationは自動反映されない

GitHubへpushしてVercelが成功しても、SupabaseのDB変更は別途反映が必要です。

### 8.4 【要対応】LINE通知は利用者が2人以上になると使えない

**利用者を増やす前に、必ずここを直してください。**

#### 何が問題か

`/api/cron/daily-alerts` は定期実行から呼ばれるため、ログインセッションがありません。
そのため `SUPABASE_SERVICE_ROLE_KEY` でDBを読んでおり、**RLSを迂回します。**
そのうえ `src/lib/notify/daily-alerts.ts` のクエリは
**`user_id` で絞り込んでいません。**

宛先も `LINE_NOTIFY_TO`（環境変数）で全体に1つだけです。

結果、利用者が2人以上になると
**全員分の顧客名・訪問予定が、1つのLINEアカウントにまとめて届きます。**
産後ケアの顧客情報なので、実運用に入る前の対応が必須です。

1人運用の現在は実害がないため、2026-08-02時点では未対応のままにしています
（ユーザー判断）。

#### 直し方

**A. データの分離（必須）**

`src/lib/notify/daily-alerts.ts` の各クエリに `.eq('user_id', userId)` を足し、
利用者ごとにメッセージを組み立てる。`buildDailyAlert()` を
`buildDailyAlert(userId)` に変え、cronルート側で利用者ごとに回す。

customers / visits / visit_billing はいずれも `user_id` を持っているので、
絞り込み自体はすぐできます。

**B. 宛先を利用者ごとに持つ（必須）**

`user_profiles` に列を追加する。

```sql
alter table public.user_profiles
  add column if not exists line_user_id text,
  add column if not exists line_notifications_enabled boolean not null default false;
```

`LINE_NOTIFY_TO` は廃止し、
`line_notifications_enabled = true` かつ `line_user_id` が入っている利用者だけに送る。
`LINE_CHANNEL_ACCESS_TOKEN`（送信元）は全体で1つのままでよい。

**C. 各自が自分のLINEユーザーIDをどう知るか**

| 方法 | 手間 | 備考 |
| --- | --- | --- |
| 管理者が手入力 | 小 | 数人までならこれで十分。当面の想定 |
| LINEログイン連携 | 中 | 利用者はボタンを押すだけ。LINEログインチャネルが必要 |
| 公式LINEに合言葉を送ってもらう | 中 | Webhookを立てて、送信者IDとアカウントを紐づける |

まずは「管理者が手入力」で始め、人数が増えたら自動化を検討する。

> ユーザーIDはプロバイダー単位で発行されます。cocoria公式LINEを
> 友だち追加していない人には、そもそもpushが届きません。

### 8.5 古いworktreeがlintの対象に入っている

`.claude/worktrees/` に過去の作業コピーが残っており、`npm run lint` が
そこも走査しています。同じwarningが二重に出るので、不要なら削除するか
`eslint.config.mjs` の ignores に加えてください。

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

### 9.4 顧客一覧やダッシュボードが空になる

`20260801_add_pipeline_and_visit_checklist.sql` が本番DBに未適用だと、
`pipeline_stage` などの列が無いためクエリが失敗し、一覧が空で表示されます。

対応:

- Supabaseに `20260801_add_pipeline_and_visit_checklist.sql` を適用する

### 9.5 LINE通知が届かない

原因候補と確認先は `docs/line-notification-setup.md` の「7. うまくいかないとき」を参照。

手早い切り分け:

```bash
curl -H "Authorization: Bearer ここにCRON_SECRET" https://note.cocoria.net/api/cron/daily-alerts
```

### 9.6 ステータスを変えたのに画面が変わらない

進行ステータスの変更は `PATCH /api/customers/[id]/stage` で保存し、
`router.refresh()` でサーバー側を取り直しています。
変わらない場合は、ブラウザのコンソールとVercelの関数ログを確認してください。

### 9.7 Vercelでは直らない

DBやStorageを変える変更は、Vercel再デプロイだけでは反映されません。

確認:

- GitHubにpush済みか
- Vercel Deploymentが成功しているか
- Supabase migrationを適用したか
- Vercelの環境変数が正しいか

## 10. 今後の改善候補

- **【利用者を増やす前に必須】LINE通知の利用者ごとの分離（8.4）**
- 定期利用の方の月末請求リマインド（2.3.2 の未対応事項）
- 残りのlint warningの解消（8.2の一覧）
- 残りの画面（請求・活動履歴・訪問の新規/編集）もサーバー描画へ寄せる
- 顧客フォームのzodスキーマが3か所に分かれているので1つにまとめる
- 訪問写真もプランニング写真と同じくサーバーAPI経由に統一
- Supabase migration適用手順の標準化
- 進行ステータスの自動更新（報告書を送ったら「報告書送付済み」へ、など）
- 訪問チェックリストの内容を報告書PDFへ流し込む
- 管理者向け運用チェック画面の追加
- 支援者ロールを本格運用する場合の権限整理
- 請求・契約まわりのStripe連携
- 画面ごとのテスト追加

## 11. 2026-08-01 の変更まとめ

| 内容 | 主な追加ファイル |
| --- | --- |
| 表示速度の改善（サーバー描画・認証キャッシュ・スケルトン） | `src/lib/supabase/gate-cache.ts`, 各 `loading.tsx`, `src/lib/uploads/signed-urls.ts` |
| 進行ステータス15段階と「次のタスク」 | `src/lib/constants/pipeline.ts`, `src/components/customer/StageCard.tsx`, `src/app/api/customers/[id]/stage/route.ts` |
| フォーム一括入力 | `src/app/(dashboard)/customers/[id]/planning/[sessionId]/form/` |
| 訪問チェックリスト | `src/lib/constants/visit-checklist.ts`, `src/lib/visits/checklist-context.ts`, `src/components/visit/VisitChecklist.tsx`, `src/app/api/visits/[visitId]/checklist/route.ts` |
| 前回訪問内容の表示・Googleマップ | `src/lib/maps.ts` ほか顧客詳細・訪問詳細 |
| 訪問予定一覧 | `src/app/(dashboard)/schedule/` |
| LINE通知 | `src/lib/notify/`, `src/app/api/cron/daily-alerts/route.ts`, `vercel.json`, `docs/line-notification-setup.md` |
| DB変更 | `supabase/migrations/20260801_add_pipeline_and_visit_checklist.sql` |

