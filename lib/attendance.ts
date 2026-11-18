// Logic chấm công dùng chung (GIỮ hành vi app cũ).

export const STATUS_OK = '✓ Hợp lệ';
export const STATUS_OUT = '✗ Ngoài phạm vi';

export type Session = 'morning_in' | 'morning_out' | 'afternoon_in' | 'afternoon_out';

/** Khoảng cách 2 điểm GPS (mét) — Haversine. */
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Giờ VN (UTC+7 cố định) hiện tại. */
export function vnNow(): { dateStr: string; hhmm: number; dow: number } {
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  return {
    dateStr: d.toISOString().slice(0, 10), // YYYY-MM-DD theo giờ VN
    hhmm: d.getUTCHours() * 100 + d.getUTCMinutes(),
    dow: d.getUTCDay(), // 0 = CN ... 6 = T7
  };
}

/** Phân ca từ giờ (mốc hardcode GIỮ NGUYÊN: ≤9:00 / ≤12:45 / ≤15:00). */
export function sessionFromHHMM(hhmm: number): Session {
  if (hhmm <= 900) return 'morning_in';
  if (hhmm <= 1245) return 'morning_out';
  if (hhmm <= 1500) return 'afternoon_in';
  return 'afternoon_out';
}

export function sessionLabel(s: Session): string {
  return {
    morning_in: 'check-in sáng',
    morning_out: 'check-out sáng',
    afternoon_in: 'check-in chiều',
    afternoon_out: 'check-out chiều',
  }[s];
}
