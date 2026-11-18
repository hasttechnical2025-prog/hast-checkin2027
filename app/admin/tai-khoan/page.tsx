import { createAdminClient } from '@/lib/supabase/admin';
import AdminNav from '@/app/admin/admin-nav';
import AccountsAdmin, { type Account } from './accounts-admin';

export const dynamic = 'force-dynamic';

export default async function TaiKhoanPage() {
  const admin = createAdminClient();
  const [{ data: userList }, { data: roles }, { data: emps }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
    admin.from('chamcong_app_roles').select('user_id, role, department, view_all'),
    admin.from('chamcong_employees').select('department').eq('status', 'Đang làm việc'),
  ]);

  const roleMap = new Map<string, { role: string; department: string | null; view_all: boolean }>(
    (roles ?? []).map((r) => [r.user_id as string, { role: r.role as string, department: r.department as string | null, view_all: !!r.view_all }]),
  );

  const accounts: Account[] = (userList?.users ?? []).map((u) => {
    const r = roleMap.get(u.id);
    return {
      userId: u.id,
      email: u.email || '',
      role: r?.role || '',
      department: r?.department || '',
      viewAll: !!r?.view_all,
    };
  });

  const departments = [...new Set((emps ?? []).map((e) => e.department as string).filter(Boolean))].sort();

  return (
    <main className="wrap" style={{ maxWidth: 900 }}>
      <AdminNav active="tai-khoan" />
      <AccountsAdmin accounts={accounts} departments={departments} />
    </main>
  );
}
