import { createAdminClient } from '@/lib/supabase/admin';
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

/** Duyệt thiết bị (chống chấm hộ) — CHỈ Admin. Khu /admin đã được middleware gác vai admin. */
export default async function ThietBiPage() {
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
      canApprove: true, // admin duyệt toàn công ty
    }))
    // Chờ lên đầu
    .sort((a, b) => (a.status === 'Chờ' ? 0 : 1) - (b.status === 'Chờ' ? 0 : 1));

  const pending = items.filter((i) => i.status === 'Chờ').length;

  return (
    <>
      <h2 style={{ marginTop: 0 }}>
        Thiết bị{pending > 0 ? <span className="badge badge-wait" style={{ marginLeft: 8 }}>{pending} chờ duyệt</span> : ''}
      </h2>
      <p className="muted" style={{ marginTop: -6 }}>
        Duyệt thiết bị mới giúp chống chấm hộ: mỗi nhân viên chỉ 1 thiết bị hoạt động. Duyệt máy mới sẽ tự
        vô hiệu máy cũ.
      </p>
      <DevicePanel items={items} />
    </>
  );
}
