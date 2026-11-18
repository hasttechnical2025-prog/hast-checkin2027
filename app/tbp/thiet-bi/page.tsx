import { getStaffSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import SignOutButton from '@/app/_components/SignOutButton';
import DevicePanel, { type DeviceItem } from './device-panel';

export const dynamic = 'force-dynamic';

interface BindRow {
  id: string;
  device_label: string | null;
  approve_status: string | null;
  is_active: boolean;
  bound_at: string;
  chamcong_employees: { name: string; department: string } | null;
}

export default async function ThietBiPage() {
  const staff = await getStaffSession();
  if (!staff) {
    return (
      <main className="wrap">
        <p>
          Không có quyền. <a href="/login">Đăng nhập</a>.
        </p>
      </main>
    );
  }

  // Chỉ Admin được duyệt thiết bị (theo chính sách: TBP không quản lý thiết bị).
  if (staff.role !== 'admin') {
    return (
      <main className="wrap">
        <div className="ls-top">
          <div>
            <h1 style={{ margin: 0, fontSize: 22 }}>Thiết bị</h1>
            <div className="muted" style={{ fontSize: 13 }}>
              {staff.email} · {staff.department}
            </div>
          </div>
          <SignOutButton />
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <p>Việc duyệt thiết bị do <b>Admin</b> phụ trách. <a href="/tbp">← Về Duyệt giải trình</a></p>
        </div>
      </main>
    );
  }

  const isAdmin = true;
  const seeAll = true;
  const admin = createAdminClient();

  const { data } = await admin
    .from('chamcong_device_bind')
    .select('id, device_label, approve_status, is_active, bound_at, chamcong_employees!inner(name, department)')
    .order('is_active', { ascending: false })
    .order('bound_at', { ascending: false });

  const items: DeviceItem[] = ((data ?? []) as unknown as BindRow[])
    .map((b) => ({
      id: b.id,
      name: b.chamcong_employees?.name || '—',
      dept: b.chamcong_employees?.department || '—',
      label: b.device_label || '',
      status: b.approve_status || 'Chờ',
      active: b.is_active,
      boundAt: b.bound_at,
      canApprove: isAdmin || (b.chamcong_employees?.department === staff.department),
    }))
    .filter((i) => seeAll || i.dept === staff.department)
    // Chờ lên đầu
    .sort((a, b) => (a.status === 'Chờ' ? 0 : 1) - (b.status === 'Chờ' ? 0 : 1));

  return (
    <main className="wrap" style={{ maxWidth: 820 }}>
      <div className="ls-top">
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Thiết bị</h1>
          <div className="muted" style={{ fontSize: 13 }}>
            {staff.email} · {isAdmin ? 'Admin (toàn công ty)' : staff.department}
          </div>
        </div>
        <SignOutButton />
      </div>

      <DevicePanel items={items} />
    </main>
  );
}
