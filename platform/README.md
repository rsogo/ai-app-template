# platform/ — 基盤から渡すもの

**アプリ開発者（利用者・AI）は、このディレクトリを編集しない。** 基盤側が提供・更新する部品。

| 渡すもの | 中身 | アプリからの使い方 |
|---|---|---|
| ① 確認済みの利用者情報 | メールアドレス（入口で JWT を検証した結果） | `getUser(request)` |
| ② 資源のつなぎ口 | D1（`env.DB`）・R2（`env.BUCKET`）の binding。鍵は存在しない | `env.DB.prepare(...).bind(...)` |
| ③ 共通部品 | 所有者チェック、エラー応答 | `requireOwner()`, `HttpError` |
| 入口処理 | 本人確認、なりすまし送信の拒否、エラー時に内部情報を返さない | `withPlatform(app)` でアプリを包む |
| 公開前チェック | データが消えるテーブル変更の了承確認、鍵の混入検出、設定の反映確認 | `npm run check`（公開時は基盤が `--deploy` 付きで実行） |

## ファイル
| ファイル | 役割 |
|---|---|
| `worker/index.ts` | アプリから使う公開 API（ここ以外は直接 import しない） |
| `worker/gateway.ts` | 入口処理。JWT を検証し、確認済みの利用者情報をヘッダーに載せてアプリへ渡す |
| `worker/auth.ts` | Cloudflare Access の JWT 検証 |
| `worker/user.ts` | `getUser()` |
| `worker/guard.ts` | `requireOwner()`, `HttpError` |
| `check/check.mjs` | 公開前チェック |

## 本番の基盤との対応
このプロトタイプでは基盤の部品がアプリと同じ Worker に同梱されているが、本番の基盤（Workers for Platforms）では:
- 入口処理（`gateway.ts` / `auth.ts`）は振り分け役の Worker（dispatch Worker）で動き、アプリには含まれない
- アプリは振り分け役からしか呼ばれないため、ヘッダーで渡す利用者情報をそのまま信用できる
- アプリが使う API（`getUser` / `requireOwner`）は同じなので、アプリのコードは変わらない

## 公開の仕組み（Workers Builds）
NCDC が「新しいアプリの用意」でリポジトリを Cloudflare に接続する。以降、`main` への push ごとに Cloudflare 側で次が実行される（設定は NCDC が管理し、リポジトリからは変えられない。鍵はリポジトリに置かない）:

```
ビルドコマンド:   npm ci && npm run build
デプロイコマンド: node platform/check/check.mjs --deploy && npx wrangler d1 migrations apply DB --remote && npx wrangler deploy
```

チェックで止まった場合、テーブル変更もアプリの更新も反映されない。
