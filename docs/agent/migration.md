# データの項目を増やす・変える（テーブル変更）

前提：`AGENTS.md` の「必ず守るルール」に従う。D1 は SQLite。

## 手順

1. 新しいマイグレーションファイルを作る（番号は自動で振られる）
   ```
   npm run db:new -- <変更内容を表す英語名>
   # 例: npm run db:new -- add_tags
   # → migrations/0002_add_tags.sql
   ```
2. 作られたファイルに SQL を書く
   ```sql
   -- 何のための変更かを1行で書く
   ALTER TABLE memos ADD COLUMN tags TEXT;
   ```
3. API と画面のコードを、新しい項目に合わせて直す
4. 手元に反映して確認する
   ```
   npm run db:migrate:local
   npm run dev
   ```

## ルール

| ルール | 理由 |
|---|---|
| 変更は必ず新しいファイルで行う。`migrations/` の既存ファイルは編集・削除しない | 適用済みかどうかはファイル名で管理される。書き換えても本番に反映されず、手元と本番がずれる |
| テーブル・列の削除、条件なしの `DELETE` / `UPDATE` は、利用者の了承を得て「了承の印」を書く（下記） | 消えたデータは自動では戻らない。印がないと公開時のチェックで止まる |
| 列の型を変えるときは、新しいテーブルを作ってデータを移す | SQLite は列の型を直接変えられない |
| 個人情報・機密情報の列を作らない | 保存すべきでない情報がある。必要そうなら利用者に確認 |
| 作成者を記録する列（例：`owner_email TEXT NOT NULL`）を、利用者ごとのデータには必ず入れる | 本人確認（`requireOwner`）に使う |
| 本番への反映（`--remote`）は実行しない | `main` に push すると、基盤がチェックしてから反映する |

## 型を変える例（SQLite）

```sql
-- 例: priority 列を TEXT から INTEGER に変える
CREATE TABLE memos_new (id TEXT PRIMARY KEY, body TEXT NOT NULL, priority INTEGER, owner_email TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
INSERT INTO memos_new (id, body, priority, owner_email, created_at, updated_at)
  SELECT id, body, CAST(priority AS INTEGER), owner_email, created_at, updated_at FROM memos;
-- 削除を了承: 型変更のため memos を作り直す（データは memos_new に移し済み）（2026-10-24 taro@example.co.jp）
DROP TABLE memos;
ALTER TABLE memos_new RENAME TO memos;
CREATE INDEX idx_memos_created_at ON memos (created_at DESC);
```

`DROP TABLE` を含むため、利用者に「データを移し替えます」と説明して了承を得て、印を書いてから行う。

## データが消える変更（了承の印）

対象：テーブルの削除（`DROP TABLE`）、列の削除（`ALTER TABLE ... DROP COLUMN`）、条件（`WHERE`）なしの `DELETE` / `UPDATE`。

1. 利用者に、**何が消えるか**を平易な言葉で説明し、よいか聞く
   - 例：「メモの『タグ』の欄をなくします。今入っているタグはすべて消え、元に戻せません。よいですか？」
2. 了承を得たら、その変更の**直前の行**に印を書く。了承した人のメールアドレスは `.dev.vars` の `DEV_USER_EMAIL` ではなく、利用者に確認する
   ```sql
   -- 削除を了承: memos の tag 列（2026-10-24 taro@example.co.jp）
   ALTER TABLE memos DROP COLUMN tag;
   ```
3. `npm run check` が通ることを確認する

了承を得られなければ、削除せずに残す方法（使わない列として残す、など）を提案する。
**利用者の了承なしに印を書かない。** 印は、公開時のチェックで「本人が了承した変更」として扱われる。
