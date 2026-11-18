import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Client SERVICE ROLE — bỏ qua RLS, TOÀN QUYỀN ghi. CHỈ dùng trong code chạy ở
 * server (Route Handler / Server Action). `server-only` sẽ làm build GÃY nếu lỡ
 * import vào Client Component -> chống rò service_role ra trình duyệt.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
