# 開発ガイド

## 構成上の決定

- Cloudflare Workers で動かし、Gateway は使わない。Interaction は HTTP（`fetch`）、リマインドは Cron Triggers（`scheduled`）で受ける。
- ストレージは Workers KV のみ。KV へのアクセスは `src/store.ts` に閉じ込め、ほかのモジュールから直接触らない。
- KV のキーはユーザー×月単位（`busy:{guild}:{YYYY-MM}:{user}`）に分け、各ユーザーが自分のキーだけを書く。集計は `list` の metadata で行い、`get` を人数分呼ばない。
- 表示は Components V2（`IS_COMPONENTS_V2`）で組む。1 メッセージのコンポーネントは 40 個以内に収める。
- 日付の判定はすべて JST。`Date` を直接使わず `src/time.ts` のヘルパーを使う。
- 日付の入力は「対象月 + カンマ区切りのテキスト」だけで、ボタン UI は作らない。
- カレンダーは日曜始まり（設計書の月曜始まりから変更）。曜日のインデックスは日曜が 0。

## 制約

- トップレベルコマンドは `/skm` だけ。`default_member_permissions` はサブコマンド単位で付けられないため、`setup` と `setup-off` はハンドラー内で Manage Guild（または Administrator）を確かめる。
- Interaction への応答期限は 3 秒。重い処理を足す場合は deferred 応答（type 5）にして `ctx.waitUntil` で followup を編集する。
- KV は結果整合なので、登録直後の `/skm free` に反映されないことがある。厳密な一貫性が必要になったら D1 か Durable Objects へ移行する。

## ツール

- Cloudflare の操作には `cf` CLI を使う（wrangler は使わない）。Worker の設定は `cloudflare.config.ts`。
- `compatibilityDate` はローカルの workerd が対応する日付より新しくすると `pnpm dev` が起動しない。
- 純粋関数（`parse.ts`、`render.ts`、`time.ts`）のテストは `test/` に置き、Node 上の vitest で動かす（`vitest.config.ts` は Cloudflare プラグインを読み込まない）。
- コマンド定義を変えたら `pnpm register-commands` で再登録する。
- カレンダーの曜日と人数入りのマスはアプリ絵文字。`scripts/emoji.ts` が画像を生成して登録し、ID を `src/emoji.json` に書き出す。ID はアプリごとに異なる。絵文字がない場合は標準の絵文字と文字にフォールバックする。
- 絵文字のデザインを変えたら `pnpm emoji --preview <dir>` で画像を確かめ、`pnpm emoji --force` で作り直す。
