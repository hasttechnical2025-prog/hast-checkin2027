'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Thực thi lựa chọn "Ghi nhớ đăng nhập" ở màn login.
 *
 * Lưu ý: @supabase/ssr ép cookie phiên sống 400 ngày nên không thể dùng
 * cookie-phiên để "quên khi đóng trình duyệt". Thay vào đó, khi người dùng
 * BỎ chọn ghi nhớ (cc_remember === '0'), ta phát hiện trình duyệt đã ĐÓNG rồi
 * mở lại bằng một "nhịp sống" (heartbeat) trong localStorage:
 *   - Mỗi tab đang mở ghi mốc thời gian `cc_seen` định kỳ.
 *   - Khi tải trang, nếu `cc_seen` quá CŨ (không tab nào còn sống) -> trình duyệt
 *     đã đóng -> đăng xuất. Nếu còn mới (tab khác vừa sống) -> giữ nguyên.
 *
 * Dùng localStorage (chia sẻ giữa các tab) thay vì sessionStorage (riêng từng tab)
 * -> MỞ TAB MỚI không còn bị hiểu nhầm là "trình duyệt mới" và đăng xuất oan.
 *
 * - Ghi nhớ bật (mặc định) -> không bao giờ tự đăng xuất.
 * - Ghi nhớ tắt + đóng rồi mở lại trình duyệt -> signOut rồi về /login.
 */
const SEEN_KEY = 'cc_seen';
const STALE_MS = 20000; // > ~20s không tab nào cập nhật -> coi như đã đóng trình duyệt

export default function RememberGuard() {
  const router = useRouter();

  useEffect(() => {
    try {
      if (localStorage.getItem('cc_remember') === '0') {
        const last = Number(localStorage.getItem(SEEN_KEY) || 0);
        if (!last || Date.now() - last > STALE_MS) {
          // Không tab nào còn sống gần đây -> trình duyệt đã đóng -> hết "nhớ".
          createClient()
            .auth.signOut()
            .finally(() => router.replace('/login'));
          return;
        }
      }
    } catch {
      /* storage bị chặn -> bỏ qua, giữ hành vi mặc định */
    }

    // Nhịp sống: đánh dấu còn ít nhất 1 tab đang mở.
    const beat = () => {
      try {
        localStorage.setItem(SEEN_KEY, String(Date.now()));
      } catch {
        /* bỏ qua */
      }
    };
    beat();
    const id = window.setInterval(beat, 5000);
    window.addEventListener('pagehide', beat);
    document.addEventListener('visibilitychange', beat);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('pagehide', beat);
      document.removeEventListener('visibilitychange', beat);
    };
  }, [router]);

  return null;
}
