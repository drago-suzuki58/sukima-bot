# Sukima

サーバーメンバーが「忙しい日」を登録し、全員の空き状況をカレンダー形式で表示する Discord Bot です。毎朝、指定したチャンネルにリマインドを投稿します。Cloudflare Workers 上で動きます。

## コマンド

| コマンド | 動作 |
| --- | --- |
| `/skm busy [month]` | 忙しい日を入力するモーダルを開く。送信するとその月の登録を置き換える |
| `/skm free [month] [user]` | 全員の空き状況をカレンダーで表示する。`user` を指定するとその人の予定を表示する |
| `/skm mine [month]` | 自分の登録内容を確認する |
| `/skm leave` | 集計対象から外れる。登録データも削除する |
| `/skm setup channel:<channel> [hour:<0-23>]` | リマインドの投稿先と時刻（日本時間、省略時 8 時）を設定する |
| `/skm setup-off` | リマインドを停止する |

- `month` は `YYYY-MM` 形式で、省略すると今月になります。入力時に今月から 3 か月先までの候補が表示されます。
- 忙しい日は `3, 5, 12-14` のように入力します。区切りには `,` `、` と空白、範囲には `-` `~` `〜` `ー` を使えます。空欄で送信するとその月の登録を削除します。
- `setup` と `setup-off` は「サーバー管理」権限を持つメンバーだけが使えます。
- 日付の判定はすべて日本時間で行います。
- 登録直後は `/skm free` に反映されるまで数十秒かかることがあります。

カレンダーの色は次の意味です。黄と赤のマスには、その日に忙しい人の数が入ります（99 人まで）。

- 🟩 全員空き
- 🟨 忙しい人が参加者の半数未満
- 🟥 忙しい人が参加者の半数以上
- ⬛ 過去の日

`user` を指定した場合は、その人が忙しい日が 🟥、空いている日が 🟩 になります。

## 導入

前提: Node.js 24 以上、pnpm、[cf CLI](https://developers.cloudflare.com/)（`cf auth login` で認証済み）

1. 依存関係を入れます。

   ```sh
   pnpm install
   ```

2. Workers KV の namespace を作り、表示された `id` を `cloudflare.config.ts` の `SKM_KV` に設定します。

   ```sh
   cf kv namespaces create --title sukima-bot-SKM_KV
   ```

3. [Discord Developer Portal](https://discord.com/developers/applications) でアプリケーションを作り、`.env.example` を `.env` にコピーして値を入れます。

   | 変数 | 取得場所 |
   | --- | --- |
   | `DISCORD_PUBLIC_KEY` | General Information の Public Key |
   | `DISCORD_APPLICATION_ID` | General Information の Application ID |
   | `DISCORD_BOT_TOKEN` | Bot の Token |

4. カレンダー用のアプリ絵文字（曜日と、人数入りのマス）を登録します。画像を生成してアプリに登録し、ID を `src/emoji.json` に書き出します。初回は画像生成用のフォント（Noto Sans JP）をダウンロードします。登録しなくても動きますが、その場合は曜日が文字、マスが数字なしで表示されます。

   ```sh
   pnpm emoji
   ```

5. デプロイします。`.env` の値は Worker の Secrets として反映されます。

   ```sh
   pnpm run deploy
   ```

6. Developer Portal の General Information で、Interactions Endpoint URL にデプロイ先の URL（`https://sukima-bot.<subdomain>.workers.dev/`）を設定します。

7. コマンドを登録します。`DISCORD_GUILD_ID` を指定するとそのサーバーにだけ即座に反映されます。省略するとグローバルに登録され、反映まで時間がかかることがあります。

   ```sh
   DISCORD_GUILD_ID=<サーバー ID> pnpm register-commands
   ```

8. Developer Portal の Installation でスコープ `bot` と `applications.commands`、権限 View Channels と Send Messages を選び、生成された URL から Bot をサーバーに招待します。

## 開発

```sh
pnpm dev          # ローカルの開発サーバー（KV はローカルに保存される）
pnpm test         # ユニットテスト
pnpm typecheck    # 型チェック
```

ローカルでリマインドを試すには、開発サーバーの起動中に `http://localhost:<port>/cdn-cgi/local/scheduled` にアクセスします。
