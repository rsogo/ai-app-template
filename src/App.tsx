import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, type Memo } from "./api";

const dateFmt = new Intl.DateTimeFormat("ja-JP", { dateStyle: "short", timeStyle: "short" });

export function App() {
  const [me, setMe] = useState<string | null>(null);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const run = useCallback(async (action: () => Promise<unknown>) => {
    try {
      await action();
      setMessage(null);
      setMemos(await api.list());
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "エラーが発生しました");
    }
  }, []);

  useEffect(() => {
    api.me().then((r) => setMe(r.email), () => setMe(null));
    void run(async () => {});
  }, [run]);

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    void run(async () => {
      await api.create(draft);
      setDraft("");
    });
  };

  const save = (id: string) =>
    run(async () => {
      await api.update(id, editText);
      setEditingId(null);
    });

  const remove = (memo: Memo) => {
    if (!window.confirm("このメモを削除しますか？")) return;
    void run(() => api.remove(memo.id));
  };

  return (
    <div className="page">
      <header className="header">
        <h1>My App</h1>
        {me && <span className="me">{me}</span>}
      </header>

      <form className="composer" onSubmit={add}>
        <label htmlFor="draft" className="label">新しいメモ</label>
        <textarea id="draft" value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} maxLength={2000} />
        <button type="submit" disabled={!draft.trim()}>追加</button>
      </form>

      {message && <p className="message" role="alert">{message}</p>}

      <ul className="memos">
        {memos.map((memo) => (
          <li key={memo.id} className="memo">
            {editingId === memo.id ? (
              <>
                <label htmlFor={`edit-${memo.id}`} className="label">メモを編集</label>
                <textarea id={`edit-${memo.id}`} value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} maxLength={2000} />
                <div className="actions">
                  <button type="button" onClick={() => void save(memo.id)}>保存</button>
                  <button type="button" className="secondary" onClick={() => setEditingId(null)}>やめる</button>
                </div>
              </>
            ) : (
              <>
                <p className="body">{memo.body}</p>
                <div className="meta">
                  <span>{memo.mine ? "自分" : memo.ownerEmail}・{dateFmt.format(memo.updatedAt)}</span>
                  {/* 編集・削除は本人のものだけ表示（最終的な確認は API 側で行う） */}
                  {memo.mine && (
                    <span className="actions">
                      <button type="button" className="secondary" onClick={() => { setEditingId(memo.id); setEditText(memo.body); }}>編集</button>
                      <button type="button" className="secondary" onClick={() => remove(memo)}>削除</button>
                    </span>
                  )}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      {memos.length === 0 && !message && <p className="empty">まだメモがありません</p>}
    </div>
  );
}
