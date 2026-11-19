/**
 * Nhận diện ĐIỆN THOẠI theo User-Agent — LOẠI TRỪ máy tính, máy tính bảng và iPad.
 * Dùng chung cho cả trang CBNV (gate khi mở) lẫn route chấm công (chặn thật).
 *
 * Quy tắc:
 *  - iPhone / iPod / Windows Phone  -> điện thoại.
 *  - Android: CHỈ tính là điện thoại khi UA có "Mobile" (tablet Android bỏ chữ này).
 *  - iPad (kể cả iPadOS mới khai báo giống Macintosh) và các tablet khác -> KHÔNG.
 *
 * Lưu ý: nhận diện theo UA không tuyệt đối (điện thoại ở "chế độ máy tính" có thể bị
 * coi là không phải điện thoại). Đây là đánh đổi có chủ đích để chặn chặt tablet/iPad.
 */
export function isPhone(ua: string | null | undefined): boolean {
  if (!ua) return false;
  if (/iPhone|iPod|Windows Phone/i.test(ua)) return true;
  if (/Android/i.test(ua) && /Mobile/i.test(ua)) return true;
  return false;
}
