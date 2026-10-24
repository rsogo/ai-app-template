/** 基盤が確認済みの利用者情報を、アプリに渡すためのヘッダー名 */
export const USER_EMAIL_HEADER = "X-Platform-User-Email";

export interface PlatformUser {
  email: string;
}

/**
 * ① 確認済みの利用者情報を取得する。
 * 値は入口処理（gateway）が JWT を検証したうえで設定したもの。画面から同名のヘッダーを送っても入口で消される。
 */
export function getUser(request: Request): PlatformUser {
  const email = request.headers.get(USER_EMAIL_HEADER);
  if (!email) throw new Error("getUser: 入口処理を通っていないリクエストです（withPlatform で包んでください）");
  return { email };
}
