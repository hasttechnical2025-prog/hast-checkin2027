import { createClient } from '@/lib/supabase/server';

export type StaffRole = 'admin' | 'TBP';

export interface StaffSession {
  userId: string;
  email: string | null;
  role: StaffRole;
  department: string | null;
  viewAll: boolean;
}

/**
 * Lấy phiên TBP/Admin hiện tại kèm vai (đọc chamcong_app_roles qua RLS "chính mình").
 * @returns null nếu chưa đăng nhập hoặc chưa được gán vai.
 */
export async function getStaffSession(): Promise<StaffSession | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: role } = await supabase
    .from('chamcong_app_roles')
    .select('role, department, view_all')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!role) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    role: role.role as StaffRole,
    department: role.department,
    viewAll: role.view_all,
  };
}
