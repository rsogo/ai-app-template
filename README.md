# AIアプリ テンプレート（NCDC 基盤用）

NCDC の基盤（お客様専用の Cloudflare 環境）で動く業務アプリを、AI ツールと一緒に作るためのテンプレートです。
見本として「メモ」アプリが入っています（一覧・追加・編集・削除。編集と削除は作成した本人だけ）。

## はじめ方

1. このテンプレートからアプリのリポジトリを作る（GitHub）
2. NCDC に「新しいアプリの用意」を依頼する（アプリ名・用途・DB を使うか・リポジトリの URL など。`docs/agent/request.md`）
3. AI ツール（Claude Code、Copilot、Cursor など）でリポジトリを開き、次のように頼む
   > このテンプレートを使って、〇〇のアプリを作って。手元で確認できるところまでやって。
4. NCDC から完了連絡（設定値）が届いたら、AI に「NCDC から届いた設定を反映して」と頼む

AI は `AGENTS.md` のルールと `docs/agent/` の手順に沿って作業します。

## 手元で動かす（AI に頼めば代わりに実行します）

```
npm ci
npm run setup -- <アプリ名>
cp .dev.vars.example .dev.vars   # DEV_USER_EMAIL に自分のメールアドレス
npm run db:migrate:local
npm run dev                      # http://localhost:8787
npm run check                    # 公開前チェック
```

## 構成

```
AGENTS.md        AI 向けの指示（ルール）。CLAUDE.md はこれを読み込むだけ
docs/agent/      AI 向けの作業手順（作る・テーブル変更・公開・依頼）
platform/        基盤から渡される部品（本人確認・本人チェック・公開前チェック）。編集しない
worker/          アプリの API（見本：メモ）
src/             アプリの画面（見本：メモ）
migrations/      アプリのテーブル定義
scripts/         アプリ名の設定
```

## 公開

**社内公開は申請不要です。** `main` ブランチに push すると、基盤が自動でチェックしてから公開します（数分）。公開されたアプリは、社内でログインした人だけが見られます。AI に「社内に公開して」と頼めば、確認とチェックのうえで push します（`docs/agent/publish.md`）。

データが消えるテーブル変更は、あなたの了承がないと公開時に止まります。社外への公開は申請制です。
