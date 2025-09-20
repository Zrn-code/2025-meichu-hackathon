// Note.jsx
import React, { useEffect, useState } from "react";

const PAGE_SIZE = 5;

export default function Note() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [page, setPage] = useState(1);

  const load = async () => {
    try {
      setLoading(true);
      setErr(null);
      const list = await window.electronAPI?.listNotebook?.();
      setRows(Array.isArray(list) ? list : []);
      setPage(1); // 重新載入時回到第 1 頁
    } catch (e) {
      setErr(e?.message || String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ----- 分頁計算 -----
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const visible = rows.slice(start, start + PAGE_SIZE);

  useEffect(() => {
    // rows 變動時，確保頁碼不超出範圍
    if (page > totalPages) setPage(totalPages);
  }, [rows, totalPages]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-xl font-bold">Notebook 列表</h2>
        <span className="opacity-70">（共 {rows.length} 筆 / 每頁 {PAGE_SIZE} 筆）</span>
        <button className="btn btn-sm btn-outline" onClick={load}>Refresh</button>
      </div>

      {err && <div className="alert alert-error">{err}</div>}

      {loading ? (
        <div className="flex items-center gap-2">
          <span className="loading loading-spinner" />
          <span>載入中…</span>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>keywords</th>
                  <th>url</th>
                  <th className="text-right">filename</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center opacity-70">
                      /public/notebook 沒有可用的 JSON 內容
                    </td>
                  </tr>
                ) : (
                  visible.map((r, idx) => (
                    <tr key={r.id ?? `${r.filename}:${start + idx}`}>
                      <th>{start + idx + 1}</th>
                      <td>{String(r.keywords ?? "")}</td>
                      <td>
                        {r.url ? (
                          <a
                            className="link"
                            href={r.url}
                            onClick={(e) => {
                              e.preventDefault();
                              window.electronAPI?.openExternalUrl?.(r.url);
                            }}
                          >
                            {r.url}
                          </a>
                        ) : (
                          <span className="opacity-60">—</span>
                        )}
                      </td>
                      <td className="text-right opacity-70">{r.filename}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

            {/* 底部分頁導覽：三鍵樣式（如截圖） */}
            {rows.length > PAGE_SIZE && (
                <div className="mt-4 flex justify-center">
                    <div className="join">
                    <button
                        className="join-item btn"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={safePage === 1}
                        aria-label="Previous page"
                        title="上一頁"
                    >
                        «
                    </button>

                    {/* 中間顯示目前頁碼，不可點擊 */}
                    <span className="join-item btn btn-ghost pointer-events-none select-none">
                        Page {safePage}
                    </span>

                    <button
                        className="join-item btn"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={safePage === totalPages}
                        aria-label="Next page"
                        title="下一頁"
                    >
                        »
                    </button>
                </div>
            </div>
            )}

        </>
      )}
    </div>
  );
}
