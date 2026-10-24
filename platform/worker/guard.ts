import type { PlatformUser } from "./user";

/** アプリから投げると、そのままエラー応答（JSON）になる例外 */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * ③ 所有者チェック。所有者でなければ 403 にする。
 * row の所有者列名が owner_email 以外なら key で指定する。
 */
export function requireOwner<T extends Record<string, unknown>>(
  row: T,
  user: PlatformUser,
  key: keyof T = "owner_email",
): void {
  if (row[key] !== user.email) {
    throw new HttpError(403, "この操作ができるのは作成した本人だけです");
  }
}
