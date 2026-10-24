import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Cloudflare Access が付与する JWT（Cf-Access-Jwt-Assertion ヘッダー）を検証し、
 * ログインしている人のメールアドレスを返す。
 *
 * Access の前段チェックに加えて Worker 側でも検証する理由:
 *   - Access の設定ミスや迂回があっても、API は本人確認なしでは動かない（二重チェック）
 *   - 「誰の操作か」をサーバー側で確定させる（画面から送られたユーザー情報は信用しない）
 */

export interface AuthEnv {
  TEAM_DOMAIN: string; // 例: https://<チーム名>.cloudflareaccess.com
  POLICY_AUD: string; // Access アプリの AUD タグ（複数ある場合はカンマ区切り）
  DEV_USER_EMAIL?: string; // ローカル開発専用（.dev.vars）。localhost 以外では無視する
}

export class AuthError extends Error {}

// 公開鍵はチームドメインごとに取得・キャッシュする（jose が鍵のローテーションにも追従する）
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwks(teamDomain: string) {
  let set = jwksCache.get(teamDomain);
  if (!set) {
    set = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    jwksCache.set(teamDomain, set);
  }
  return set;
}

function isLocal(url: URL): boolean {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1";
}

export async function authenticate(request: Request, env: AuthEnv): Promise<string> {
  const url = new URL(request.url);

  // ローカル開発（wrangler dev）では Access を通らないため、.dev.vars の固定ユーザーで動かす
  if (env.DEV_USER_EMAIL && isLocal(url)) {
    return env.DEV_USER_EMAIL.toLowerCase();
  }

  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) throw new AuthError("missing token");

  const audiences = env.POLICY_AUD.split(",").map((s) => s.trim()).filter(Boolean);
  if (audiences.length === 0 || !env.TEAM_DOMAIN) throw new AuthError("auth not configured");

  try {
    const { payload } = await jwtVerify(token, jwks(env.TEAM_DOMAIN), {
      issuer: env.TEAM_DOMAIN,
      audience: audiences,
      algorithms: ["RS256"],
    });
    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
    if (!email) throw new AuthError("no email in token");
    return email;
  } catch (e) {
    throw new AuthError(e instanceof Error ? e.message : "invalid token");
  }
}
