/**
 * アプリの API（見本：メモ）
 *   GET    /api/me          ログイン中の利用者
 *   GET    /api/memos       一覧（社内のログインした人全員が見られる）
 *   POST   /api/memos       追加（作成者はログイン中の本人）
 *   PATCH  /api/memos/:id   本文の変更（作成者本人のみ）
 *   DELETE /api/memos/:id   削除（作成者本人のみ）
 *
 * この見本の書き方（AGENTS.md のルール）
 *   - 利用者は getUser() で取る（画面から送られた値は使わない）
 *   - SQL は prepare(...).bind(...) で組み立てる
 *   - 変更・削除の前に requireOwner() で本人確認する
 *   - 入力は API 側で検証する
 */
import { getUser, HttpError, requireOwner, withPlatform, type AuthEnv } from "../platform/worker";

type AppEnv = Env & AuthEnv;

const MAX_BODY_LENGTH = 2000;
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

interface MemoRow extends Record<string, unknown> {
  id: string;
  body: string;
  owner_email: string;
  created_at: number;
  updated_at: number;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** 画面に返す形。mine = 本人のものか（編集・削除ボタンを出すか） */
function toMemo(row: MemoRow, me: string) {
  return {
    id: row.id,
    body: row.body,
    ownerEmail: row.owner_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    mine: row.owner_email === me,
  };
}

/** JSON の本文を読み、メモの本文を検証して返す */
async function readBody(request: Request): Promise<string> {
  if (!request.headers.get("Content-Type")?.startsWith("application/json")) {
    throw new HttpError(415, "JSONで送信してください");
  }
  let input: { body?: unknown };
  try {
    input = await request.json();
  } catch {
    throw new HttpError(400, "JSONの形式が正しくありません");
  }
  if (typeof input.body !== "string" || input.body.trim() === "") {
    throw new HttpError(400, "本文を入力してください");
  }
  if (input.body.length > MAX_BODY_LENGTH) {
    throw new HttpError(400, `本文は${MAX_BODY_LENGTH}文字以内にしてください`);
  }
  return input.body;
}

async function findMemo(env: AppEnv, id: string): Promise<MemoRow> {
  if (!ID_PATTERN.test(id)) throw new HttpError(404, "見つかりません");
  const row = await env.DB.prepare("SELECT * FROM memos WHERE id = ?").bind(id).first<MemoRow>();
  if (!row) throw new HttpError(404, "見つかりません");
  return row;
}

async function handle(request: Request, env: AppEnv): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;
  const user = getUser(request); // 基盤が確認済みの利用者

  if (url.pathname === "/api/me" && method === "GET") {
    return json({ email: user.email });
  }

  if (url.pathname === "/api/memos") {
    if (method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM memos ORDER BY created_at DESC LIMIT 200",
      ).all<MemoRow>();
      return json(results.map((r) => toMemo(r, user.email)));
    }
    if (method === "POST") {
      const now = Date.now();
      const row: MemoRow = {
        id: crypto.randomUUID(),
        body: await readBody(request),
        owner_email: user.email, // 作成者は getUser() の値
        created_at: now,
        updated_at: now,
      };
      await env.DB.prepare(
        "INSERT INTO memos (id, body, owner_email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      )
        .bind(row.id, row.body, row.owner_email, row.created_at, row.updated_at)
        .run();
      return json(toMemo(row, user.email), 201);
    }
    throw new HttpError(405, "許可されていない操作です");
  }

  const match = url.pathname.match(/^\/api\/memos\/([^/]+)$/);
  if (match) {
    const row = await findMemo(env, match[1]);

    if (method === "PATCH") {
      requireOwner(row, user); // 本人以外は 403
      const body = await readBody(request);
      const updatedAt = Date.now();
      await env.DB.prepare("UPDATE memos SET body = ?, updated_at = ? WHERE id = ?")
        .bind(body, updatedAt, row.id)
        .run();
      return json(toMemo({ ...row, body, updated_at: updatedAt }, user.email));
    }
    if (method === "DELETE") {
      requireOwner(row, user); // 本人以外は 403
      await env.DB.prepare("DELETE FROM memos WHERE id = ?").bind(row.id).run();
      return new Response(null, { status: 204 });
    }
    throw new HttpError(405, "許可されていない操作です");
  }

  throw new HttpError(404, "見つかりません");
}

// 本人確認などの入口処理は基盤が受け持つ（この行は消さない）
export default withPlatform<AppEnv>({ fetch: (request, env) => handle(request, env) });
