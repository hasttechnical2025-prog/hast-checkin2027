/**
 * Tính tháng HIỂN THỊ mặc định cho TBP/Admin + clamp theo `?m`.
 * Pure (không import server-only) -> dùng được cả Server Component lẫn Client.
 *
 * Nghiệp vụ: trong 10 ngày đầu tháng (ngày <= 10) vẫn đang CHỐT tháng trước,
 * nên mặc định (khi chưa có ?m) hiển thị THÁNG TRƯỚC. Từ ngày 11 trở đi -> tháng hiện tại.
 * Người dùng vẫn bấm ‹ › được tới tối đa là tháng hiện tại.
 */
export function resolveViewMonth(
  m: string | undefined | null,
  curY: number,
  curM: number,
  curDay: number,
): { year: number; month: number; idx: number; curIdx: number } {
  const curIdx = curY * 12 + curM;
  const defIdx = curIdx - (curDay <= 10 ? 1 : 0);
  let idx = defIdx;
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const y = Number(m.slice(0, 4));
    const mo = Number(m.slice(5, 7));
    const cand = y * 12 + mo;
    if (mo >= 1 && mo <= 12 && cand <= curIdx) idx = cand; // không cho vượt tháng hiện tại
  }
  return {
    year: Math.floor((idx - 1) / 12),
    month: ((idx - 1) % 12) + 1,
    idx,
    curIdx,
  };
}
