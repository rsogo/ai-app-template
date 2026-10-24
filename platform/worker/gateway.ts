import { AuthError, authenticate, type AuthEnv } from "./auth";
import { HttpError } from "./guard";
import { USER_EMAIL_HEADER } from "./user";

/** エラー応答（基盤共通の形式） */
export function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** 書き込み系は同一オリジンからのみ受け付ける（他サイトからの なりすまし送信 対策） */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  return origin === null || origin === new URL(request.url).origin;
}

/**
 * 入口処理。アプリの fetch をこれで包む。
 *   1. 外から送られた利用者情報ヘッダーを消す（なりすまし防止）
 *   2. Access の JWT を検証し、確認済みの利用者情報をヘッダーに載せる
 *   3. 書き込み系は同一オリジンのみ許可
 *   4. アプリの HttpError は JSON 応答に、想定外のエラーは内部情報を出さずに 500 にする
 * 本番の基盤では、この処理は振り分け役の Worker（dispatch Worker）で動く。
 */
export function withPlatform<E extends AuthEnv>(app: {
  fetch(request: Request, env: E, ctx: ExecutionContext): Promise<Response>;
}): ExportedHandler<E> {
  return {
    async fetch(incoming, env, ctx) {
      try {
        const headers = new Headers(incoming.headers);
        for (const name of [...headers.keys()]) {
          if (name.toLowerCase().startsWith("x-platform-")) headers.delete(name);
        }

        let email: string;
        try {
          email = await authenticate(incoming, env);
        } catch (e) {
          if (e instanceof AuthError) return errorResponse(401, "ログインが必要です");
          throw e;
        }
        if (incoming.method !== "GET" && incoming.method !== "HEAD" && !isSameOrigin(incoming)) {
          return errorResponse(403, "不正なリクエスト元です");
        }

        headers.set(USER_EMAIL_HEADER, email);
        const request = new Request(incoming, { headers });
        return await app.fetch(request, env, ctx);
      } catch (e) {
        if (e instanceof HttpError) return errorResponse(e.status, e.message);
        console.error(e);
        return errorResponse(500, "サーバーでエラーが発生しました"); // 内部の詳細は返さない
      }
    },
  };
}
