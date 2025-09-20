// VideoStats.jsx
import React from "react";

function fmtUnit(val, suffix) {
  if (val < 10) return `${val.toFixed(1).replace(/\.0$/, "")}${suffix}`;
  return `${Math.round(val)}${suffix}`;
}

/** 數字縮寫：k / w / M / B */
function formatCount(input) {
  const n = Number(input);
  if (!Number.isFinite(n)) return "—";
  if (n < 1000) return String(n);

  if (n < 10000) return fmtUnit(n / 1000, "k");                 // 1k+
  if (n < 1_000_000) return fmtUnit(n / 10_000, "w");           // 1w+
  if (n < 1_000_000_000) return fmtUnit(n / 1_000_000, "M");    // 1M+
  return fmtUnit(n / 1_000_000_000, "B");                       // 1B+
}

/** 只保留到 YYYY-MM-DD，忽略 T 之後 */
function formatDate(input) {
  if (!input) return "—";
  if (typeof input === "string") {
    const [datePart] = input.split("T");
    return datePart || "—";
  }
  try {
    return new Date(input).toISOString().split("T")[0];
  } catch {
    return "—";
  }
}

/**
 * 使用：
 * <VideoStats view_count={987654321} like_count={123456} upload_date="2009-10-25T00:00:00Z" />
 */
export default function VideoStats({
  view_count,
  like_count,
  upload_date,
  className = "",
}) {
  const views = formatCount(view_count);
  const likes = formatCount(like_count);
  const date = formatDate(upload_date);

  return (
    <div className={`flex flex-wrap items-center gap-3 text-sm ${className}`}>
      <span title={`Views: ${view_count?.toLocaleString?.() ?? view_count}`}>
        👁️ {views}
      </span>
      <span title={`Likes: ${like_count?.toLocaleString?.() ?? like_count}`}>
        👍 {likes}
      </span>
      <span title={`Upload date: ${date}`}>📅 {date}</span>
    </div>
  );
}
