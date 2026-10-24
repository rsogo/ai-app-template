/** API の呼び出し。画面には鍵や接続情報を置かない（ログインは基盤が Cookie で管理する） */

export interface Memo {
  id: string;
  body: string;
  ownerEmail: string;
  createdAt: number;
  updatedAt: number;
  mine: boolean;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}) },
  });
  if (!res.ok) {
    let message = `エラーが発生しました（${res.status}）`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // JSON 以外（ログイン画面への転送など）
    }
    throw new ApiError(res.status, message);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const api = {
  me: () => request<{ email: string }>("/api/me"),
  list: () => request<Memo[]>("/api/memos"),
  create: (body: string) => request<Memo>("/api/memos", { method: "POST", body: JSON.stringify({ body }) }),
  update: (id: string, body: string) =>
    request<Memo>(`/api/memos/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ body }) }),
  remove: (id: string) => request<void>(`/api/memos/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
