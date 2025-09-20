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
    <div className="bg-base-100 rounded-lg p-4 border border-base-300">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-lg font-semibold text-primary">📚 Notebook</h3>
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
            <table className="table table-compact">
              <thead>
                <tr>
                  <th className="w-8">#</th>
                  <th className="w-20">keywords</th>
                  <th className="w-32">url</th>
                  <th className="w-24 text-right">filename</th>
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
                      <th className="w-8 text-xs">{start + idx + 1}</th>
                      <td className="w-20 text-xs">
                        <div className="line-clamp-2 text-xs">
                          {String(r.keywords ?? "")}
                        </div>
                      </td>
                      <td className="w-32">
                        {r.url ? (
                          <a
                            className="link text-xs block"
                            href={r.url}
                            onClick={(e) => {
                              e.preventDefault();
                              window.electronAPI?.openExternalUrl?.(r.url);
                            }}
                            title={r.url}
                          >
                            <div className="line-clamp-3 break-all">
                              {r.url}
                            </div>
                          </a>
                        ) : (
                          <span className="opacity-60 text-xs">—</span>
                        )}
                      </td>
                      <td className="w-24 text-right opacity-70 font-medium text-xs">
                        <div className="line-clamp-2 text-right">
                          {r.filename}
                        </div>
                      </td>
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
