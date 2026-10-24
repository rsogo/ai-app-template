# 画面や API を作る・直す

前提：`AGENTS.md` の「必ず守るルール」に従う。

## API を追加する（`worker/index.ts`）

基盤の部品は `../platform/worker` からだけ import する。

```ts
import { getUser, HttpError, requireOwner } from "../platform/worker";

// 例: 日報の削除（本人だけ）
const user = getUser(request);                       // ① ログイン中の利用者
const row = await env.DB
  .prepare("SELECT id, owner_email FROM reports WHERE id = ?")
  .bind(id)                                          // ② 値は必ず bind
  .first<{ id: string; owner_email: string }>();
if (!row) throw new HttpError(404, "見つかりません");
requireOwner(row, user);                             // ③ 本人以外は 403
await env.DB.prepare("DELETE FROM reports WHERE id = ?").bind(id).run();
```

- 新しく作るデータには、作成者として `owner_email: user.email` を保存する（画面から送られた値は使わない）。
- エラーは `throw new HttpError(ステータス, "利用者向けの日本語メッセージ")`。想定外のエラーは基盤が 500 にして内部情報を隠す。
- 入力は API 側で検証する（型・長さ・サイズ・形式）。
- アプリ全体は `export default withPlatform(...)` で包まれている。この行は消さない。

## 画面から API を呼ぶ（`src/`）

- `fetch("/api/...", { credentials: "same-origin" })` で呼ぶ。書き込みは `Content-Type: application/json` の JSON で送る。
- 画面側に鍵や接続情報を置かない。データベースへの直接接続は作らない。
- 他人のデータには編集・削除ボタンを出さない（API 側の本人確認とは別に、見た目でも分かるようにする）。

## ファイルを保存する

- ファイル置き場は最初は用意されていない。必要なら基盤に依頼する（`docs/agent/request.md`）。用意されたら `env.BUCKET`（R2）を使う。保存するキーはサーバー側で決める（例：`contents/<UUID>`）。利用者が送ったファイル名をそのままキーにしない。
- 保存できる種類と大きさを API 側で制限する。

## 手元で確認する

```
npm run db:migrate:local
npm run dev          # http://localhost:8787
npm run build        # 型チェック。公開前に必ず通す
```

確認できたら、利用者に「何ができるようになったか」を伝え、画面で試してもらう。
