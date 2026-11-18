import { createAdminClient } from '@/lib/supabase/admin';
import { vnNow } from '@/lib/attendance';
import AdminNav from '@/app/admin/admin-nav';
import LogAdmin, { type LogRow } from './log-admin';

export const dynamic = 'force-dynamic';

const pad = (n: number) => String(n).padStart(2, '0');

export default async function LogPage({ searchParams }: { searchParams: Promise<{ m?: string; emp?: string }> }) {
  const { m, emp } = await searchParams;
  const now = vnNow();
  let year = Number(now.dateStr.slice(0, 4));
  let month = Number(now.dateStr.slice(5, 7));
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    year = Number(m.slice(0, 4));
    month = Number(m.slice(5, 7));
  }
  const start = `${year}-${pad(month)}-01T00:00:00+07:00`;
  const endMonthDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${pad(month)}-${pad(endMonthDay)}T23:59:59+07:00`;

  const admin = createAdminClient();
  let query = admin
    .from('chamcong_attendance_logs')
    .select('id, employee_name, checked_at, latitude, longitude, distance, nearest_office, status, address, note')
    .gte('checked_at', start)
    .lte('checked_at', end)
    .order('checked_at', { ascending: false })
    .limit(1000);
  if (emp) query = query.eq('employee_name', emp);
  const { data } = await query;

  const rows: LogRow[] = (data ?? []).map((r) => ({
    id: r.id as string,
    name: (r.employee_name as string) || '',
    checkedAt: r.checked_at as string,
    lat: r.latitude as number | null,
    lng: r.longitude as number | null,
    distance: r.distance as number | null,
    office: (r.nearest_office as string) || '',
    status: (r.status as string) || '',
    address: (r.address as string) || '',
    note: (r.note as string) || '',
  }));

  const { data: empList } = await admin
    .from('chamcong_employees')
    .select('name')
    .eq('status', 'Đang làm việc')
    .order('name');
  const names = (empList ?? []).map((e) => e.name as string);

  const idx = year * 12 + month;
  const toM = (i: number) => `${Math.floor((i - 1) / 12)}-${pad(((i - 1) % 12) + 1)}`;
  const curIdx = Number(now.dateStr.slice(0, 4)) * 12 + Number(now.dateStr.slice(5, 7));

  return (
    <main className="wrap" style={{ maxWidth: 1100 }}>
      <AdminNav active="log" />
      <LogAdmin
        rows={rows}
        names={names}
        selEmp={emp || ''}
        year={year}
        month={month}
        prevHref={`/admin/log?m=${toM(idx - 1)}${emp ? `&emp=${encodeURIComponent(emp)}` : ''}`}
        nextHref={idx + 1 <= curIdx ? `/admin/log?m=${toM(idx + 1)}${emp ? `&emp=${encodeURIComponent(emp)}` : ''}` : null}
      />
    </main>
  );
}
