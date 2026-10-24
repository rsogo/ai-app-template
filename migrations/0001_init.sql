-- 見本のテーブル: メモ。アプリに合わせて新しいマイグレーションで変更していく
-- 利用者ごとのデータには、作成者の列（owner_email）を必ず入れる（本人確認に使う）
CREATE TABLE memos (
  id          TEXT PRIMARY KEY,     -- UUID（サーバー側で採番）
  body        TEXT NOT NULL,        -- 本文
  owner_email TEXT NOT NULL,        -- 作成者（getUser() の値。画面から送られた値は使わない）
  created_at  INTEGER NOT NULL,     -- 作成日時（epoch ms）
  updated_at  INTEGER NOT NULL      -- 更新日時（epoch ms）
);
CREATE INDEX idx_memos_created_at ON memos (created_at DESC);
