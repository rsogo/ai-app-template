/**
 * 基盤から渡すもの（アプリはここからだけ import する）
 *   ① getUser       確認済みの利用者情報
 *   ② env.DB など   資源のつなぎ口（binding。鍵は存在しない）
 *   ③ requireOwner / HttpError  共通部品
 *   withPlatform    入口処理（本人確認など）でアプリを包む
 */
export { withPlatform } from "./gateway";
export { getUser, type PlatformUser } from "./user";
export { requireOwner, HttpError } from "./guard";
export type { AuthEnv } from "./auth";
