'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Thực thi lựa chọn "Ghi nhớ đăng nhập" ở màn login.
 *
 * Lưu ý: @supabase/ssr ép cookie phiên sống 400 ngày nên không thể dùng
 * cookie-phiên để "quên khi đóng trình duyệt". Thay vào đó, khi người dùng
 * BỎ chọn ghi nhớ (cc_remember === '0'), ta phát hiện một phiên trình duyệt
 * mới (sessionStorage trống sau khi đóng/mở lại) và chủ động đăng xuất.
 *
 * - Ghi nhớ bật (mặc định) -> không làm gì, giữ đăng nhập như thường.
 * - Ghi nhớ tắt + mở lại trình duyệt -> signOut rồi về /login.
 */
export default function RememberGuard() {
  const router = useRouter();

  useEffect(() => {
    try {
      const remember = localStorage.getItem('cc_remember');
      if (remember === '0' && !sessionStorage.getItem('cc_alive')) {
        // Phiên trình duyệt mới sau khi đã đóng -> hết "nhớ".
        createClient()
          .auth.signOut()
          .finally(() => router.replace('/login'));
        return;
      }
      // Đánh dấu phiên trình duyệt hiện tại còn sống (xoá khi đóng trình duyệt).
      sessionStorage.setItem('cc_alive', '1');
    } catch {
      /* localStorage/sessionStorage bị chặn -> bỏ qua, giữ hành vi mặc định */
    }
  }, [router]);

  return null;
}
